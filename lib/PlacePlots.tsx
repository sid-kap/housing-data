import { useCallback, useEffect, useMemo, useState } from "react"

import { useRouter } from "next/router"

import PlotsTemplate from "lib/PlotsTemplate"
import WindowSelectSearch from "lib/WindowSelectSearch"
import { getStateAbbreviation, getStateFips } from "lib/geo_helpers"
import { CurrentYearExtrapolationInfo } from "lib/projections"
import { useFetch } from "lib/queries"
import { usePerCapitaInput, useUnitsSelect } from "lib/selects"
import { PathMapping, scoreFnWithPopulation } from "lib/utils"

// The schema for /places_list.json
type RawOption = {
  name: string
  path: string
  population: number
  alt_name: string
}

type Option = {
  value: string // the path
  name: string
  alt_name: string
  population: number
}

export function makeOptions(
  placesList: RawOption[]
): [Option[], Map<string, Option>] {
  const options = []
  const optionsMap = new Map()
  for (const place of placesList) {
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
  const { data: placesList } = useFetch("/places_list.json")
  const [place, setPlace] = useState<Option | null>(null)

<<<<<<< HEAD
  const [options, optionsMap] = useMemo(
    () => makeOptions(placesList ?? []),
=======
  const { data: placesList } = useFetch("/places_list.json")

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
>>>>>>> main
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
  }, [optionsMap, path, setPlace, setTitle])

  const onChange = useCallback(
    (newPath) => router.push("/places/" + newPath),
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

  return PlotsTemplate({ selected: place, select, jsonRoot: "/places_data/" })
}
