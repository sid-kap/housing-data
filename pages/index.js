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
    x: { field: 'year', type: 'temporal' },
    y: { field: '1_unit_units', type: 'quantitative' },
    color: { field: 'state_name', type: 'nominal' }
  },
  data: { name: 'table' }, // note: vega-lite data attribute is a plain object instead of an array
  usermeta: { embedOptions: { renderer: 'svg' } },
  layer: [
    {
      mark: 'line',
      encoding: {
        x: {
          field: 'year',
          scale: {
            domain: ['1980', '2025']
          }
        },
        y: {
          field: '1_unit_units'
        }
      },
      tooltip: true,
      point: true
    },
    {
      mark: 'text',
      encoding: {
        x: { aggregate: 'max', field: 'year' },
        y: { aggregate: { argmax: 'year' }, field: '1_unit_units' },
        text: { aggregate: { argmax: 'year' }, field: 'state_name' }
      }
    }
  ],
  config: {
    text: {
      align: 'left',
      dx: 3,
      dy: 1
    }
  }
}

const options = [
  { value: 'state', label: 'State' },
  { value: 'region', label: 'Region' },
  { value: 'country', label: 'Country' },
  { value: 'all', label: 'All' }
]

function filterData (data, type) {
  if (type === 'all') {
    return data
  } else {
    return data.filter((row) => row.type === type)
  }
}

export default function Home () {
  const { response } = useStateData()

  console.log(response.data)

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

  const data = { table: filterData(response.data, selectedType.value) }

  return (
    <div>
      <div className={{ ...styles.container, 'my-0': true, 'text-center': true }}>
        <Head>
          <title>Housing Data</title>
          <link rel='icon' href='/favicon.ico' />
        </Head>

        <h1 className='mt-1 mb-8 text-4xl col-span-1 text-center'>
          Combined Plots
        </h1>

        <Select
          styles={customStyles}
          defaultValue={selectedType}
          onChange={setSelectedOption}
          options={options}
        />

        <VegaLite spec={spec} data={data} />

        <p className='m-4 rounded-lg'>
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
