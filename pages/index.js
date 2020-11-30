import Head from 'next/head'
import SelectSearch from 'react-select-search/dist/cjs'
import { useState } from 'react'
import { useStateData } from '../lib/data_loader.js'
import { VegaLite } from 'react-vega'
import { Nav, GitHubFooter } from '../lib/common_elements.js'
import ContainerDimensions from 'react-container-dimensions'

function spec (width, height) {
  const plotWidth = Math.min(width * 0.95, 936)

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
        field: 'total_units',
        type: 'quantitative',
        axis: {
          title: 'Units permitted (per year)'
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
            field: 'total_units'
          }
        },
        tooltip: true,
        point: true
      },
      {
        mark: 'text',
        encoding: {
          x: { aggregate: 'max', field: 'year' },
          y: { aggregate: { argmax: 'year' }, field: 'total_units' },
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

const options = [
  { value: 'all', name: 'All' },
  { value: 'country', name: 'Country' },
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

export default function Home () {
  const { response } = useStateData()

  const [selectedType, setSelectedOption] = useState('all')

  const [selectedRegion, setSelectedRegion] = useState('all')

  let regionSelect
  if (selectedType === 'state') {
    regionSelect = (
      <div className='mx-2'>
        <SelectSearch
          options={regionOptions}
          defaultValue={selectedRegion}
          onChange={setSelectedRegion}
        />
      </div>
    )
  } else {
    regionSelect = ''
  }

  const data = {
    table: filterData(
      response.data, selectedType,
      selectedType === 'state' ? selectedRegion : null
    )
  }

  return (
    <div>
      <Head>
        <title>Housing Data</title>
        <link rel='icon' href='/favicon.ico' />
        <meta name='viewport' content='width=device-width, initial-scale=1.0' />
      </Head>
      <Nav currentIndex={0} />
      <div className='flex flex-col justify-center items-center mx-auto mb-10'>

        <h1 className='mt-4 mb-2 text-4xl col-span-1 text-center'>
          Combined Plots
        </h1>

        <div className='flex m-2'>
          <SelectSearch
            value={selectedType}
            onChange={setSelectedOption}
            options={options}
          />
          {regionSelect}
        </div>

        <div className='w-full flex flex-row'>
          <ContainerDimensions>
            {({ width, height }) => (
              <VegaLite spec={spec(width, height)} data={data} />
            )}
          </ContainerDimensions>
        </div>

      </div>
      <GitHubFooter />
    </div>
  )
}
