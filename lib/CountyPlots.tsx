import { useCallback, useEffect, useMemo, useState } from "react"

import { useRouter } from "next/router"

import PlotsTemplate, { makeOptions } from "lib/PlotsTemplate"
import WindowSelectSearch from "lib/WindowSelectSearch"
import { useFetch } from "lib/queries"
import { scoreFnWithPopulation } from "lib/utils"

// The schema for /counties_list.json
type RawOption = {
  name: string
  path: string
  population: number
  alt_name: string
  has_ca_hcd_data: boolean
}

type Option = {
  name: string
  value: string // the path
  population: number
  alt_name: string
  has_ca_hcd_data: boolean
}

const fuzzysortOptions = {
  keys: ["name", "alt_name"],
  threshold: -10000,
  scoreFn: scoreFnWithPopulation,
}

export default function CountyPlots({
  path,
  setTitle,
}: {
  path: string
  setTitle: (string) => void
}): JSX.Element {
  const router = useRouter()
  const { data: countiesList } = useFetch("/counties_list.json")
  const [county, setCounty] = useState<Option | null>(null)

  const [options, optionsMap] = useMemo(
    () => makeOptions<RawOption, Option>(countiesList ?? []),
    [countiesList]
  )

  // When the page first loads, figure out which county we're at
  useEffect(() => {
    if (optionsMap != null && path != null) {
      const county = optionsMap.get(decodeURIComponent(path))
      if (county) {
        setCounty(county)
        setTitle(county.name)
      }
    }
  }, [optionsMap, path, setCounty, setTitle])

  const onChange = useCallback(
    (newPath) => router.push("/counties/" + newPath),
    [router]
  )
  const select = (
    <WindowSelectSearch
      search
      onChange={onChange}
      options={options}
      value={county?.value}
      fuzzysortOptions={fuzzysortOptions}
    />
  )

  return PlotsTemplate({
    selected: county,
    select,
    jsonRoot: "/counties_data/",
  })
}
