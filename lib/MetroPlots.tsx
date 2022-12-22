import { useCallback, useEffect, useMemo, useState } from "react"

import { useRouter } from "next/router"

import BarPlot from "lib/BarPlot"
import PlotsTemplate from "lib/PlotsTemplate"
import WindowSelectSearch from "lib/WindowSelectSearch"
import { CurrentYearExtrapolationInfo } from "lib/projections"
import { useFetch } from "lib/queries"
import { usePerCapitaInput, useUnitsSelect } from "lib/selects"
import { PathMapping, scoreFnWithPopulation } from "lib/utils"

type RawOption = {
  name: string
  path: string
  metro_type: string
  county_names: string[]
  population: number
}

type Option = {
  value: string // the path
  name: string
  metro_type: string
  county_names: string[]
  population: number
}

type Group<T> = {
  name: string
  type: string
  items: T[]
}

export function makeOptions(
  metrosList: RawOption[]
): [[Group<Option>, Group<Option>], Map<string, Option>] {
  const msaOptions = []
  const csaOptions = []
  const optionsMap = new Map()

  for (const metro of metrosList) {
    const option = {
      value: metro.path,
      name: metro.name,
      metro_type: metro.metro_type,
      county_names: metro.county_names,
      population: metro.population,
    }

    if (metro.metro_type === "msa") {
      msaOptions.push(option)
    } else if (metro.metro_type === "csa") {
      csaOptions.push(option)
    } else {
      throw new Error("Unknown metro_type: " + metro.metro_type)
    }
    optionsMap.set(metro.path, option)
  }

  const options: [Group<Option>, Group<Option>] = [
    {
      name: "MSAs",
      type: "group",
      items: msaOptions,
    },
    {
      name: "CSAs",
      type: "group",
      items: csaOptions,
    },
  ]
  return [options, optionsMap]
}

function renderOption(
  domProps,
  option: Option,
  snapshot,
  className: string
): JSX.Element {
  return (
    <button className={className} {...domProps}>
      {option.name}
    </button>
  )
  // <span className='text-xs rounded bg-purple-200 p-1'>{option.metro_type.toUpperCase()}</span>
}

const fuzzysortOptions = {
  keys: ["name"],
  threshold: -10000,
  scoreFn: scoreFnWithPopulation,
}

export default function MetroPlots({
  path,
  setTitle,
}: {
  path: string
  setTitle: (title: string) => void
}): JSX.Element {
  const router = useRouter()
  const { data: metrosList } = useFetch("/metros_list.json")
  const [metro, setMetro] = useState<Option | null>(null)

  const [options, optionsMap] = useMemo(
    () => makeOptions(metrosList ?? []),
    [metrosList]
  )

  // When the page first loads, figure out which place we're at
  useEffect(() => {
    if (optionsMap != null && path != null) {
      const place = optionsMap.get(path)
      if (place) {
        setMetro(place)
        setTitle(place.name)
      }
    }
  }, [optionsMap, path, setMetro, setTitle])

  const onChange = useCallback(
    (newPath) => router.push("/metros/" + newPath),
    [router]
  )

  /* eslint-disable */
  const countyList = useMemo(() => {
    return metro != null ? (
      <div className="max-w-3xl text-sm mt-4">
        (The <b>{metro.name}</b> {metro.metro_type.toUpperCase()} includes{" "}
        {formatCountiesList(metro.county_names)}.)
      </div>
    ) : (
      <></>
    )
  }, [metro])

  const select = (
    <WindowSelectSearch
      search
      onChange={onChange}
      options={options}
      value={metro?.value}
      renderOption={renderOption}
      fuzzysortOptions={fuzzysortOptions}
    />
  )

  return PlotsTemplate({
    selected: metro,
    select,
    jsonRoot: "/metros_data/",
    countyList,
  })
}

function formatCountiesList(counties: string[]): string {
  // Special handling for long list of counties (if there are 3 or more)
  // TODO handle parishes?
  const sortedCounties = counties.concat().sort()

  let ending
  let threeOrMoreNames
  if (sortedCounties.every((str) => str.endsWith(" County"))) {
    threeOrMoreNames = sortedCounties.map((str) =>
      str.substring(0, str.length - 7)
    )
    ending = " Counties"
  } else if (sortedCounties.every((str) => str.endsWith(" Parish"))) {
    threeOrMoreNames = sortedCounties.map((str) =>
      str.substring(0, str.length - 7)
    )
    ending = " Parishes"
  } else {
    threeOrMoreNames = sortedCounties
    ending = ""
  }

  if (sortedCounties.length === 1) {
    return counties[0]
  } else if (sortedCounties.length === 2) {
    return sortedCounties[0] + " and " + sortedCounties[1]
  } else {
    return (
      threeOrMoreNames.slice(0, threeOrMoreNames.length - 1).join(", ") +
      ", and " +
      threeOrMoreNames[threeOrMoreNames.length - 1] +
      ending
    )
  }
}
