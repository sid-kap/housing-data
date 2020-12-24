import { useRouter } from 'next/router'
import Head from 'next/head'
import { VegaLite } from 'react-vega'
import { fieldsGenerator, makeBarChartSpec } from '../../lib/plots.js'
import { useMemo, useCallback } from 'react'
import { useFetch } from '../../lib/queries.js'
import WindowSelectSearch from '../../lib/WindowSelectSearch.js'
import us from 'us'
import { Nav, GitHubFooter } from '../../lib/common_elements.js'
import ContainerDimensions from 'react-container-dimensions'

const fields = Array.from(fieldsGenerator())
const filterFields = Array.from(fieldsGenerator(['units'], [''], ['']))

function spec (width, height) {
  // TODO Add dropdown for buildings/value
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

function getStateFips (stateStr) {
  return parseInt(us.lookup(stateStr).fips)
}

function getJsonUrl (place, state) {
  if (place === null) {
    return null
  }
  place = place.replace('#', '%23')
  return '/places_data/' + getStateFips(state) + '/' + place + '.json'
}

export default function Place () {
  const router = useRouter()

  const { data: placesListResponse } = useFetch('/places_list.json')

  const [placeOptions, placeLookup] = useMemo(() => {
    const placeNames = placesListResponse || []

    const lookupTable = {}
    const options = []
    for (let i = 0; i < placeNames.length; i++) {
      const place = placeNames[i]
      if (place.state_code !== null && place.place_name !== null) {
        const abbr = getStateAbbreviation(place.state_code)
        options.push({
          value: i,
          abbr: abbr,
          place_name: place.place_name,
          name: place.place_name + ', ' + abbr
        })

        // This feels stupid but I don't know if there's a better way
        lookupTable[place.place_name + '/' + place.state_code] = i
      }
    }

    return [options, lookupTable]
  }, [placesListResponse])

  const [state, place] = router.query.slug ?? [null, null]

  const optionVal = useMemo(() => {
    if (place !== null && state !== null) {
      const fips = getStateFips(state)
      const index = placeLookup[place + '/' + fips]
      if (typeof index !== 'undefined') {
        return placeOptions[index].value
      }
    }
    return null
  }, [place, state, placeLookup.length || 0])

  const { data } = useFetch(getJsonUrl(place, state))

  const onChange = useCallback(
    (newPlace) => {
      const chosenOption = placeOptions[newPlace]
      if (chosenOption.place_name !== place || chosenOption.abbr !== state) {
        router.push('/places/' + chosenOption.abbr + '/' + chosenOption.place_name.replace('#', '%23'))
      }
    }, [place, state]
  )

  const fuseOptions = {
    keys: ['name'],
    threshold: 0.1,
    distance: 5
  }

  const isCounty = place ? place.endsWith('County') || place.endsWith('Parish') : false

  return (
    <div>
      <Head>
        <title>{place ? place + ', ' + state : 'Housing Data'}</title>
        <meta name='viewport' content='width=device-width, initial-scale=1.0' />
      </Head>
      <Nav currentIndex={4} />
      <div className='mx-auto mb-10 align-center items-center flex flex-col justify-center'>
        <div className='lg:grid lg:grid-cols-5 flex flex-col'>
          <div className='m-4 col-span-1'>
            <WindowSelectSearch
              search
              onChange={onChange}
              options={placeOptions}
              fuseOptions={fuseOptions}
              value={optionVal}
            />
          </div>
          <div className='mt-4 mb-1 col-span-3 text-center'>
            {isCounty && <h2 className='text-2xl -mb-2'>Unincorporated</h2>}
            <h1 className='text-4xl'>{place}, {state}</h1>
          </div>
        </div>

        <div className='w-full flex flex-row'>
          <ContainerDimensions>
            {
          ({ width, height }) => (
            <VegaLite spec={spec(width, height)} data={{ table: data }} />
          )
        }
          </ContainerDimensions>
        </div>
      </div>
      <GitHubFooter />

    </div>
  )
  // <div className='w-full flex flex-row box-border border border-black-1 items-center align-center' >
}
