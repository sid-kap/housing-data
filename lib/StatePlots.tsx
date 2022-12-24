import { useCallback, useEffect, useMemo, useState } from "react"

import { useRouter } from "next/router"

import SelectSearch from "react-select-search/dist/cjs"

import PlotsTemplate, { makeOptions } from "lib/PlotsTemplate"
import { useFetch } from "lib/queries"

type RawOption = {
  name: string
  path: string
  population: string
  type: string
}

type Option = {
  name: string
  value: string // the path
  population: string
  type: string
}

export default function StatePlots({
  path,
  setTitle,
}: {
  path: string
  setTitle: (string) => void
}): JSX.Element {
  const router = useRouter()
  const { data: statesList } = useFetch("/states_list.json")
  const [state, setState] = useState<Option | null>(null)

  const [options, optionsMap] = useMemo(
    () => makeOptions<RawOption, Option>(statesList ?? []),
    [statesList]
  )

  // When the page first loads, figure out which state we're at
  useEffect(() => {
    if (optionsMap != null && path != null) {
      const state = optionsMap.get(decodeURIComponent(path))
      if (state) {
        setState(state)
        setTitle(state.name)
      }
    }
  }, [optionsMap, path, setState, setTitle])

  const onChange = useCallback(
    (newPath) => router.push("/states/" + newPath),
    [router]
  )
  const select = (
    <SelectSearch
      search
      onChange={onChange}
      options={options}
      value={state?.value}
      placeholder="Change state..."
    />
  )

  return PlotsTemplate({ selected: state, select, jsonRoot: "/states_data/" })
}
