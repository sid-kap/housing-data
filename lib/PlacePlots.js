import { useFetch } from '../lib/queries.js'
import { useMemo, useCallback } from 'react'
import WindowSelectSearch from '../lib/WindowSelectSearch.js'
import BarPlot from './BarPlot.js'
import us from 'us'
import { useRouter } from 'next/router'
import { makeUnitsSelect, usePerCapitaInput } from '../lib/selects.js'

function getJsonUrl (place, state) {
  if (place === null) {
    return null
  }
  place = place.replace('#', '%23')
  return '/places_data/' + getStateFips(state) + '/' + place + '.json'
}

function getStateFips (stateStr) {
  return parseInt(us.lookup(stateStr).fips)
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

function makePlaceOptions (placesList) {
  const placeLookup = {}
  const options = []
  for (let i = 0; i < placesList.length; i++) {
    const place = placesList[i]
    if (place.state_code !== null && place.place_name !== null) {
      const abbr = getStateAbbreviation(place.state_code)
      options.push({
        value: i,
        abbr: abbr,
        place_name: place.place_name,
        name: place.place_name + ', ' + abbr
      })

      // This feels stupid but I don't know if there's a better way
      placeLookup[place.place_name + '/' + place.state_code] = i
    }
  }

  return [options, placeLookup]
}

const fuzzysortOptions = {
  keys: ['name'],
  threshold: -10000,
  scoreFn: (keysResult) => {
    // Weight by population, so that the highest population result comes first
    return keysResult[0] * keysResult.obj.log_2019_population
  }
}

export default function PlacePlots ({ place, state }) {
  const router = useRouter()

  const { status, data: placesList } = useFetch('/places_list.json')

  const [placeOptions, placeLookup] = useMemo(
    () => makePlaceOptions(placesList ?? []),
    [status]
  )

  const optionVal = useMemo(() => {
    if (place !== null && state !== null) {
      const fips = getStateFips(state)
      const index = placeLookup[place + '/' + fips]
      if (typeof index !== 'undefined') {
        return placeOptions[index].value
      }
    }
    return null
  }, [place, state, status, placeLookup.length])

  const { data } = useFetch(getJsonUrl(place, state))

  const onChange = useCallback(
    (newPlace) => {
      const chosenOption = placeOptions[newPlace]
      if (chosenOption.place_name !== place || chosenOption.abbr !== state) {
        router.push('/places/' + chosenOption.abbr + '/' + chosenOption.place_name.replace('#', '%23'))
      }
    }, [place, state, placeOptions.length]
  )

  const fuseOptions = {
    keys: ['name'],
    threshold: 0.1,
    distance: 5
  }

  const isCounty = place ? place.endsWith('County') || place.endsWith('Parish') : false

  const { selectedUnits, unitsSelect } = makeUnitsSelect()

  const { denom, populationInput } = usePerCapitaInput()
  const perCapita = denom === 'per_capita'

  return (
    <div className='mx-auto mb-10 align-center items-center flex flex-col justify-center'>
      <div className='lg:grid lg:grid-cols-3 flex flex-col'>
        <div className='m-4 col-span-1'>
          <WindowSelectSearch
            search
            onChange={onChange}
            options={placeOptions}
            fuseOptions={fuseOptions}
            value={optionVal}
            fuzzysortOptions={fuzzysortOptions}
          />
        </div>
        <div className='mt-4 mb-1 col-span-1 text-center'>
          {isCounty && <h2 className='text-2xl -mb-2'>Unincorporated</h2>}
          <h1 className='text-4xl'>{place}, {state}</h1>
        </div>
        <div className='col-span-1 m-4'>{unitsSelect}</div>
      </div>

      <div className='w-full flex flex-row'>
        <BarPlot data={{ table: data }} units={selectedUnits} perCapita={perCapita} />
      </div>
      {populationInput}
    </div>
  )
}
