import { useRouter } from 'next/router'
import Head from 'next/head'
import { useStateData } from '../../lib/data_loader.js'
import SelectSearch from 'react-select-search/dist/cjs'
import { useState, useEffect } from 'react'
import { VegaLite } from 'react-vega'
import { Nav, GitHubFooter } from '../../lib/common_elements.js'
import { fieldsGenerator, keyMapping } from '../../lib/plots.js'

const fields = Array.from(fieldsGenerator())

function spec (units) {
  const filterFields = Array.from(fieldsGenerator([units], ['']))

  return {
    width: 800,
    height: 600,
    encoding: {
      x: {
        field: 'year',
        type: 'temporal',
        axis: { title: 'Year' }
      },
      y: { field: 'value', type: 'quantitative', axis: { title: 'Units permitted' } },
      color: { field: 'key', type: 'nominal', axis: { title: 'Unit count' } }
    },
    scales: [
      {
        name: 'legend_labels',
        type: 'nominal',
        domain: ['1_unit_units', '2_units_units', '3_to_4_units_units', '5_plus_units_units'],
        range: ['1 unit', '2 units', '3-4 units', '5+ units']
      }
    ],
    transform: [
      { fold: fields },
      {
        filter: {
          field: 'key',
          oneOf: filterFields
        }
      },
      {
        calculate: JSON.stringify(keyMapping) + '[datum.key] || "Error"',
        as: 'key_pretty_printed'
      }
    ],
    data: { name: 'table' }, // note: vega-lite data attribute is a plain object instead of an array
    usermeta: { embedOptions: { renderer: 'svg' } },
    layer: [
      {
        mark: {
          type: 'bar',
          tooltip: { content: 'data' }
        },
        encoding: {
          x: {
            field: 'year'
          },
          y: {
            field: 'value'
          },
          color: {
            field: 'key_pretty_printed',
            scale: {
              scheme: 'tableau10'
            }
          },
          tooltip: [
            { field: 'year', type: 'temporal', scale: { type: 'utc' }, timeUnit: 'utcyear', title: 'Year' },
            { field: '1_unit_units', title: '1 unit', format: ',' },
            { field: '2_units_units', title: '2 unit', format: ',' },
            { field: '3_to_4_units_units', title: '3-4 units', format: ',' },
            { field: '5_plus_units_units', title: '5+ units', format: ',' },
            { field: 'total_units', title: 'Total units', format: ',' }
          ]
        },
        tooltip: true
      }
    ],
    config: {
      bar: {
        continuousBandSize: 10
      }
    }
  }
}

const unitsOptions = [
  { value: 'units', name: 'Units' },
  { value: 'bldgs', name: 'Buildings' },
  { value: 'value', name: 'Property value' }
]

const customStyles = {
  container: (provided) => ({
    ...provided,
    width: 50
  })
}

const statePickerStyles = {
  container: (provided) => ({
    ...provided,
    width: 300
  })
}

export default function State () {
  const router = useRouter()
  const { state: stateName } = router.query

  const { response } = useStateData()

  const filteredData = response.data.filter(
    (row) => row.state_name === stateName
  )

  const data = { table: filteredData }

  const [selectedUnits, setSelectedUnits] = useState('units')

  const [stateOptions, setStateOptions] = useState([])

  useEffect(() => {
    let stateNames = response.data
      .filter((row) => row.type === 'state')
      .map((row) => row.state_name)
      .filter((row) => row != null)
    stateNames = Array.from(new Set(stateNames))
    setStateOptions(
      stateNames.map((state) => ({
        value: state,
        name: state
      }))
    )
  }, [response.status])

  return (
    <div>
      <Head>
        <title>{stateName}</title>
      </Head>

      <Nav currentIndex={1} />

      <div className='flex flex-col justify-center items-center mx-auto mb-10'>

        <div className='grid grid-cols-3'>
          <div className='m-4 col-span-1'>
            <SelectSearch
              search
              styles={statePickerStyles}
              value={stateName}
              onChange={(newState) =>
                newState !== stateName
                  ? router.push('/states/' + newState)
                  : null}
              options={stateOptions}
              placeholder='Change state...'
            />
          </div>

          <h1 className='mt-4 text-4xl col-span-1 text-center'>{stateName}</h1>

          <div className='col-span-1 m-4'>
            <SelectSearch
              styles={customStyles}
              value={selectedUnits}
              onChange={setSelectedUnits}
              options={unitsOptions}
            />
          </div>
        </div>

        <VegaLite spec={spec(selectedUnits)} data={data} />
      </div>
      <GitHubFooter />
    </div>
  )
}
