import { useMemo, useState } from "react"

import { useMediaQuery } from "@react-hook/media-query"
import { OrderedMap } from "immutable"
import ContainerDimensions from "react-container-dimensions"
import { useQueries } from "react-query"
import { VegaLite } from "react-vega"
import { expressionFunction } from "vega"
import { TopLevelSpec } from "vega-lite"
import { Transform } from "vega-lite/src/transform"

import { makeMetroOptions } from "lib/MetroPlots"
import MultiSelect from "lib/MultiSelect"
import { DownloadData, makeOptions } from "lib/PlotsTemplate"
import { Page } from "lib/common_elements"
import { useFetch } from "lib/queries"
import {
  HcdDataInfo,
  usePerCapitaInput,
  usePreferHcdDataInput,
} from "lib/selects"
import { scoreFnWithPopulation } from "lib/utils"

const MAX_YEAR = 2024

/**
 * Returns a pair (year ranges, first year not in a range)
 */
function getYearRanges(grouping: string): [Array<[number, number]>, number] {
  if (grouping === "none") {
    return [[], 1980]
  } else if (grouping === "five_years") {
    return [
      [
        [1980, 1984],
        [1985, 1989],
        [1990, 1994],
        [1995, 1999],
        [2000, 2004],
        [2005, 2009],
        [2010, 2014],
        [2015, 2019],
      ],
      2020,
    ]
  } else {
    throw new Error(`Grouping type ${grouping} unknown`)
  }
}

/**
 * If grouping == "five_years", returns a mapping from each year to
 * the middle year of the bucket the year gets mapped to.
 *
 * If grouping == "none", returns a mapping from each year to itself.
 */
function makeYearBuckets(
  grouping: string
): Array<{ year: Date; binned_year: Date }> {
  const [yearRanges, firstNonRangeYear] = getYearRanges(grouping)

  const yearBuckets = []
  for (const [minYear, maxYear] of yearRanges) {
    for (let year = minYear; year <= maxYear; year++) {
      const middleYear = (minYear + maxYear) / 2
      yearBuckets.push({
        year: year,
        binned_year: middleYear,
      })
    }
  }
  for (let year = firstNonRangeYear; year <= MAX_YEAR; year++) {
    yearBuckets.push({
      year: year,
      binned_year: year,
    })
  }

  return yearBuckets
}

function getYearTickValues(grouping) {
  if (grouping === "none") {
    return null
  } else if (grouping === "five_years") {
    return [1982, 1987, 1992, 1997, 2002, 2007, 2012, 2017, 2020, 2024]
  }
}

function makeYearToRangeStringMapping(grouping: string): Map<number, string> {
  const yearRanges = getYearRanges(grouping)[0]

  const mapping = new Map()

  for (const [minYear, maxYear] of yearRanges) {
    const middleYear = (minYear + maxYear) / 2
    mapping[middleYear] = `${minYear}-${maxYear}`
  }

  return mapping
}

const yearRangeAllMapping = makeYearToRangeStringMapping("five_years")

/*eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }]*/
expressionFunction("yearRangeAllFormat", function (datum, _) {
  return yearRangeAllMapping[datum] || datum.toString()
})

/*eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }]*/
expressionFunction("yearFormat", function (datum, _) {
  return datum.toString()
})

function spec(
  width: number,
  height: number,
  perCapita: boolean,
  preferHcdData: boolean,
  grouping: string,
  isWide: boolean
): TopLevelSpec {
  const plotWidth = Math.min(width * 0.92, 936)

  const yField = perCapita ? "total_units_per_capita_per_1000" : "total_units"
  const yTitle = perCapita
    ? "Units permitted per 1000 residents per year"
    : "Units permitted per year"

  const transforms: Transform[] = []
  if (preferHcdData) {
    // We don't have value data in the HCD dataset, so only do the substitution for buildings and units.
    for (const type of ["bldgs", "units"]) {
      for (const suffix of ["", "_per_capita"]) {
        const prefix = `total_${type}`
        transforms.push({
          calculate: `datum['${prefix}_hcd${suffix}'] || datum['${prefix}${suffix}'] || 0`,
          as: `${prefix}${suffix}`,
        })
      }
    }
  }
  transforms.push(
    ...[
      {
        calculate: "1000 * datum['total_units_per_capita']",
        as: "total_units_per_capita_per_1000",
      },
      // Look up "binned_year" for each year.
      // i.e. if grouping == "five_years", the middle year of the 5-year range,
      // if grouping == "none", the year itself.
      {
        lookup: "year",
        from: {
          data: {
            values: makeYearBuckets(grouping),
            format: {
              parse: {
                year: "number",
                binned_year: "number",
              },
            },
          },
          key: "year",
          fields: ["binned_year"],
        },
        default: MAX_YEAR,
      },
    ]
  )

  return {
    width: plotWidth,
    height: 0.75 * plotWidth,
    autosize: {
      type: "fit",
      contains: "padding",
    },
    transform: transforms,
    encoding: {
      x: {
        field: "binned_year",
        type: "quantitative",
        axis: {
          title: "Year",
          grid: false,
          formatType: {
            five_years: "yearRangeAllFormat",
            none: "yearFormat",
          }[grouping],
          values: getYearTickValues(grouping),
          labelOverlap: isWide ? "greedy" : false,
          labelAngle: isWide ? 0 : 45,
        },
        scale: { nice: false },
      },
      y: {
        field: yField,
        type: "quantitative",
        aggregate: "mean",
        axis: {
          title: yTitle,
          titleFontSize: 13,
          labelFontSize: 14,
          titleAngle: 0,
          titleX: -50,
          titleY: -13,
          titleAlign: "left",
          tickCount: perCapita ? 10 : null,
        },
        scale: {
          domain: perCapita ? [0, 20] : null, // TODO make this configurable
        },
      },
      color: { field: "name", type: "nominal", legend: null },
    },
    data: { name: "table" }, // note: vega-lite data attribute is a plain object instead of an array
    usermeta: { embedOptions: { renderer: "svg" } },
    layer: [
      {
        mark: {
          type: "line",
          clip: true,
          point: true,
          tooltip: true,
        },
        encoding: {
          x: { field: "binned_year" },
          y: { field: yField },
        },
      },
      {
        mark: "text",
        encoding: {
          x: { aggregate: "max", field: "binned_year" },
          y: { aggregate: { argmax: "binned_year" }, field: yField },
          text: { aggregate: { argmax: "binned_year" }, field: "name" },
        },
      },
    ],
    config: {
      customFormatTypes: true,
      text: {
        align: "left",
        dx: 3,
        dy: 1,
      },
    },
  }
}

function addPathPrefixes(options: any[], prefix: string): any[] {
  return options.map(({ value, ...rest }) => ({
    value: prefix + "/" + value,
    ...rest,
  }))
}

function makeAllOptions(statesList, metrosList, countiesList, placesList) {
  const [msaOptions, csaOptions, cmaOptions]: [any, any, any] =
    makeMetroOptions(metrosList)[0]
  if (!(typeof msaOptions === "object" && msaOptions.name === "MSAs")) {
    throw new Error("first element makeMetroOptions is not MSAs")
  }
  if (!(typeof csaOptions === "object" && csaOptions.name === "CSAs")) {
    throw new Error("second element makeMetroOptions is not CSAs")
  }
  const stateOptions: any[] = makeOptions(statesList)[0]
  const countyOptions: any[] = makeOptions(countiesList)[0]
  const placeOptions: any[] = makeOptions(placesList)[0]

  // TODO maybe fix this jank
  for (const item of stateOptions) {
    item.type = "state"
  }
  for (const item of countyOptions) {
    item.type = "county"
  }
  for (const item of placeOptions) {
    item.type = "place"
  }
  for (const item of msaOptions.items) {
    item.type = "msa"
  }
  for (const item of csaOptions.items) {
    item.type = "csa"
  }
  for (const item of cmaOptions.items) {
    // For now color CMAs the same as MSAs, since they're basically
    // the same thing. TODO maybe make this less hacky
    item.type = "msa"
  }

  return [
    {
      groupName: "Places",
      items: addPathPrefixes(placeOptions, "places_data"),
    },
    {
      groupName: "Counties",
      items: addPathPrefixes(countyOptions, "counties_data"),
    },
    {
      groupName: "MSAs",
      items: addPathPrefixes(
        msaOptions.items.concat(cmaOptions.items),
        "metros_data"
      ),
    },
    {
      groupName: "CSAs",
      items: addPathPrefixes(csaOptions.items, "metros_data"),
    },
    {
      groupName: "States",
      items: addPathPrefixes(stateOptions, "states_data"),
    },
  ]
}

function selectedItemClassFn(item) {
  if (item.type === "place") {
    return "bg-green-400"
  }
  if (item.type === "county") {
    return "bg-yellow-400"
  }
  if (item.type === "msa") {
    return "bg-pink-500"
  }
  if (item.type === "csa") {
    return "bg-purple-500"
  }
  if (item.type === "state") {
    return "bg-blue-500"
  }
  return "bg-blue-700"
}

function getData(path: string): object {
  return window.fetch(path).then(async (res) => await res.json())
}

function combineDatas(datas) {
  const data = datas
    .flatMap((d) => d.data ?? [])
    .filter((d) => parseInt(d.year) <= MAX_YEAR)

  return data
}

type Option = {
  value: number
  path: string
  has_ca_hcd_data: boolean
}

const fuzzysortOptions = {
  keys: ["name", "alt_name"],
  threshold: -10000,
  scoreFn: scoreFnWithPopulation,
}

export default function Home(): JSX.Element {
  const { data: statesListResponse } = useFetch("/states_list.json")
  const { data: metrosListResponse } = useFetch("/metros_list.json")
  const { data: countiesListResponse } = useFetch("/counties_list.json")
  const { data: placesListResponse } = useFetch("/places_list.json")

  const [selectedLocations, setSelectedLocations] = useState(
    OrderedMap<string, Option>()
  )

  const options = useMemo(
    () =>
      makeAllOptions(
        statesListResponse || [],
        metrosListResponse || [],
        countiesListResponse || [],
        placesListResponse || []
      ),
    [
      statesListResponse,
      metrosListResponse,
      countiesListResponse,
      placesListResponse,
    ]
  )

  const queries = selectedLocations
    .valueSeq()
    .toArray()
    .map((item) => {
      return {
        queryKey: [item.value],
        queryFn: () => getData(item.value + ".json"),
      }
    })
  const datas: any = useQueries(queries)

  const data = useMemo(
    () => combineDatas(datas),
    [datas.map((res) => res.status)]
  )

  const { denom, perCapitaInput } = usePerCapitaInput()
  const perCapita = denom === "per_capita"

  const { preferHcdData, preferHcdDataInput } = usePreferHcdDataInput()

  type Grouping = "five_years" | "none"

  const [grouping, setGrouping] = useState<Grouping>("five_years")

  const groupingInput = (
    <div>
      <label className="mr-3">
        <input
          type="radio"
          checked={grouping === "five_years"}
          onChange={() => setGrouping("five_years")}
        />
        <span className="ml-1">5-year averages</span>
      </label>

      <label className="mr-3">
        <input
          type="radio"
          checked={grouping === "none"}
          onChange={() => setGrouping("none")}
        />
        <span className="ml-1">No averaging</span>
      </label>
    </div>
  )

  const isMediumOrWider = useMediaQuery("only screen and (min-width: 768px)")

  return (
    <Page title="Housing Data" navIndex={0}>
      <div className="flex flex-col justify-center items-center mx-auto mb-10">
        <div className="flex m-2" />

        <div className="flex m-2">
          <MultiSelect
            options={[]}
            groupOptions={options}
            onChange={setSelectedLocations}
            itemClassFn={selectedItemClassFn}
            fuzzysortOptions={fuzzysortOptions}
          />
        </div>

        <div className="w-full flex flex-row">
          <ContainerDimensions>
            {({ width, height }) => (
              <VegaLite
                spec={spec(
                  width,
                  height,
                  perCapita,
                  preferHcdData,
                  grouping,
                  isMediumOrWider
                )}
                data={{ table: data }}
              />
            )}
          </ContainerDimensions>
        </div>
        {perCapitaInput}
        {groupingInput}
        {selectedLocations.some((l) => l.has_ca_hcd_data) && preferHcdDataInput}
        <DownloadData data={data} name="housing data comparisons.json" />
        {selectedLocations.some((l) => l.has_ca_hcd_data) && <HcdDataInfo />}
      </div>
    </Page>
  )
}
