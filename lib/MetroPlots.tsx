import { useCallback, useEffect, useMemo, useState } from "react"

import { useRouter } from "next/router"

import PlotsTemplate, { makeOptions } from "lib/PlotsTemplate"
import WindowSelectSearch from "lib/WindowSelectSearch"
import { useFetch } from "lib/queries"
import { scoreFnWithPopulation } from "lib/utils"

type RawOption = {
  name: string
  path: string
  population: number
  alt_name: string
  metro_type: string
  county_names: string[]
}

type Option = {
  name: string
  value: string // the path
  population: number
  alt_name: string
  metro_type: string
  county_names: string[]
}

type OptionGroup = {
  name: string
  type: string
  items: Option[]
}

export function makeMetroOptions(
  metrosList: RawOption[]
): [[OptionGroup, OptionGroup, OptionGroup], Map<string, Option>] {
  const [msaOptions, msaOptionsMap] = makeOptions<RawOption, Option>(
    metrosList.filter((m) => m.metro_type === "msa")
  )
  const [csaOptions, csaOptionsMap] = makeOptions<RawOption, Option>(
    metrosList.filter((m) => m.metro_type === "csa")
  )
  const [cmaOptions, cmaOptionsMap] = makeOptions<RawOption, Option>(
    metrosList.filter((m) => m.metro_type === "cma")
  )

  const options: [OptionGroup, OptionGroup, OptionGroup] = [
    { name: "MSAs", type: "group", items: msaOptions },
    { name: "CSAs", type: "group", items: csaOptions },
    { name: "Canada metros", type: "group", items: cmaOptions },
  ]
  return [
    options,
    new Map([...msaOptionsMap, ...csaOptionsMap, ...cmaOptionsMap]),
  ]
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
  keys: ["name", "alt_name"],
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
    () => makeMetroOptions(metrosList ?? []),
    [metrosList]
  )

  // When the page first loads, figure out which place we're at
  useEffect(() => {
    if (optionsMap != null && path != null) {
      const place = optionsMap.get(decodeURIComponent(path))
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
