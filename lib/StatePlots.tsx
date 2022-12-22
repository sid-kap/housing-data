import { useCallback, useEffect, useMemo, useState } from "react"

import { useRouter } from "next/router"

import SelectSearch from "react-select-search/dist/cjs"

import PlotsTemplate from "lib/PlotsTemplate"
import { useFetch } from "lib/queries"

type RawOption = {
  name: string
  path: string
  population: string
  type: string
}

type Option = {
  value: string // the path
  name: string
}

export function makeOptions(
  statesList: RawOption[]
): [Option[], Map<string, Option>] {
  const options = statesList.map((state) => ({
    value: state.path,
    name: state.name,
  }))

  const optionsMap = new Map(options.map((option) => [option.value, option]))

  return [options, optionsMap]
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
    () => makeOptions(statesList ?? []),
    [statesList]
  )

  // When the page first loads, figure out which state we're at
  useEffect(() => {
    if (optionsMap != null && path != null) {
      const place = optionsMap.get(path)
      if (place) {
        setState(place)
        setTitle(place.name)
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
