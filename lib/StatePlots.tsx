import { useMemo, useState, useEffect, useCallback } from "react"

import { useRouter } from "next/router"

import SelectSearch from "react-select-search/dist/cjs"
import { PlainObject } from "react-vega/src/types"

import BarPlot from "lib/BarPlot"
import PlotsTemplate from "lib/PlotsTemplate"
import { CurrentYearExtrapolationInfo } from "lib/projections"
import { useFetch } from "lib/queries"
import { usePerCapitaInput, useUnitsSelect } from "lib/selects"

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

export function makeOptions(statesList: RawOption[]): [Option[], Map<string, Option>] {
  const options = statesList.map((state) => ({value: state.path, name: state.name}))

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
  const { status, data: statesList } = useFetch("/states_list.json")
  const [state, setState] = useState<Option | null>(null)

  const [options, optionsMap] = useMemo(
    () => makeOptions(statesList ?? []),
    [statesList]
  )
  console.log(statesList, options, optionsMap)

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
  console.log(path, state)

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
