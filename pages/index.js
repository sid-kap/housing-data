import MultiSelect from 'lib/MultiSelect'
import { useState, useMemo, useCallback } from 'react'
import { useFetch } from 'lib/queries.js'
import { VegaLite } from 'react-vega'
import { Page } from 'lib/common_elements.js'
import ContainerDimensions from 'react-container-dimensions'
import { makePlaceOptions } from 'lib/PlacePlots'
import { makeCountyOptions } from 'lib/CountyPlots'
import { makeOptions as makeMetroOptions } from 'lib/MetroPlots'
import { makeStateOptions } from 'lib/StatePlots'
import { OrderedMap } from 'immutable'
import { useQueries } from 'react-query'
import { expressionFunction } from 'vega'

/**
 * Returns a pair (year ranges, first year not in a range)
 */
function getYearRanges (grouping) {
  if (grouping === 'none') {
    return [[], 1980]
  } else if (grouping === 'five_years') {
    return [
      [
        [1980, 1984],
        [1985, 1989],
        [1990, 1994],
        [1995, 1999],
        [2000, 2004],
        [2005, 2009],
        [2010, 2014],
        [2015, 2019]
      ],
      2020
    ]
  } else if (grouping === 'five_years_old') {
    return [
      [
        [1980, 1984],
        [1985, 1989],
        [1990, 1994],
        [1995, 1999],
        [2000, 2004],
        [2005, 2009]
      ],
      2010
    ]
  } else {
    throw new Error(`Grouping type ${grouping} unknown`)
  }
}

function makeYearBuckets (grouping) {
  const [yearRanges, firstNonRangeYear] = getYearRanges(grouping)

  const yearBuckets = []
  for (const [minYear, maxYear] of yearRanges) {
    for (let year = minYear; year <= maxYear; year++) {
      const middleYear = (minYear + maxYear) / 2
      yearBuckets.push({
        year: Date.parse(`${year}`),
        binned_year: Date.parse(`${middleYear}`)
      })
    }
  }
  for (let year = firstNonRangeYear; year <= 2020; year++) {
    yearBuckets.push({
      year: Date.parse(`${year}`),
      binned_year: Date.parse(`${year}`)
    })
  }

  return yearBuckets
}

const midYearDatesThrough2010 = [
  Date.parse('1982-01-01'),
  Date.parse('1987-01-01'),
  Date.parse('1992-01-01'),
  Date.parse('1997-01-01'),
  Date.parse('2002-01-01'),
  Date.parse('2007-01-01')
]

function getYearTickValues (grouping) {
  if (grouping === 'none') {
    return null
  } else if (grouping === 'five_years') {
    return midYearDatesThrough2010.concat([
      Date.parse('2012-01-01'),
      Date.parse('2017-01-01'),
      Date.parse('2020')
    ])
  } else if (grouping === 'five_years_old') {
    return midYearDatesThrough2010.concat([
      Date.parse('2010'),
      Date.parse('2012'),
      Date.parse('2014'),
      Date.parse('2016'),
      Date.parse('2018'),
      Date.parse('2020')
    ])
  }
}

function makeYearToRangeStringMapping (grouping) {
  const yearRanges = getYearRanges(grouping)[0]

  const mapping = {}

  for (const [minYear, maxYear] of yearRanges) {
    const middleYear = (minYear + maxYear) / 2
    mapping[middleYear] = `${minYear}-${maxYear}`
  }

  return mapping
}

const yearRangeAllMapping = makeYearToRangeStringMapping('five_years')
const yearRangeOldMapping = makeYearToRangeStringMapping('five_years_old')

expressionFunction('yearRangeAllFormat', function (datum, params) {
  if (typeof datum === 'number') {
    // TODO figure out why the type is sometimes a number rather than a Date?
    datum = new Date(datum)
  }
  const year = datum.getUTCFullYear()
  return yearRangeAllMapping[year] || year.toString()
})

expressionFunction('yearRangeOldFormat', function (datum, params) {
  if (typeof datum === 'number') {
    // TODO figure out why the type is sometimes a number rather than a Date?
    datum = new Date(datum)
  }
  const year = datum.getUTCFullYear()
  return yearRangeOldMapping[year] || year.toString()
})

function spec (width, height, perCapita, interpolate, grouping) {
  const plotWidth = Math.min(width * 0.92, 936)

  const yField = perCapita ? 'total_units_per_capita_per_1000' : 'total_units'
  const yTitle = perCapita ? 'Units permitted per 1000 residents' : 'Units permitted'

  return {
    width: plotWidth,
    height: 0.75 * plotWidth,
    autosize: {
      type: 'fit',
      contains: 'padding'
    },
    transform: [
      {
        calculate: '1000 * datum[\'total_units_per_capita\']',
        as: 'total_units_per_capita_per_1000'
      },
      {
        lookup: 'year',
        from: {
          data: {
            values: makeYearBuckets(grouping),
            format: {
              parse: {
                year: 'date',
                binned_year: 'date'
              }
            }
          },
          key: 'year',
          fields: ['binned_year']
        },
        default: Date.parse('2022-01-01 13:01')
      }
    ],
    encoding: {
      x: {
        field: 'binned_year',
        type: 'temporal',
        axis: {
          title: 'Year',
          grid: false,
          labelAngle: 0,
          format: '%Y',
          formatType: {
            five_years: 'yearRangeAllFormat',
            five_years_old: 'yearRangeOldFormat',
            none: null
          }[grouping],
          values: getYearTickValues(grouping)
        }
      },
      y: {
        field: yField,
        type: 'quantitative',
        aggregate: 'mean',
        axis: {
          title: yTitle,
          titleFontSize: 13,
          labelFontSize: 14,
          titleAngle: 0,
          titleX: -50,
          titleY: -13,
          titleAlign: 'left',
          tickCount: perCapita ? 10 : null
        },
        scale: {
          domain: perCapita ? [0, 20] : null // TODO make this configurable
        }
      },
      color: { field: 'name', type: 'nominal', legend: null },
      legend: false
    },
    data: { name: 'table' }, // note: vega-lite data attribute is a plain object instead of an array
    usermeta: { embedOptions: { renderer: 'svg' } },
    layer: [
      {
        mark: {
          type: 'line',
          interpolate: interpolate ? 'monotone' : 'linear',
          clip: true,
          point: true
        },
        encoding: {
          x: {
            field: 'binned_year'
          },
          y: {
            field: yField
          }
        },
        tooltip: true,
        point: true
      },
      {
        mark: 'text',
        encoding: {
          x: { aggregate: 'max', field: 'binned_year' },
          y: { aggregate: { argmax: 'binned_year' }, field: yField },
          text: { aggregate: { argmax: 'binned_year' }, field: 'name' }
        }
      }
    ],
    legend: null,
    config: {
      customFormatTypes: true,
      text: {
        align: 'left',
        dx: 3,
        dy: 1
      }
    }
  }
}

function addPrefixes (options, prefix) {
  const newOptions = []
  for (const option of options) {
    // IDK if we want name or value... let's just go with name for now.
    newOptions.push(
      Object.assign(option, { value: prefix + '/' + option.name })
    )
  }
  return newOptions
}

function makeOptions (statesData, metrosList, countiesList, placesList) {
  const [cbsaOptions, csaOptions] = makeMetroOptions(metrosList)
  if (!((typeof cbsaOptions === 'object') && cbsaOptions.name === 'CBSAs')) {
    throw new Error('first element makeMetroOptions is not CBSAs')
  }
  if (!((typeof csaOptions === 'object') && csaOptions.name === 'CSAs')) {
    throw new Error('second element makeMetroOptions is not CSAs')
  }
  const stateOptions = makeStateOptions(statesData)
  const countyOptions = makeCountyOptions(countiesList)
  const placeOptions = makePlaceOptions(placesList)

  // TODO maybe fix this jank
  for (const item of stateOptions) {
    item.type = 'state'
  }
  for (const item of countyOptions) {
    item.type = 'county'
  }
  for (const item of placeOptions) {
    item.type = 'place'
  }
  for (const item of cbsaOptions.items) {
    item.type = 'cbsa'
  }
  for (const item of csaOptions.items) {
    item.type = 'csa'
  }

  return [
    {
      groupName: 'Places',
      items: addPrefixes(placeOptions, 'Places')
    },
    {
      groupName: 'Counties',
      items: addPrefixes(countyOptions, 'Counties')
    },
    {
      groupName: 'CBSAs',
      items: addPrefixes(cbsaOptions.items, 'CBSAs')
    },
    {
      groupName: 'CSAs',
      items: addPrefixes(csaOptions.items, 'CSAs')
    },
    {
      groupName: 'States',
      items: addPrefixes(stateOptions, 'States')
    }
  ]
}

const optionNames = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven',
  'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
  'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen', 'twenty'
]
const multiselectOptions = []
for (let i = 0; i < optionNames.length; i++) {
  multiselectOptions.push({
    name: optionNames[i],
    value: i.toString()
  })
}

function selectedItemClassFn (item) {
  if (item.type === 'place') {
    return 'bg-green-400'
  }
  if (item.type === 'county') {
    return 'bg-yellow-400'
  }
  if (item.type === 'cbsa') {
    return 'bg-pink-500'
  }
  if (item.type === 'csa') {
    return 'bg-purple-500'
  }
  if (item.type === 'state') {
    return 'bg-blue-500'
  }
  return 'bg-blue-700'
}

function getData (path) {
  return window.fetch(path).then(res => res.json())
}

function combineDatas (datas) {
  const data = datas.flatMap(d => d.data ?? [])

  const dataCopied = []
  for (const row of data) {
    const newRow = Object.assign({}, row)
    newRow.year = Date.parse(newRow.year)
    dataCopied.push(newRow)
  }
  return dataCopied
}

export default function Home () {
  const { data: statesResponse } = useFetch('/state_annual.json')
  const { data: metrosListResponse } = useFetch('/metros_list.json')
  const { data: countiesListResponse } = useFetch('/counties_list.json')
  const { data: placesListResponse } = useFetch('/places_list.json')

  const [selectedLocations, setSelectedLocations] = useState(OrderedMap())

  const options = useMemo(
    () => makeOptions(statesResponse || [], metrosListResponse || [], countiesListResponse || [], placesListResponse || []),
    [statesResponse, metrosListResponse, countiesListResponse, placesListResponse]
  )

  const datas = useQueries(
    selectedLocations.valueSeq().toArray().map((item) => {
      return {
        queryKey: item.value,
        queryFn: () => getData(item.path)
      }
    })
  )

  const data = useMemo(
    () => combineDatas(datas),
    [datas.map((res) => res.status)]
  )

  const [denom, setDenom] = useState('total')
  const setTotal = useCallback(() => setDenom('total'))
  const setPerCapita = useCallback(() => setDenom('per_capita'))

  const radioButtonLabelCss = 'ml-1 mr-3'

  const populationInput = (
    <div>
      <input type='radio' checked={denom === 'total'} id='total' onChange={setTotal} />
      <label htmlFor='total' className={radioButtonLabelCss}>Total units</label>

      <input type='radio' checked={denom === 'per_capita'} id='per_capita' onChange={setPerCapita} />
      <label htmlFor='per_capita' className={radioButtonLabelCss}>Units per capita</label>
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

  const [grouping, setGrouping] = useState('five_years')

  const groupingInput = (
    <div>
      <input type='radio' checked={grouping === 'five_years'} id='five_years' onChange={() => setGrouping('five_years')} />
      <label htmlFor='five_years' className={radioButtonLabelCss}>5-year groups</label>

      <input type='radio' checked={grouping === 'five_years_old'} id='five_years_old' onChange={() => setGrouping('five_years_old')} />
      <label htmlFor='five_years_old' className={radioButtonLabelCss}>5-year groups for old decades only</label>

      <input type='radio' checked={grouping === 'none'} id='none' onChange={() => setGrouping('none')} />
      <label htmlFor='none' className={radioButtonLabelCss}>No grouping</label>
    </div>
  )

  return (
    <Page title='Housing Data' navIndex={0}>
      <div className='flex flex-col justify-center items-center mx-auto mb-10'>

        <div className='flex m-2' />

        <div className='flex m-2'>
          <MultiSelect options={[]} groupOptions={options} onChange={setSelectedLocations} itemClassFn={selectedItemClassFn} />
        </div>

        <div className='w-full flex flex-row'>
          <ContainerDimensions>
            {({ width, height }) => (
              <VegaLite spec={spec(width, height, denom === 'per_capita', false, grouping)} data={{ table: data }} />
            )}
          </ContainerDimensions>
        </div>
        {populationInput}
        {groupingInput}

      </div>
    </Page>
  )
}
