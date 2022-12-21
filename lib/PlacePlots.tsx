import { useCallback, useEffect, useMemo, useState } from "react"

import { useRouter } from "next/router"

import BarPlot from "lib/BarPlot"
import PlotsTemplate from "lib/PlotsTemplate"
import WindowSelectSearch from "lib/WindowSelectSearch"
import { getStateAbbreviation, getStateFips } from "lib/geo_helpers"
import { CurrentYearExtrapolationInfo } from "lib/projections"
import { useFetch } from "lib/queries"
import { usePerCapitaInput, useUnitsSelect } from "lib/selects"
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
    optionsMap.set(place.path, option)
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
      const place = optionsMap.get(path)
      if (place) {
        setPlace(place)
        setTitle(place.name)
      }
    }
  }, [optionsMap, path, setTitle])

  const onChange = useCallback(
    (newPath) => {
      router.push("/places/" + newPath)
    },
    [router]
  )
  const select = (
    <WindowSelectSearch
      search
      onChange={onChange}
      options={options}
      value={place?.value}
      fuzzysortOptions={fuzzysortOptions}
    />
  )

  return PlotsTemplate({ place, select })
}
