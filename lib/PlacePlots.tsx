import { useFetch } from "lib/queries"
import { useMemo, useCallback } from "react"
import WindowSelectSearch from "lib/WindowSelectSearch"
import BarPlot from "lib/BarPlot"
import us from "us"
import { useRouter } from "next/router"
import { makeUnitsSelect, usePerCapitaInput } from "lib/selects"
import { PathMapping } from "lib/utils"

export function getJsonUrl(place: string, state: string): string {
  if (place === null) {
    return null
  }
  place = place.replace("#", "%23")
  const stateFips = getStateFips(state)
  if (stateFips) {
    return "/places_data/" + stateFips + "/" + place + ".json"
  } else {
    return ""
  }
}

function getStateFips(stateStr: string): number {
  const state = us.lookup(stateStr)
  if (state) {
    return parseInt(state.fips)
  } else {
    return undefined
  }
}

function getStateAbbreviation(stateCode: number): string {
  const twoDigitStringCode = String(stateCode).padStart(2, "0")
  const state = us.lookup(twoDigitStringCode)
  if (typeof state === "undefined") {
    return ""
  } else {
    return state.abbr
  }
}

interface Option {
  value: number
  abbr: string
  place_name: string
  name: string
  alt_name: string
  path: string
}

export function makePlaceOptions(
  placesList: Array<{
    state_code: number
    place_name: string
    name: string
    alt_name: string
  }>
): Option[] {
  const options = []
  for (let i = 0; i < placesList.length; i++) {
    const place = placesList[i]
    if (place.state_code !== null && place.place_name !== null) {
      const abbr = getStateAbbreviation(place.state_code)
      options.push({
        value: i,
        abbr: abbr,
        place_name: place.place_name,
        name: place.name,
        alt_name: place.alt_name,
        path: getJsonUrl(place.place_name, abbr),
      })
    }
  }

  return options
}

const fuzzysortOptions = { keys: ["name", "alt_name"], threshold: -10000 }

export default function PlacePlots({
  place,
  state,
}: {
  place: string
  state: string
}): JSX.Element {
  const router = useRouter()

  const { status, data: placesList } = useFetch("/places_list.json")

  const placeOptions = useMemo(
    () => makePlaceOptions(placesList ?? []),
    [placesList]
  )
  const pathMapping = useMemo(
    () =>
      new PathMapping(
        placesList || [],
        (row) => row.place_name + "/" + row.state_code
      ),
    [placesList]
  )

  const optionVal = useMemo(
    () => pathMapping.getEntryForPath(place + "/" + state),
    [place, state, pathMapping]
  )

  const { data } = useFetch(getJsonUrl(place, state))

  const onChange = useCallback(
    (newPlace) => {
      const chosenOption = placeOptions[newPlace]
      if (chosenOption.place_name !== place || chosenOption.abbr !== state) {
        router.push(
          "/places/" +
            chosenOption.abbr +
            "/" +
            chosenOption.place_name.replace("#", "%23")
        )
      }
    },
    [place, state, placeOptions.length]
  )

  const isCounty = place
    ? place.endsWith("County") || place.endsWith("Parish")
    : false

  const { selectedUnits, unitsSelect } = makeUnitsSelect()

  const { denom, populationInput } = usePerCapitaInput()
  const perCapita = denom === "per_capita"

  return (
    <div className="mx-auto mb-10 align-center items-center flex flex-col justify-center">
      <div className="lg:grid lg:grid-cols-3 flex flex-col">
        <div className="m-4 col-span-1">
          <WindowSelectSearch
            search
            onChange={onChange}
            options={placeOptions}
            value={optionVal}
            fuzzysortOptions={fuzzysortOptions}
          />
        </div>
        <div className="mt-4 mb-1 col-span-1 text-center">
          {isCounty && <h2 className="text-2xl -mb-2">Unincorporated</h2>}
          <h1 className="text-4xl">
            {place}, {state}
          </h1>
        </div>
        <div className="col-span-1 m-4">{unitsSelect}</div>
      </div>

      <div className="w-full flex flex-row">
        <BarPlot
          data={{ table: data }}
          units={selectedUnits}
          perCapita={perCapita}
        />
      </div>
      {populationInput}
    </div>
  )
}
