import { useRouter } from 'next/router'
import { fieldsGenerator, makeBarChartSpec } from './plots.js'
import { useMemo } from 'react'
import useSWR from 'swr'
import us from 'us'
import ContainerDimensions from 'react-container-dimensions'

import { VegaLite } from 'react-vega'
import WindowSelectSearch from './WindowSelectSearch.js'

const fields = Array.from(fieldsGenerator())
const filterFields = Array.from(fieldsGenerator(['units'], [''], ['']))

function spec (width, height) {
  // TODO add dropdown for units/property value
  return makeBarChartSpec(fields, 'units', filterFields, width, height, false)
}

function getStateAbbreviation (stateCode) {
  const twoDigitStringCode = String(stateCode).padStart(2, 0)
  const state = us.lookup(twoDigitStringCode)
  if (typeof state === 'undefined') {
    return ''
  } else {
    return state.abbr
  }
}

function getJsonUrl (county, stateCode) {
  county = county.replace('#', '%23')
  return '/counties_data/' + stateCode + '/' + county + '.json'
}

function makeCountyOptions (countiesList) {
  const countyNames = countiesList || []

  const lookupTable = {}
  const options = []
  for (let i = 0; i < countyNames.length; i++) {
    const county = countyNames[i]
    const abbr = getStateAbbreviation(county.state_code)
    options.push({
      value: i,
      abbr: abbr,
      county_name: county.county_name,
      name: county.county_name + ', ' + abbr
    })

    // This feels stupid but I don't know if there's a better way
    lookupTable[county.county_name + '/' + county.state_code] = i
  }

  return [options, lookupTable]
}

export default function CountyPlots ({ countyName, stateAbbr, stateCode }) {
  const router = useRouter()

  const { data: countiesList } = useSWR('/counties_list.json')

  const [countyOptions, countyLookup] = useMemo(() => makeCountyOptions(countiesList), [countiesList])

  const optionVal = useMemo(() => {
    const index = countyLookup[countyName + '/' + stateCode]
    if (typeof index !== 'undefined') {
      return countyOptions[index].value
    }
  }, [countyName, stateCode, countyLookup.length || 0])

  const { data } = useSWR(getJsonUrl(countyName, stateCode))

  return makePage(countyName, stateAbbr, optionVal, data, countyOptions, countyLookup, router)
}

function makePage (county, state, optionVal, filteredData, countyOptions, countyLookup, router) {
  const onChange = function (newCounty) {
    const chosenOption = countyOptions[newCounty]
    if (chosenOption.county_name !== county || chosenOption.abbr !== state) {
      router.push('/counties/' + chosenOption.abbr + '/' + chosenOption.county_name.replace('#', '%23'))
    }
  }

  const fuseOptions = {
    keys: ['name'],
    threshold: 0.1,
    distance: 5
  }

  return (
    <div className='mx-auto mb-10 align-center items-center flex flex-col justify-center'>
      <div className='lg:grid lg:grid-cols-5 flex flex-col'>
        <div className='m-4 col-span-1'>
          <WindowSelectSearch
            search
            onChange={onChange}
            options={countyOptions}
            fuseOptions={fuseOptions}
            value={optionVal}
          />
        </div>
        <div className='mt-4 mb-1 col-span-3 text-center'>
          <h1 className='text-4xl'>{county}, {state}</h1>
        </div>
      </div>

      <div className='w-full flex flex-row'>
        <ContainerDimensions>
          {
        ({ width, height }) => (
          <VegaLite spec={spec(width, height)} data={{ table: filteredData }} />
        )
      }
        </ContainerDimensions>
      </div>
    </div>
  )
}
