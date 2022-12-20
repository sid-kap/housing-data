import { useCallback, useMemo } from "react"

import { useRouter } from "next/router"

import BarPlot from "lib/BarPlot"
import WindowSelectSearch from "lib/WindowSelectSearch"
import { getStateAbbreviation, getStateFips } from "lib/geo_helpers"
import { CurrentYearExtrapolationInfo } from "lib/projections"
import { useFetch } from "lib/queries"
import { makeUnitsSelect, usePerCapitaInput } from "lib/selects"
import { PathMapping, scoreFnWithPopulation } from "lib/utils"

export function getJsonUrl(place: object): string {
  return "/places_data/" + place.path.replace("#", "%23") + ".json"
}

type Option = {
  value: number
  abbr: string
  place_name: string
  name: string
  alt_name: string
  path: string
  population: number
}

export function makePlaceOptions(
  placesList: Array<{
    state_code: number
    place_name: string
    name: string
    alt_name: string
    population: number
  }>
): Option[] {
  console.log(placesList)
  const options = []
  for (let i = 0; i < placesList.length; i++) {
    const place = placesList[i]
    const abbr = getStateAbbreviation(place.state_code)
    if (
      typeof place.state_code === "string" &&
      place.state_code.includes("CA-")
    ) {
      console.log(place)
    }
    /* if (place.name.includes("Toronto")) {
     *   console.log(place)
     *   console.log({
     *     value: i,
     *     abbr: abbr,
     *     place_name: place.place_name,
     *     name: place.name,
     *     alt_name: place.alt_name,
     *     path: getJsonUrl(place),
     *     population: place.population,
     *   })
     * } */
    /* console.log(i) */
    options.push({
      value: i,
      abbr: abbr,
      place_name: place.place_name,
      name: place.name,
      alt_name: place.alt_name,
      path: getJsonUrl(place),
      population: place.population,
    })
  }

  for (let op of options) {
    if (op.name.includes("Vancouver")) {
      console.log(op)
    }
  }

  return options
}

const fuzzysortOptions = {
  keys: ["name", "alt_name"],
  threshold: -10000,
  scoreFn: scoreFnWithPopulation,
}

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

  for (let place of placesList ?? []) {
    if (place.stateCode === "CA-ON") {
      console.log(place)
    }
  }

  const optionVal = useMemo(
    () => pathMapping.getEntryForPath(place + "/" + state),
    [place, state, pathMapping]
  )

  console.log(place)
  const { data } = useFetch(
    place !== null ? "/places_data/" + place + ".json" : null
  )

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
      <CurrentYearExtrapolationInfo />
    </div>
  )
}
