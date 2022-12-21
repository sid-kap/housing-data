import { useCallback, useMemo, useState, useEffect } from "react"

import { useRouter } from "next/router"

import BarPlot from "lib/BarPlot"
import WindowSelectSearch from "lib/WindowSelectSearch"
import { getStateAbbreviation, getStateFips } from "lib/geo_helpers"
import { CurrentYearExtrapolationInfo } from "lib/projections"
import { useFetch } from "lib/queries"
import { makeUnitsSelect, usePerCapitaInput } from "lib/selects"
import { PathMapping, scoreFnWithPopulation } from "lib/utils"

export function getJsonUrl(place: object): string {
  // TODO move the replace into python code?
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
  const options = []
  for (const [i, place] of placesList.entries()) {
    options.push({
      value: i,
      name: place.name,
      alt_name: place.alt_name,
      path: place.path,
      population: place.population,
    })
  }

  return options
}

const fuzzysortOptions = {
  keys: ["name", "alt_name"],
  threshold: -10000,
  scoreFn: scoreFnWithPopulation,
}

export default function PlacePlots({ path, setTitle }: { path: string, setTitle: (string) => void }): JSX.Element {
  const router = useRouter()
  const { status, data: placesList } = useFetch("/places_list.json")
  const [place, setPlace] = useState<Option | null>(null)

  const placeOptions = useMemo(
    () => makePlaceOptions(placesList ?? []),
    [placesList]
  )

  // When the page first loads, figure out which place we're at
  useEffect(() => {
    console.log(path)
    if (status === "success") {
      const place = placeOptions.find((place) => place.path === "/" + path)
      if (place) {
        setPlace(place)
        setTitle(place.name)
      }
    }
  }, [status, path, placeOptions])

  const onChange = useCallback(
    (newIndex) => {
      const newPlace = placeOptions[newIndex]
      router.push("/places/" + newPlace.path)
      setPlace(newPlace)
    },
    [path, placeOptions.length]
  )
  const select = (
    <WindowSelectSearch
      search
      onChange={onChange}
      options={placeOptions}
      value={place?.value ?? 0}
      fuzzysortOptions={fuzzysortOptions}
    />
  )

  return Plots({ place, select })
}

function Plots({ place, select }: {place: Option | null, select: JSX.Element}): JSX.Element {
  const { data } = useFetch(
    place !== null ? "/places_data/" + place.path + ".json" : null
  )

  const { selectedUnits, unitsSelect } = makeUnitsSelect()

  const { denom, populationInput } = usePerCapitaInput()
  const perCapita = denom === "per_capita"

  // TODO just mark that it's the county in the JSON
  const isCounty = place !== null
    ? (place.name.includes("County") || place.name.includes("Parish"))
    : false

  return (
    <div className="mx-auto mb-10 align-center items-center flex flex-col justify-center">
      <div className="lg:grid lg:grid-cols-3 flex flex-col">
        <div className="m-4 col-span-1">{select}</div>
        <div className="mt-4 mb-1 col-span-1 text-center">
          {isCounty && <h2 className="text-2xl -mb-2">Unincorporated</h2>}
          <h1 className="text-4xl">{place?.name}</h1>
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
