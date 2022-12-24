import { useCallback, useEffect, useMemo, useState } from "react"

import { useRouter } from "next/router"

import PlotsTemplate from "lib/PlotsTemplate"
import { makeOptions } from "lib/PlotsTemplate"
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
  name: string
  value: string // the path
  population: number
  alt_name: string
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
    () => makeOptions<RawOption, Option>(placesList ?? []),
    [placesList]
  )

  // When the page first loads, figure out which place we're at
  useEffect(() => {
    if (optionsMap != null && path != null) {
      const place = optionsMap.get(decodeURIComponent(path))
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
