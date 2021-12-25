import { useRouter } from "next/router"
import BarPlot from "lib/BarPlot.js"
import { useMemo, useEffect, useCallback } from "react"
import { useFetch } from "lib/queries.js"
import WindowSelectSearch from "lib/WindowSelectSearch"
import { makeUnitsSelect, usePerCapitaInput } from "lib/selects.js"
import { PathMapping } from "lib/utils.ts"

function getJsonUrl(metro) {
  if (metro === null || typeof metro === "undefined") {
    return null
  }
  metro = metro.replace("#", "%23")
  return "/metros_data/" + metro + ".json"
}

export function makeOptions(metrosListResponse) {
  const metroNames = metrosListResponse || []

  const cbsaOptions = []
  const csaOptions = []

  for (const metro of metroNames) {
    const option = {
      value: metro.path,
      name: metro.metro_name,
      path: getJsonUrl(metro.path),
      metro_type: metro.metro_type,
      county_names: metro.county_names,
    }

    if (metro.metro_type === "cbsa") {
      cbsaOptions.push(option)
    } else if (metro.metro_type === "csa") {
      csaOptions.push(option)
    } else {
      throw new Error("Unknown metro_type: " + metro.metro_type)
    }
  }

  const options = [
    {
      name: "CBSAs",
      type: "group",
      items: cbsaOptions,
    },
    {
      name: "CSAs",
      type: "group",
      items: csaOptions,
    },
  ]

  return options
}

function renderOption(domProps, option, snapshot, className) {
  return (
    <button className={className} {...domProps}>
      {option.name}
    </button>
  )
  // <span className='text-xs rounded bg-purple-200 p-1'>{option.metro_type.toUpperCase()}</span>
}

const fuseOptions = {
  keys: ["name"],
  threshold: 0.1,
  distance: 5,
}

export default function MetroPlots({ metroPath, setTitle }) {
  const router = useRouter()

  const { data: metrosList } = useFetch("/metros_list.json")

  const metroOptions = useMemo(() => makeOptions(metrosList), [metrosList])
  const pathMapping = useMemo(
    () => new PathMapping(metrosList || []),
    [metrosList]
  )

  const optionVal = useMemo(
    () => pathMapping.getEntryForPath(metroPath),
    [metroPath, pathMapping]
  )

  useEffect(
    () => setTitle(optionVal?.metro_name ?? "Housing Data"),
    [optionVal]
  )

  const { data } = useFetch(getJsonUrl(metroPath))

  const onChange = useCallback(
    (newMetro) => {
      if (newMetro !== metroPath) {
        router.push("/metros/" + newMetro.replace("#", "%23"))
      }
    },
    [metroPath]
  )

  /* eslint-disable */
  const countyList = useMemo(() => {
    return optionVal ? (
      <div className="max-w-3xl text-sm mt-4">
        (The <b>{optionVal.metro_name}</b> {optionVal.metro_type.toUpperCase()}{" "}
        includes {formatCountiesList(optionVal.county_names)}.)
      </div>
    ) : (
      <></>
    )
  }, [optionVal])
  /* eslint-enable */

  const { selectedUnits, unitsSelect } = makeUnitsSelect()

  const { denom, populationInput } = usePerCapitaInput()
  const perCapita = denom === "per_capita"

  return (
    <div className="mx-auto mb-10 align-center items-center flex flex-col justify-center">
      <div className="lg:grid lg:grid-cols-3 flex flex-col">
        <div className="m-4 col-span-1">
          <WindowSelectSearch
            search
            onChange={onChange}
            options={metroOptions}
            fuseOptions={fuseOptions}
            value={optionVal?.value}
            renderOption={renderOption}
          />
        </div>
        <div className="mt-4 mb-1 col-span-1 text-center">
          <h1 className="text-4xl">{optionVal?.metro_name ?? ""}</h1>
        </div>
        <div className="col-span-1 m-4">{unitsSelect}</div>
      </div>

      <div className="w-full flex flex-row">
        <BarPlot
          data={{ table: data }}
          units={selectedUnits}
          perCapita={perCapita}
        />
      </div>
      {populationInput}
      {countyList}
    </div>
  )
}

function formatCountiesList(counties) {
  // Special handling for long list of counties (if there are 3 or more)
  // TODO handle parishes?
  let ending
  let threeOrMoreNames
  if (counties.every((str) => str.endsWith(" County"))) {
    threeOrMoreNames = counties.map((str) => str.substring(0, str.length - 7))
    ending = " Counties"
  } else if (counties.every((str) => str.endsWith(" Parish"))) {
    threeOrMoreNames = counties.map((str) => str.substring(0, str.length - 7))
    ending = " Parishes"
  } else {
    threeOrMoreNames = counties
    ending = ""
  }

  if (counties.length === 1) {
    return counties[0]
  } else if (counties.length === 2) {
    return counties[0] + " and " + counties[1]
  } else {
    return (
      threeOrMoreNames.slice(0, threeOrMoreNames.length - 1).join(", ") +
      ", and " +
      threeOrMoreNames[threeOrMoreNames.length - 1] +
      ending
    )
  }
}
