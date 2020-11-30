import { useRouter } from 'next/router'
import Head from 'next/head'
import { VegaLite } from 'react-vega'
import { keyMapping, fieldsGenerator } from '../../lib/plots.js'
import { useMemo } from 'react'
import useFetch from 'use-http'
import useSWR from 'swr'
import WindowSelectSearch from '../../lib/WindowSelectSearch.js'
import us from 'us'
import { Nav, GitHubFooter } from '../../lib/common_elements.js'

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
  place = place.replace('#', '%23')
  return '/places_data/' + getStateFips(state) + '/' + place + '.json'
}

export default function Place () {
  const router = useRouter()

  const { response: placesListResponse } = useFetch(
    '/places_list.json',
    { data: [] }, // Default value
    []
  )

  const [placeOptions, placeLookup] = useMemo(() => {
    const placeNames = placesListResponse.data || []

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
  }, [placesListResponse.data])

  const slug = router.query.slug

  const state = slug ? slug[0] : null
  const place = slug ? slug[1] : null

  const optionVal = useMemo(() => {
    if (place !== null && state !== null) {
      const fips = getStateFips(state)
      const index = placeLookup[place + '/' + fips]
      if (typeof index !== 'undefined') {
        return placeOptions[index].value
      }
    }
    return null
  }, [place, state, placeLookup.length])

  const { data } = useSWR(
    () => place !== null ? getJsonUrl(place, state) : null
  )

  if ((typeof slug === 'undefined') || (slug.length === 0)) {
    return (
      <h1> Loading... </h1>
    )
  } else if (slug.length !== 2) {
    return (
      <h1>Bad path (sad face)</h1>
    )
  } else {
    return makePage(place, state, optionVal, data, placeOptions, placeLookup, router)
  }
}

function makePage (place, state, optionVal, filteredData, placeOptions, placeLookup, router) {
  const onChange = function (newPlace) {
    const chosenOption = placeOptions[newPlace]
    if (chosenOption.place_name !== place || chosenOption.abbr !== state) {
      router.push('/places/' + chosenOption.abbr + '/' + chosenOption.place_name.replace('#', '%23'))
    }
  }

  const fuseOptions = {
    keys: ['name'],
    threshold: 0.1,
    distance: 5
  }

  return (
    <div>
      <Head>
        <title>{place}, {state}</title>
      </Head>
      <Nav />
      <div className='mx-auto mb-10 align-center items-center flex flex-col justify-center'>
        <div className='grid grid-cols-3'>
          <div className='m-4 col-span-1'>
            <WindowSelectSearch
              search
              onChange={onChange}
              options={placeOptions}
              fuseOptions={fuseOptions}
              value={optionVal}
            />
          </div>
          <h1 className='mt-4 text-4xl col-span-1 text-center'>{place}, {state}</h1>
        </div>

        <VegaLite spec={spec()} data={{ table: filteredData }} />
      </div>
      <GitHubFooter />

    </div>
  )
}

function spec () {
  const fields = Array.from(fieldsGenerator())

  const filterFields = Array.from(fieldsGenerator(['units'], ['']))

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
        mark: 'bar',
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
          }
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
