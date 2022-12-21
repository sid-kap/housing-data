import { useCallback, useEffect, useMemo, useState } from "react"

import { useRouter } from "next/router"

import BarPlot from "lib/BarPlot"
import WindowSelectSearch from "lib/WindowSelectSearch"
import { getStateAbbreviation, getStateFips } from "lib/geo_helpers"
import { CurrentYearExtrapolationInfo } from "lib/projections"
import { useFetch } from "lib/queries"
import { makeUnitsSelect, usePerCapitaInput } from "lib/selects"
import { PathMapping, scoreFnWithPopulation } from "lib/utils"

type Option = {
  value: string // the path
  name: string
  alt_name: string
  population: number
}

export function makePlaceOptions(
  placesList: Array<{
    name: string
    path: string
    population: number
    alt_name: string
  }>
): [Option[], Map<string, Option>] {
  const options = []
  const optionsMap = new Map()
  for (const [i, place] of placesList.entries()) {
    const option = {
      value: place.path,
      name: place.name,
      alt_name: place.alt_name,
      population: place.population,
    }
    options.push(option)
    optionsMap[place.path] = option
  }

  return [options, optionsMap]
}

const fuzzysortOptions = {
  keys: ["name", "alt_name"],
  threshold: -10000,
  scoreFn: scoreFnWithPopulation,
}

export default function PlacePlots({
  path,
  setTitle,
}: {
  path: string
  setTitle: (string) => void
}): JSX.Element {
  const router = useRouter()
  const { status, data: placesList } = useFetch("/places_list.json")
  const [place, setPlace] = useState<Option | null>(null)

  const [options, optionsMap] = useMemo(
    () => makePlaceOptions(placesList ?? []),
    [placesList]
  )

  // When the page first loads, figure out which place we're at
  useEffect(() => {
    if (optionsMap != null && path != null) {
      const place = optionsMap[path]
      if (place) {
        setPlace(place)
        setTitle(place.name)
      }
    }
  }, [optionsMap, path])

  const onChange = useCallback(
    (newIndex) => {
      const newPlace = optionsMap[newIndex]
      router.push("/places/" + newPlace.value)
    },
    [path, options?.length]
  )
  const select = (
    <WindowSelectSearch
      search
      onChange={onChange}
      options={options ?? []}
      value={place?.value ?? path}
      fuzzysortOptions={fuzzysortOptions}
    />
  )

  return Plots({ place, select })
}

function Plots({
  place,
  select,
}: {
  place: Option | null
  select: JSX.Element
}): JSX.Element {
  const { data } = useFetch(
    place !== null ? "/places_data/" + place.value + ".json" : null
  )

  const { selectedUnits, unitsSelect } = makeUnitsSelect()

  const { denom, populationInput } = usePerCapitaInput()
  const perCapita = denom === "per_capita"

  // TODO just mark that it's the county in the JSON
  const isCounty =
    place !== null
      ? place.name.includes("County") || place.name.includes("Parish")
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
