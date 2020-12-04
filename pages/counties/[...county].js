import { useRouter } from 'next/router'
import Head from 'next/head'
import { VegaLite } from 'react-vega'
import { fieldsGenerator, makeBarChartSpec } from '../../lib/plots.js'
import { useMemo } from 'react'
import useSWR from 'swr'
import WindowSelectSearch from '../../lib/WindowSelectSearch.js'
import us from 'us'
import { Nav, GitHubFooter } from '../../lib/common_elements.js'
import ContainerDimensions from 'react-container-dimensions'

const fields = Array.from(fieldsGenerator())
const filterFields = Array.from(fieldsGenerator(['units'], ['']))

function spec (width, height) {
  return makeBarChartSpec(fields, filterFields, width, height)
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

function getJsonUrl (county, state) {
  if (county === null) {
    return null
  }
  county = county.replace('#', '%23')
  return '/counties_data/' + getStateFips(state) + '/' + county + '.json'
}

export default function County () {
  const router = useRouter()

  const { data: countysListResponse } = useSWR('/counties_list.json')

  const [countyOptions, countyLookup] = useMemo(() => {
    const countyNames = countysListResponse || []

    const lookupTable = {}
    const options = []
    for (let i = 0; i < countyNames.length; i++) {
      const county = countyNames[i]
      if (county.state_code !== null && county.county_name !== null) {
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
    }

    return [options, lookupTable]
  }, [countysListResponse])

  const slug = router.query.county

  const state = slug ? slug[0] : null
  const county = slug ? slug[1] : null

  const optionVal = useMemo(() => {
    if (county !== null && state !== null) {
      const fips = getStateFips(state)
      const index = countyLookup[county + '/' + fips]
      if (typeof index !== 'undefined') {
        return countyOptions[index].value
      }
    }
    return null
  }, [county, state, countyLookup.length || 0])

  const { data } = useSWR(getJsonUrl(county, state))

  if ((typeof slug === 'undefined') || (slug.length === 0)) {
    return (
      <h1> Loading... </h1>
    )
  } else if (slug.length !== 2) {
    return (
      <h1>Bad path (sad face)</h1>
    )
  } else {
    return makePage(county, state, optionVal, data, countyOptions, countyLookup, router)
  }
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
    <div>
      <Head>
        <title>{county}, {state}</title>
        <meta name='viewport' content='width=device-width, initial-scale=1.0' />
      </Head>
      <Nav currentIndex={2} />
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
      <GitHubFooter />

    </div>
  )
  // <div className='w-full flex flex-row box-border border border-black-1 items-center align-center' >
}
