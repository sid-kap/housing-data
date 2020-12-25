import { useRouter } from 'next/router'
import { useFetch } from '../lib/queries.js'
import SelectSearch from 'react-select-search/dist/cjs'
import { useMemo, useState } from 'react'
import BarPlot from '../lib/BarPlot.js'

const unitsOptions = [
  { value: 'units', name: 'Units' },
  { value: 'bldgs', name: 'Buildings' },
  { value: 'value', name: 'Property value' }
]

function makeStateOptions (statesList) {
  let stateNames = (
    statesList
      .filter((row) => row.type === 'state')
      .map((row) => row.state_name)
      .filter((row) => row !== null) // TODO remove null row from data file
  )
  stateNames = Array.from(new Set(stateNames))

  return stateNames.map((state) => ({
    value: state,
    name: state
  }))
}

function prepareData (stateData, stateName) {
  const filteredData = stateData.filter(
    (row) => row.state_name === stateName
  )

  return { table: filteredData }
}

function usePerCapitaInput () {
  const [denom, setDenom] = useState('total')
  const populationInput = (
    <div>
      <input type='radio' checked={denom === 'total'} value='total' onChange={() => setDenom('total')} />
      <label htmlFor='total' className='ml-1 mr-3'>Total units</label>
      <input type='radio' checked={denom === 'per_capita'} value='per_capita' onChange={() => setDenom('per_capita')} />
      <label htmlFor='per_capita' className='ml-1 mr-3'>Units per capita</label>
    </div>
  )

  return {
    denom: denom,
    populationInput: populationInput
  }
}

function makeStateSelect (stateOptions, stateName, router) {
  return (
    <SelectSearch
      search
      value={stateName}
      onChange={(newState) =>
        newState !== stateName
          ? router.push('/states/' + newState)
          : null}
      options={stateOptions}
      placeholder='Change state...'
    />
  )
}

function makeUnitsSelect () {
  const [selectedUnits, setSelectedUnits] = useState('units')
  const unitsSelect = (
    <SelectSearch
      value={selectedUnits}
      onChange={setSelectedUnits}
      options={unitsOptions}
    />
  )
  return {
    selectedUnits, unitsSelect
  }
}

export default function StatePlots ({ stateName }) {
  const router = useRouter()

  const { status, data: stateData } = useFetch('/state_annual.json')

  const data = useMemo(
    () => prepareData(stateData ?? [], stateName),
    [status, stateName]
  )

  const stateOptions = useMemo(() => makeStateOptions(stateData ?? []), [status])

  const stateSelect = useMemo(
    () => makeStateSelect(stateOptions, stateName, router),
    [stateOptions, stateName, router]
  )
  const { selectedUnits, unitsSelect } = makeUnitsSelect()
  const { denom, populationInput } = usePerCapitaInput()

  const perCapita = denom === 'per_capita'

  return (
    <div className='flex flex-col justify-center items-center mx-auto mb-10'>

      <div className='flex flex-col lg:grid lg:grid-cols-3'>
        <div className='m-4 col-span-1'>{stateSelect}</div>

        <h1 className='mt-4 text-4xl col-span-1 text-center'>{stateName}</h1>

        <div className='col-span-1 m-4'>{unitsSelect}</div>
      </div>

      <div className='w-full flex flex-row'>
        <BarPlot data={data} units={selectedUnits} perCapita={perCapita} />
      </div>
      {populationInput}
    </div>
  )
}
