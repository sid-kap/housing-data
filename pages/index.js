// import SelectSearch from 'react-select-search/dist/cjs'
// import WindowSelectSearch from 'lib/WindowSelectSearch'
import MultiSelect from 'lib/MultiSelect'
import { useState, useMemo, useCallback } from 'react'
import { useFetch } from '../lib/queries.js'
import { VegaLite } from 'react-vega'
import { Page } from '../lib/common_elements.js'
import ContainerDimensions from 'react-container-dimensions'
import { makePlaceOptions } from 'lib/PlacePlots'
import { makeCountyOptions } from 'lib/CountyPlots'
import { makeOptions as makeMetroOptions } from 'lib/MetroPlots'
import { makeStateOptions } from 'lib/StatePlots'
import { OrderedMap } from 'immutable'
import { useQueries } from 'react-query'
import { expressionFunction } from 'vega'

expressionFunction('yearRangeFormat', function (datum, params) {
  if (typeof datum === 'number') {
    // TODO figure out why the type is sometimes a number rather than a Date?
    datum = new Date(datum)
  }
  const year = datum.getUTCFullYear()
  return yearToRangeStringMapping[year] || year.toString()
})

const yearRanges = [
  [1980, 1984],
  [1985, 1989],
  [1990, 1994],
  [1995, 1999],
  [2000, 2004],
  [2005, 2009],
  [2010, 2014],
  [2015, 2019]
]
const yearToRangeStringMapping = {}

const yearBuckets = []
for (const [minYear, maxYear] of yearRanges) {
  for (let year = minYear; year <= maxYear; year++) {
    const middleYear = (minYear + maxYear) / 2
    yearBuckets.push({
      year: Date.parse(`${year}-01-01`),
      binned_year: Date.parse(`${middleYear}-01-01`)
    })
    yearToRangeStringMapping[middleYear] = `${minYear}-${maxYear}`
  }
}
for (let year = 2020; year <= 2020; year++) {
  yearBuckets.push({
    year: Date.parse(`${year}-01-01`),
    binned_year: Date.parse(`${year}-01-01`),
    year_range_name: `${year}`
  })
}

function spec (width, height, perCapita, interpolate) {
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
            values: yearBuckets,
            format: {
              parse: {
                year: 'date',
                binned_year: 'date'
              }
            }
          },
          key: 'year',
          fields: ['binned_year', 'year_range_name']
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
          formatType: 'yearRangeFormat',
          values: [
            Date.parse('1982-01-01'),
            Date.parse('1987-01-01'),
            Date.parse('1992-01-01'),
            Date.parse('1997-01-01'),
            Date.parse('2002-01-01'),
            Date.parse('2007-01-01'),
            Date.parse('2012-01-01'),
            Date.parse('2017-01-01'),
            // Date.parse('2010'),
            // Date.parse('2012'),
            // Date.parse('2014'),
            // Date.parse('2016'),
            // Date.parse('2018'),
            Date.parse('2020')
          ]
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

// const fuseOptions = {
//   keys: ['name'],
//   threshold: 0.1,
//   distance: 5
// }

// const options = [
//   { value: 'all', name: 'All' },
//   { value: 'region', name: 'Region' },
//   { value: 'division', name: 'Division' },
//   { value: 'state', name: 'State' }
// ]

// Region codes from https://www2.census.gov/geo/pdfs/maps-data/maps/reference/us_regdiv.pdf
// const regionOptions = [
//   { value: 'all', name: 'All' },
//   {
//     name: 'Region',
//     type: 'group',
//     items: [
//       { value: 'region_1', name: 'Northeast' },
//       { value: 'region_2', name: 'Midwest' },
//       { value: 'region_3', name: 'South' },
//       { value: 'region_4', name: 'West' }
//     ]
//   },
//   {
//     name: 'Division',
//     type: 'group',
//     items: [
//       { value: 'division_1', name: 'New England' },
//       { value: 'division_2', name: 'Middle Atlantic' },
//       { value: 'division_3', name: 'East North Central' },
//       { value: 'division_4', name: 'West North Central' },
//       { value: 'division_5', name: 'South Atlantic' },
//       { value: 'division_6', name: 'East South Central' },
//       { value: 'division_7', name: 'West South Central' },
//       { value: 'division_8', name: 'Mountain' },
//       { value: 'division_9', name: 'Pacific' }
//     ]
//   }
// ]

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

// function filterData (data, type, region) {
//   if (type !== 'all') {
//     data = data.filter((row) => row.type === type)
//   }
//   if (region !== null && region !== 'all') {
//     if (region.startsWith('region')) {
//       const regionCode = region.substring(region.length - 1)
//       data = data.filter((row) => row.region_code === regionCode)
//     } else if (region.startsWith('division')) {
//       const divisionCode = region.substring(region.length - 1)
//       data = data.filter((row) => row.division_code === divisionCode)
//     } else {
//       throw new Error(region + ' unknown')
//     }
//   }
//   return data
// }

// Not sure if I need to specify this, or if I can just use the default...
// function renderOption (domProps, option, snapshot, className) {
//   return (
//     <button className={className} {...domProps}>
//       {option.name}
//     </button>
//   )
//   // <span className='text-xs rounded bg-purple-200 p-1'>{option.metro_type.toUpperCase()}</span>
// }

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

// function makeOptionsMapping (options) {
//   // TODO: check that the options values are unique, raise error if not
//   // /onsole.log('options is:')
//   // console.log(options)

//   const result = {}
//   for (const group of options) {
//     for (const option of group.items) {
//       // e.g. "States/Texas", ""
//       if ('path' in option) {
//         result[option.value] = option.path
//       }
//     }
//   }
//   return result
// }

function getData (path) {
  // const path = optionsMap[optionValue]
  // console.log('getting data for: ' + optionValue)
  // console.log(optionsMap[optionValue])
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
  // console.log(selectedLocations.toArray())

  // const [selectedType, setSelectedOption] = useState('all')
  // const [selectedRegion, setSelectedRegion] = useState('all')

  const options = useMemo(
    () => makeOptions(statesResponse || [], metrosListResponse || [], countiesListResponse || [], placesListResponse || []),
    [statesResponse, metrosListResponse, countiesListResponse, placesListResponse]
  )

  // const optionsMap = useMemo(() => makeOptionsMapping(options), [options])

  // const regionSelect = (
  //   selectedType === 'state'
  //     ? (
  //       <div className='mx-2'>
  //         <SelectSearch
  //           options={regionOptions}
  //           defaultValue={selectedRegion}
  //           onChange={setSelectedRegion}
  //         />
  //       </div>
  //       )
  //     : <></>
  // )

  const datas = useQueries(
    selectedLocations.valueSeq().toArray().map((item) => {
      return {
        queryKey: item.value,
        queryFn: () => getData(item.path)
      }
    })
  )
  // console.log(datas)

  const data = useMemo(
    () => combineDatas(datas),
    [datas.map((res) => res.status)]
  )
  // console.log(data)
  // const data = useMemo(
  //   () => {
  //     return {
  //       table: filterData(
  //         statesResponse || [],
  //         selectedType,
  //         selectedType === 'state' ? selectedRegion : null
  //       )
  //     }
  //   },
  //   [status, selectedType, selectedRegion]
  // )

  const [denom, setDenom] = useState('total')
  const setTotal = useCallback(() => setDenom('total'))
  const setPerCapita = useCallback(() => setDenom('per_capita'))

  const populationInput = (
    <div>
      <input type='radio' checked={denom === 'total'} id='total' onChange={setTotal} />
      <label htmlFor='total' className='ml-1 mr-3'>Total units</label>
      <input type='radio' checked={denom === 'per_capita'} id='per_capita' onChange={setPerCapita} />
      <label htmlFor='per_capita' className='ml-1 mr-3'>Units per capita</label>
    </div>
  )

  const [interpolate, setInterpolate] = useState(false)
  const interpolateInput = (
    <div>
      <input type='radio' checked={!interpolate} id='no_smoothing' onChange={() => setInterpolate(false)} />
      <label htmlFor='no_smoothing' className='ml-1 mr-3'>No smoothing</label>
      <input type='radio' checked={interpolate} id='smoothing' onChange={() => setInterpolate(true)} />
      <label htmlFor='smoothing' className='ml-1 mr-3'>Smoothing</label>
    </div>
  )

  // <SelectSearch
  //   value={selectedType}
  //   onChange={setSelectedOption}
  //   options={options}
  // />
  // {regionSelect}

  // renderOption={renderOption}

  //   <WindowSelectSearch
  // search
  // multiple
  // closeOnSelect
  // onChange={() => {}}
  // options={options}
  // fuseOptions={fuseOptions}
  // value={null}
  //   />

  return (
    <Page title='Housing Data' navIndex={0}>
      <div className='flex flex-col justify-center items-center mx-auto mb-10'>

        <h1 className='mt-4 mb-2 text-4xl col-span-1 text-center'>
          Combined Plots
        </h1>

        <div className='flex m-2' />

        <div className='flex m-2'>
          <MultiSelect options={[]} groupOptions={options} onChange={setSelectedLocations} itemClassFn={selectedItemClassFn} />
        </div>

        <div className='w-full flex flex-row'>
          <ContainerDimensions>
            {({ width, height }) => (
              <VegaLite spec={spec(width, height, denom === 'per_capita', interpolate)} data={{ table: data }} />
            )}
          </ContainerDimensions>
        </div>
        {populationInput}
        {interpolateInput}

      </div>
    </Page>
  )
}
