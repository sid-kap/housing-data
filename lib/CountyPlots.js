import { useRouter } from 'next/router'
import BarPlot from './BarPlot.js'
import { useMemo, useCallback } from 'react'
import { useFetch } from './queries.js'
import us from 'us'
import WindowSelectSearch from './WindowSelectSearch.js'
import { makeUnitsSelect } from '../lib/selects.js'

const fuseOptions = {
  keys: ['name'],
  threshold: 0.1,
  distance: 5
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
  const lookupTable = {}
  const options = []
  for (let i = 0; i < countiesList.length; i++) {
    const county = countiesList[i]
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

  const { status, data: countiesList } = useFetch('/counties_list.json')

  const [countyOptions, countyLookup] = useMemo(
    () => makeCountyOptions(countiesList ?? []), [status]
  )

  const optionVal = useMemo(() => {
    const index = countyLookup[countyName + '/' + stateCode] ?? null
    if (index !== null) {
      return countyOptions[index].value
    } else {
      return null
    }
  }, [countyName, stateCode, countyLookup.length || 0])

  const url = countyName ? getJsonUrl(countyName, stateCode) : null
  const { data } = useFetch(url)

  const onChange = useCallback(
    (newCounty) => {
      const chosenOption = countyOptions[newCounty]
      if (chosenOption.county_name !== countyName || chosenOption.abbr !== stateAbbr) {
        router.push('/counties/' + chosenOption.abbr + '/' + chosenOption.county_name.replace('#', '%23'))
      }
    },
    [countyName, stateAbbr, status]
  )

  const { selectedUnits, unitsSelect } = makeUnitsSelect()

  return (
    <div className='mx-auto mb-10 align-center items-center flex flex-col justify-center'>
      <div className='lg:grid lg:grid-cols-3 flex flex-col'>
        <div className='m-4 col-span-1'>
          <WindowSelectSearch
            search
            onChange={onChange}
            options={countyOptions}
            fuseOptions={fuseOptions}
            value={optionVal?.value}
          />
        </div>
        <div className='mt-4 mb-1 col-span-1 text-center'>
          <h1 className='text-4xl'>{countyName}, {stateAbbr}</h1>
        </div>
        <div className='col-span-1 m-4'>{unitsSelect}</div>
      </div>

      <div className='w-full flex flex-row'>
        <BarPlot data={{ table: data }} units={selectedUnits} perCapita={false} />
      </div>
    </div>
  )
}
