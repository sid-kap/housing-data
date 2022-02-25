import { useMediaQuery } from "@react-hook/media-query"
import { OrderedMap } from "immutable"
import { makeCountyOptions } from "lib/CountyPlots"
import { makeOptions as makeMetroOptions } from "lib/MetroPlots"
import MultiSelect from "lib/MultiSelect"
import { makePlaceOptions } from "lib/PlacePlots"
import { makeStateOptions } from "lib/StatePlots"
import { Page } from "lib/common_elements"
import { useFetch } from "lib/queries"
import { scoreFnWithPopulation } from "lib/utils"
import { useCallback, useMemo, useState } from "react"
import ContainerDimensions from "react-container-dimensions"
import { QueryKey, UseQueryOptions, useQueries } from "react-query"
import { VegaLite } from "react-vega"
import { expressionFunction } from "vega"
import { TopLevelSpec } from "vega-lite"

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
  } else if (grouping === "five_years_old") {
    return [
      [
        [1980, 1984],
        [1985, 1989],
        [1990, 1994],
        [1995, 1999],
        [2000, 2004],
        [2005, 2009],
      ],
      2010,
    ]
  } else {
    throw new Error(`Grouping type ${grouping} unknown`)
  }
}

function makeYearBuckets(
  grouping: string
): Array<{ year: Date; binned_year: Date }> {
  const [yearRanges, firstNonRangeYear] = getYearRanges(grouping)

  const yearBuckets = []
  for (const [minYear, maxYear] of yearRanges) {
    for (let year = minYear; year <= maxYear; year++) {
      const middleYear = (minYear + maxYear) / 2
      yearBuckets.push({
        year: Date.parse(`${year}`),
        binned_year: Date.parse(`${middleYear}`),
      })
    }
  }
  for (let year = firstNonRangeYear; year <= 2021; year++) {
    yearBuckets.push({
      year: Date.parse(`${year}`),
      binned_year: Date.parse(`${year}`),
    })
  }

  return yearBuckets
}

const midYearDatesThrough2010 = [
  Date.parse("1982-01-01"),
  Date.parse("1987-01-01"),
  Date.parse("1992-01-01"),
  Date.parse("1997-01-01"),
  Date.parse("2002-01-01"),
  Date.parse("2007-01-01"),
]

function getYearTickValues(grouping) {
  if (grouping === "none") {
    return null
  } else if (grouping === "five_years") {
    return midYearDatesThrough2010.concat([
      Date.parse("2012-01-01"),
      Date.parse("2017-01-01"),
      Date.parse("2020-01-01"),
    ])
  } else if (grouping === "five_years_old") {
    return midYearDatesThrough2010.concat([
      Date.parse("2010"),
      Date.parse("2012"),
      Date.parse("2014"),
      Date.parse("2016"),
      Date.parse("2018"),
      Date.parse("2020"),
    ])
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
const yearRangeOldMapping = makeYearToRangeStringMapping("five_years_old")

expressionFunction("yearRangeAllFormat", function (datum, params) {
  if (typeof datum === "number") {
    // TODO figure out why the type is sometimes a number rather than a Date?
    datum = new Date(datum)
  }
  const year = datum.getUTCFullYear()
  return yearRangeAllMapping[year] || year.toString()
})

expressionFunction("yearRangeOldFormat", function (datum, params) {
  if (typeof datum === "number") {
    // TODO figure out why the type is sometimes a number rather than a Date?
    datum = new Date(datum)
  }
  const year = datum.getUTCFullYear()
  return yearRangeOldMapping[year] || year.toString()
})

function spec(
  width: number,
  height: number,
  perCapita: boolean,
  interpolate: boolean,
  grouping: string,
  isWide: boolean
): TopLevelSpec {
  const plotWidth = Math.min(width * 0.92, 936)

  const yField = perCapita ? "total_units_per_capita_per_1000" : "total_units"
  const yTitle = perCapita
    ? "Units permitted per 1000 residents per year"
    : "Units permitted per year"

  return {
    width: plotWidth,
    height: 0.75 * plotWidth,
    autosize: {
      type: "fit",
      contains: "padding",
    },
    transform: [
      {
        calculate: "1000 * datum['total_units_per_capita']",
        as: "total_units_per_capita_per_1000",
      },
      {
        lookup: "year",
        from: {
          data: {
            values: makeYearBuckets(grouping),
            format: {
              parse: {
                year: "date",
                binned_year: "date",
              },
            },
          },
          key: "year",
          fields: ["binned_year"],
        },
        default: Date.parse("2022-01-01 13:01"),
      },
    ],
    encoding: {
      x: {
        field: "binned_year",
        type: "temporal",
        axis: {
          title: "Year",
          grid: false,
          format: "%Y",
          formatType: {
            five_years: "yearRangeAllFormat",
            five_years_old: "yearRangeOldFormat",
            none: null,
          }[grouping],
          values: getYearTickValues(grouping),
          labelOverlap: isWide ? "greedy" : false,
          labelAngle: isWide ? 0 : 45,
        },
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
          interpolate: interpolate ? "monotone" : "linear",
          clip: true,
          point: true,
          tooltip: true,
        },
        encoding: {
          x: {
            field: "binned_year",
          },
          y: {
            field: yField,
          },
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

function addPrefixes(options, prefix, use_metro_name_suffix = false) {
  const newOptions = []
  for (const option of options) {
    // IDK if we want name or value... let's just go with name for now.
    const changes: { value: string; name?: string } = {
      value: prefix + "/" + option.name,
    }
    if (use_metro_name_suffix) {
      changes.name = option.name_with_suffix
    }
    newOptions.push(Object.assign(option, changes))
  }
  return newOptions
}

function makeOptions(statesData, metrosList, countiesList, placesList) {
  const [msaOptions, csaOptions]: [any, any] = makeMetroOptions(metrosList)
  if (!(typeof msaOptions === "object" && msaOptions.name === "MSAs")) {
    throw new Error("first element makeMetroOptions is not MSAs")
  }
  if (!(typeof csaOptions === "object" && csaOptions.name === "CSAs")) {
    throw new Error("second element makeMetroOptions is not CSAs")
  }
  const stateOptions: any[] = makeStateOptions(statesData)
  const countyOptions: any[] = makeCountyOptions(countiesList)
  const placeOptions: any[] = makePlaceOptions(placesList)

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

  return [
    {
      groupName: "Places",
      items: addPrefixes(placeOptions, "Places"),
    },
    {
      groupName: "Counties",
      items: addPrefixes(countyOptions, "Counties"),
    },
    // I've filtered out the μSAs, so we can use MSA and CBSA interchangeably.
    // Most people know what an MSA is but not a CBSA, so we should use that name.
    // TODO: replace "CBSA" with "MSA" throughout the code base and the published
    // data files.
    {
      groupName: "MSAs",
      items: addPrefixes(msaOptions.items, "MSAs", true),
    },
    {
      groupName: "CSAs",
      items: addPrefixes(csaOptions.items, "CSAs", true),
    },
    {
      groupName: "States",
      items: addPrefixes(stateOptions, "States"),
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
  const data = datas.flatMap((d) => d.data ?? [])

  const dataCopied = []
  for (const row of data) {
    const newRow = Object.assign({}, row)
    newRow.year = Date.parse(newRow.year)
    dataCopied.push(newRow)
  }

  return dataCopied
}

type Option = {
  value: number
  path: string
}

const fuzzysortOptions = {
  keys: ["name"],
  threshold: -10000,
  scoreFn: scoreFnWithPopulation,
}

export default function Home(): JSX.Element {
  const { data: statesResponse } = useFetch("/state_annual.json")
  const { data: metrosListResponse } = useFetch("/metros_list.json")
  const { data: countiesListResponse } = useFetch("/counties_list.json")
  const { data: placesListResponse } = useFetch("/places_list.json")

  const [selectedLocations, setSelectedLocations] = useState(
    OrderedMap<string, Option>()
  )

  const options = useMemo(
    () =>
      makeOptions(
        statesResponse || [],
        metrosListResponse || [],
        countiesListResponse || [],
        placesListResponse || []
      ),
    [
      statesResponse,
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
        queryFn: () => getData(item.path),
      }
    })
  const datas: any = useQueries(queries)

  const data = useMemo(
    () => combineDatas(datas),
    [datas.map((res) => res.status)]
  )

  const [denom, setDenom] = useState("total")
  const setTotal = useCallback(() => setDenom("total"), [])
  const setPerCapita = useCallback(() => setDenom("per_capita"), [])

  const radioButtonLabelCss = "ml-1 mr-3"

  const populationInput = (
    <div>
      <input
        type="radio"
        checked={denom === "total"}
        id="total"
        onChange={setTotal}
      />
      <label htmlFor="total" className={radioButtonLabelCss}>
        Total units
      </label>

      <input
        type="radio"
        checked={denom === "per_capita"}
        id="per_capita"
        onChange={setPerCapita}
      />
      <label htmlFor="per_capita" className={radioButtonLabelCss}>
        Units per capita
      </label>
    </div>
  )

  // const [interpolate, setInterpolate] = useState(false)
  // const interpolateInput = (
  //   <div>
  //     <input type='radio' checked={!interpolate} id='no_smoothing' onChange={() => setInterpolate(false)} />
  //     <label htmlFor='no_smoothing' className='ml-1 mr-3'>No smoothing</label>
  //     <input type='radio' checked={interpolate} id='smoothing' onChange={() => setInterpolate(true)} />
  //     <label htmlFor='smoothing' className='ml-1 mr-3'>Smoothing</label>
  //   </div>
  // )

  const [grouping, setGrouping] = useState("five_years")

  const groupingInput = (
    <div>
      <input
        type="radio"
        checked={grouping === "five_years"}
        id="five_years"
        onChange={() => setGrouping("five_years")}
      />
      <label htmlFor="five_years" className={radioButtonLabelCss}>
        5-year averages
      </label>

      <input
        type="radio"
        checked={grouping === "none"}
        id="none"
        onChange={() => setGrouping("none")}
      />
      <label htmlFor="none" className={radioButtonLabelCss}>
        No averaging
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
                  denom === "per_capita",
                  false,
                  grouping,
                  isMediumOrWider
                )}
                data={{ table: data }}
              />
            )}
          </ContainerDimensions>
        </div>
        {populationInput}
        {groupingInput}
      </div>
    </Page>
  )
}
