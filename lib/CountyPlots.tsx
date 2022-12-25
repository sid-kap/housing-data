import { useCallback, useEffect, useMemo, useState } from "react"

import { useRouter } from "next/router"

import PlotsTemplate, { makeOptions } from "lib/PlotsTemplate"
import WindowSelectSearch from "lib/WindowSelectSearch"
import { useFetch } from "lib/queries"

// The schema for /counties_list.json
type RawOption = {
  name: string
  path: string
  population: number
}

type Option = {
  name: string
  value: string // the path
  population: number
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
    />
  )

  return PlotsTemplate({
    selected: county,
    select,
    jsonRoot: "/counties_data/",
  })
}
