import Head from 'next/head'
import styles from '../styles/Home.module.css'
import Select from 'react-select'
import { useState } from 'react'
import { useStateData } from '../lib/data_loader.js'
import { VegaLite } from 'react-vega'
import { GitHubFooter } from '../lib/common_elements.js'

const spec = {
  width: 800,
  height: 600,
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

const options = [
  { value: 'all', label: 'All' },
  { value: 'country', label: 'Country' },
  { value: 'region', label: 'Region' },
  { value: 'division', label: 'Division' },
  { value: 'state', label: 'State' }
]

// Region codes from https://www2.census.gov/geo/pdfs/maps-data/maps/reference/us_regdiv.pdf
const regionOptions = [
  {
    label: 'All',
    options: [
      { value: 'all', label: 'All' }
    ]
  },
  {
    label: 'Region',
    options: [
      { value: ['region', '1'], label: 'Northeast' },
      { value: ['region', '2'], label: 'Midwest' },
      { value: ['region', '3'], label: 'South' },
      { value: ['region', '4'], label: 'West' }
    ]
  },
  {
    label: 'Division',
    options: [
      { value: ['division', '1'], label: 'New England' },
      { value: ['division', '2'], label: 'Middle Atlantic' },
      { value: ['division', '3'], label: 'East North Central' },
      { value: ['division', '4'], label: 'West North Central' },
      { value: ['division', '5'], label: 'South Atlantic' },
      { value: ['division', '6'], label: 'East South Central' },
      { value: ['division', '7'], label: 'West South Central' },
      { value: ['division', '8'], label: 'Mountain' },
      { value: ['division', '9'], label: 'Pacific' }
    ]
  }
]

function filterData (data, type, region) {
  if (type !== 'all') {
    data = data.filter((row) => row.type === type)
  }
  if (region !== null && region !== 'all') {
    if (region[0] === 'region') {
      data = data.filter((row) => row.region_code === region[1])
    } else if (region[0] === 'division') {
      data = data.filter((row) => row.division_code === region[1])
    } else {
      throw new Error(region + ' unknown')
    }
  }
  return data
}

export default function Home () {
  const { response } = useStateData()

  const [selectedType, setSelectedOption] = useState({
    value: 'all',
    label: 'All'
  })
  const customStyles = {
    container: (provided) => ({
      ...provided,
      width: 150
    })
  }
  const regionStyles = {
    container: (provided) => ({
      ...provided,
      width: 200
    })
  }

  const [selectedRegion, setSelectedRegion] = useState({
    value: 'all',
    label: 'All'
  })

  let regionSelect
  if (selectedType.value === 'state') {
    regionSelect = (
      <Select
        styles={regionStyles}
        options={regionOptions}
        defaultValue={selectedRegion}
        onChange={setSelectedRegion}
        className='m-2'
      />
    )
  } else {
    regionSelect = ''
  }

  const data = {
    table: filterData(
      response.data, selectedType.value,
      selectedType.value === 'state' ? selectedRegion.value : null
    )
  }

  return (
    <div>
      <div className={styles.container}>
        <Head>
          <title>Housing Data</title>
          <link rel='icon' href='/favicon.ico' />
        </Head>

        <h1 className='mt-1 mb-8 text-4xl col-span-1 text-center'>
          Combined Plots
        </h1>

        <div className='flex'>
          <Select
            styles={customStyles}
            defaultValue={selectedType}
            onChange={setSelectedOption}
            options={options}
            className='m-2'
          />
          {regionSelect}
        </div>

        <VegaLite spec={spec} data={data} />

        <p className='m-4 rounded-lg text-center'>
          (The more interesting stuff is in the is&nbsp;
          <a
            href='/states/Alabama'
            className='text-blue-500 hover:text-blue-300'
          >
            state-level charts
          </a>
          .)
        </p>
      </div>
      <GitHubFooter />
    </div>
  )
}
