import SelectSearch from 'react-select-search/dist/cjs'
import WindowSelectSearch from 'lib/WindowSelectSearch'
import MultiSelect from 'lib/MultiSelect'
import { useState, useMemo, useCallback } from 'react'
import { useFetch } from '../lib/queries.js'
import { VegaLite } from 'react-vega'
import { Page } from '../lib/common_elements.js'
import ContainerDimensions from 'react-container-dimensions'

function spec (width, height, perCapita) {
  const plotWidth = Math.min(width * 0.92, 936)

  const yField = perCapita ? 'total_units_per_capita' : 'total_units'
  const yTitle = perCapita ? 'Units permitted per capita (per year)' : 'Units permitted (per year)'

  return {
    width: plotWidth,
    height: 0.75 * plotWidth,
    autosize: {
      type: 'fit',
      contains: 'padding'
    },
    encoding: {
      x: { field: 'year', type: 'temporal', axis: { title: 'Year' } },
      y: {
        field: yField,
        type: 'quantitative',
        axis: {
          title: yTitle
        }
      },
      color: { field: 'state_name', type: 'nominal', legend: null },
      legend: false
    },
    data: { name: 'table' }, // note: vega-lite data attribute is a plain object instead of an array
    usermeta: { embedOptions: { renderer: 'svg' } },
    layer: [
      {
        mark: 'line',
        encoding: {
          x: {
            field: 'year'
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
          x: { aggregate: 'max', field: 'year' },
          y: { aggregate: { argmax: 'year' }, field: yField },
          text: { aggregate: { argmax: 'year' }, field: 'state_name' }
        }
      }
    ],
    legend: null,
    config: {
      text: {
        align: 'left',
        dx: 3,
        dy: 1
      }
    }
  }
}

const fuseOptions = {
  keys: ['name'],
  threshold: 0.1,
  distance: 5
}

const options = [
  { value: 'all', name: 'All' },
  { value: 'region', name: 'Region' },
  { value: 'division', name: 'Division' },
  { value: 'state', name: 'State' }
]

// Region codes from https://www2.census.gov/geo/pdfs/maps-data/maps/reference/us_regdiv.pdf
const regionOptions = [
  { value: 'all', name: 'All' },
  {
    name: 'Region',
    type: 'group',
    items: [
      { value: 'region_1', name: 'Northeast' },
      { value: 'region_2', name: 'Midwest' },
      { value: 'region_3', name: 'South' },
      { value: 'region_4', name: 'West' }
    ]
  },
  {
    name: 'Division',
    type: 'group',
    items: [
      { value: 'division_1', name: 'New England' },
      { value: 'division_2', name: 'Middle Atlantic' },
      { value: 'division_3', name: 'East North Central' },
      { value: 'division_4', name: 'West North Central' },
      { value: 'division_5', name: 'South Atlantic' },
      { value: 'division_6', name: 'East South Central' },
      { value: 'division_7', name: 'West South Central' },
      { value: 'division_8', name: 'Mountain' },
      { value: 'division_9', name: 'Pacific' }
    ]
  }
]

function makeOptions (statesData, metrosList, countiesList, placesList) {
  const stateOptions = []
  const cbsaOptions = []
  const csaOptions = []
  const countyOptions = []
  const placeOptions = []

  for (const metro of metrosList) {
    const option = {
      value: metro.path,
      name: metro.metro_name,
      path: metro.path
    }
    switch (metro.metro_type) {
      case 'cbsa': {
        cbsaOptions.push(option)
        break
      }
      case 'csa': {
        csaOptions.push(option)
        break
      }
      default: {
        throw new Error('Unknown metro_type: ' + metro.metro_type)
      }
    }
  }

  return [
    {
      name: 'CBSAs',
      type: 'group',
      items: cbsaOptions
    },
    {
      name: 'CSAs',
      type: 'group',
      items: cbsaOptions
    }
  ]
}

function filterData (data, type, region) {
  if (type !== 'all') {
    data = data.filter((row) => row.type === type)
  }
  if (region !== null && region !== 'all') {
    if (region.startsWith('region')) {
      const regionCode = region.substring(region.length - 1)
      data = data.filter((row) => row.region_code === regionCode)
    } else if (region.startsWith('division')) {
      const divisionCode = region.substring(region.length - 1)
      data = data.filter((row) => row.division_code === divisionCode)
    } else {
      throw new Error(region + ' unknown')
    }
  }
  return data
}

// Not sure if I need to specify this, or if I can just use the default...
function renderOption (domProps, option, snapshot, className) {
  return (
    <button className={className} {...domProps}>
      {option.name}
    </button>
  )
  // <span className='text-xs rounded bg-purple-200 p-1'>{option.metro_type.toUpperCase()}</span>
}

export default function Home () {
  const { status, data: statesResponse } = useFetch('/state_annual.json')
  const { metrosListStatus, data: metrosListResponse } = useFetch('/metros_list.json')
  const { countiesListStatus, data: countiesListResponse } = useFetch('/counties_list.json')
  const { placesListStatus, data: placesListResponse } = useFetch('/places_list.json')

  const [selectedType, setSelectedOption] = useState('all')

  const [selectedRegion, setSelectedRegion] = useState('all')

  const options = useMemo(
    () => makeOptions(statesResponse || [], metrosListResponse || [], countiesListResponse || [], placesListResponse || []),
    [statesResponse, metrosListResponse, countiesListResponse, placesListResponse]
  )

  const regionSelect = (
    selectedType === 'state'
      ? (
        <div className='mx-2'>
          <SelectSearch
            options={regionOptions}
            defaultValue={selectedRegion}
            onChange={setSelectedRegion}
          />
        </div>
        )
      : <></>
  )

  const data = useMemo(
    () => {
      return {
        table: filterData(
          statesResponse || [],
          selectedType,
          selectedType === 'state' ? selectedRegion : null
        )
      }
    },
    [status, selectedType, selectedRegion]
  )

  const [denom, setDenom] = useState('total')
  const setTotal = useCallback(() => setDenom('total'))
  const setPerCapita = useCallback(() => setDenom('per_capita'))

  const populationInput = (
    <div>
      <input type='radio' checked={denom === 'total'} value='total' onChange={setTotal} />
      <label htmlFor='total' className='ml-1 mr-3'>Total units</label>
      <input type='radio' checked={denom === 'per_capita'} value='per_capita' onChange={setPerCapita} />
      <label htmlFor='per_capita' className='ml-1 mr-3'>Units per capita</label>
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
          <MultiSelect />
        </div>

        <div className='w-full flex flex-row'>
          <ContainerDimensions>
            {({ width, height }) => (
              <VegaLite spec={spec(width, height, denom === 'per_capita')} data={data} />
            )}
          </ContainerDimensions>
        </div>
        {populationInput}

      </div>
    </Page>
  )
}
