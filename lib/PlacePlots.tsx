import { useCallback, useEffect, useMemo, useState } from "react"

import { useRouter } from "next/router"

import PlotsTemplate from "lib/PlotsTemplate"
import WindowSelectSearch from "lib/WindowSelectSearch"
import { useFetch } from "lib/queries"
import { scoreFnWithPopulation } from "lib/utils"

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

  const [options, optionsMap] = useMemo(
    () => makeOptions(placesList ?? []),
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
