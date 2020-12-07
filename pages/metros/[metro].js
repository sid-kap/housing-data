import { useRouter } from 'next/router'
import Head from 'next/head'
import { VegaLite } from 'react-vega'
import { fieldsGenerator, makeBarChartSpec } from '../../lib/plots.js'
import { useMemo } from 'react'
import useSWR from 'swr'
import WindowSelectSearch from '../../lib/WindowSelectSearch.js'
import { Nav, GitHubFooter } from '../../lib/common_elements.js'
import ContainerDimensions from 'react-container-dimensions'

const fields = Array.from(fieldsGenerator())
const filterFields = Array.from(fieldsGenerator(['units'], ['']))

function spec (width, height) {
  return makeBarChartSpec(fields, filterFields, width, height)
}

function getJsonUrl (metro) {
  if (metro === null || (typeof metro === 'undefined')) {
    return null
  }
  metro = metro.replace('#', '%23')
  return '/metros_data/' + metro + '.json'
}

function makeOptions (metrosListResponse) {
  const metroNames = metrosListResponse || []

  const lookupTable = {}
  const cbsaOptions = []
  const csaOptions = []

  for (let i = 0; i < metroNames.length; i++) {
    const metro = metroNames[i]
    const option = {
      value: metro.path,
      name: metro.metro_name,
      path: metro.path,
      metro_type: metro.metro_type,
      county_names: metro.county_names
    }

    lookupTable[metro.path] = i

    if (metro.metro_type === 'cbsa') {
      cbsaOptions.push(option)
    } else if (metro.metro_type === 'csa') {
      csaOptions.push(option)
    } else {
      throw new Error('Unknown metro_type: ' + metro.metro_type)
    }
  }

  const options = [
    {
      name: 'CBSAs',
      type: 'group',
      items: cbsaOptions
    },
    {
      name: 'CSAs',
      type: 'group',
      items: csaOptions
    }
  ]

  return [options, lookupTable]
}

export default function Metro ({ metroPath }) {
  const router = useRouter()

  const { data: metrosListResponse } = useSWR('/metros_list.json')

  const [metroOptions, metroLookup] = useMemo(
    () => makeOptions(metrosListResponse),
    [metrosListResponse]
  )

  const optionVal = useMemo(
    () => lookup(metroLookup, metrosListResponse, metroPath),
    [metroPath, metrosListResponse]
  )

  const { data } = useSWR(getJsonUrl(metroPath))

  return makePage(metroPath, optionVal, metrosListResponse, metroLookup, data, metroOptions, router)
}

function renderOption (domProps, option, snapshot, className) {
  return (
    <button className={className} {...domProps}>
      {option.name}
    </button>
  )
  // <span className='text-xs rounded bg-purple-200 p-1'>{option.metro_type.toUpperCase()}</span>
}

function lookup (metroLookup, metrosList, metroPath) {
  if (typeof metrosList === 'undefined') {
    return null
  }
  const i = metroLookup[metroPath]
  return metrosList[i]
}

function makePage (currentPath, optionVal, metrosList, metroLookup, filteredData, metroOptions, router) {
  const onChange = function (newMetro) {
    if (newMetro !== currentPath) {
      router.push('/metros/' + newMetro.replace('#', '%23'))
    }
  }

  const fuseOptions = {
    keys: ['name'],
    threshold: 0.1,
    distance: 5
  }

  if (typeof optionVal === 'undefined' || optionVal === null) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <Head>
        <title>{optionVal.metro_name}</title>
        <meta name='viewport' content='width=device-width, initial-scale=1.0' />
      </Head>
      <Nav currentIndex={2} />
      <div className='mx-auto mb-10 align-center items-center flex flex-col justify-center'>
        <div className='lg:grid lg:grid-cols-5 flex flex-col'>
          <div className='m-4 col-span-1'>
            <WindowSelectSearch
              search
              onChange={onChange}
              options={metroOptions}
              fuseOptions={fuseOptions}
              value={optionVal.path}
              renderOption={renderOption}
            />
          </div>
          <div className='mt-4 mb-1 col-span-3 text-center'>
            <h1 className='text-4xl'>{optionVal.metro_name}</h1>
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
        <div className='max-w-3xl text-sm mt-4'>
          (The <b>{optionVal.metro_name}</b> {optionVal.metro_type.toUpperCase()} includes {formatCountiesList(optionVal.county_names)}.)
        </div>
      </div>
      <GitHubFooter />

    </div>
  )
}

function formatCountiesList (counties) {
  if (counties.length === 1) {
    return counties[0]
  } else if (counties.length === 2) {
    return counties[0] + ' and ' + counties[1]
  } else {
    return counties.slice(0, counties.length - 1).join(', ') + ', and ' + counties[counties.length - 1]
  }
}

export async function getServerSideProps (context) {
  const metroPath = context.params.metro

  return {
    props: {
      metroPath
    }
  }
}
