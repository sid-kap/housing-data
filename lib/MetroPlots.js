import { useRouter } from 'next/router'
import { fieldsGenerator, makeBarChartSpec } from './plots.js'
import { useMemo, useEffect, useCallback } from 'react'
import { useFetch } from './queries.js'

import { VegaLite } from 'react-vega'
import WindowSelectSearch from './WindowSelectSearch.js'
import ContainerDimensions from 'react-container-dimensions'

const fields = Array.from(fieldsGenerator())
const filterFields = Array.from(fieldsGenerator(['units'], [''], ['']))

function spec (width, height) {
  // TODO: Add buildings/property value here
  return makeBarChartSpec(fields, 'units', filterFields, width, height, false)
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

function renderOption (domProps, option, snapshot, className) {
  return (
    <button className={className} {...domProps}>
      {option.name}
    </button>
  )
  // <span className='text-xs rounded bg-purple-200 p-1'>{option.metro_type.toUpperCase()}</span>
}

function lookup (metroLookup, metrosList, metroPath) {
  const i = metroLookup[metroPath] ?? null
  return metrosList[i] ?? null
}

const fuseOptions = {
  keys: ['name'],
  threshold: 0.1,
  distance: 5
}

export default function MetroPlots ({ metroPath, setTitle }) {
  const router = useRouter()

  const { status, data: metrosList } = useFetch('/metros_list.json')

  const [metroOptions, metroLookup] = useMemo(
    () => makeOptions(metrosList),
    [metrosList]
  )

  const optionVal = useMemo(
    () => lookup(metroLookup, metrosList ?? [], metroPath),
    [metroPath, status]
  )

  useEffect(
    () => setTitle(optionVal?.metro_name ?? 'Housing Data'),
    [optionVal]
  )

  const { data } = useFetch(getJsonUrl(metroPath))

  const onChange = useCallback(
    (newMetro) => {
      if (newMetro !== metroPath) {
        router.push('/metros/' + newMetro.replace('#', '%23'))
      }
    }, [metroPath]
  )

  /* eslint-disable */
  const countyList = useMemo(
    () => {
      return (
        optionVal
          ? <div className='max-w-3xl text-sm mt-4'>
            (The <b>{optionVal.metro_name}</b> {optionVal.metro_type.toUpperCase()} includes {formatCountiesList(optionVal.county_names)}.)
          </div>
          : <></>
      )
    },
    [optionVal]
  )
  /* eslint-enable */

  return (
    <div className='mx-auto mb-10 align-center items-center flex flex-col justify-center'>
      <div className='lg:grid lg:grid-cols-5 flex flex-col'>
        <div className='m-4 col-span-1'>
          <WindowSelectSearch
            search
            onChange={onChange}
            options={metroOptions}
            fuseOptions={fuseOptions}
            value={optionVal?.value}
            renderOption={renderOption}
          />
        </div>
        <div className='mt-4 mb-1 col-span-3 text-center'>
          <h1 className='text-4xl'>{optionVal?.metro_name ?? ''}</h1>
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
      {countyList}
    </div>
  )
}

function formatCountiesList (counties) {
  // Special handling for long list of counties (if there are 3 or more)
  // TODO handle parishes?
  let ending
  let threeOrMoreNames
  if (counties.every(str => str.endsWith(' County'))) {
    threeOrMoreNames = counties.map(str => str.substring(0, str.length - 7))
    ending = ' Counties'
  } else if (counties.every(str => str.endsWith(' Parish'))) {
    threeOrMoreNames = counties.map(str => str.substring(0, str.length - 7))
    ending = ' Parishes'
  } else {
    threeOrMoreNames = counties
    ending = ''
  }

  if (counties.length === 1) {
    return counties[0]
  } else if (counties.length === 2) {
    return counties[0] + ' and ' + counties[1]
  } else {
    return threeOrMoreNames.slice(0, threeOrMoreNames.length - 1).join(', ') + ', and ' + threeOrMoreNames[threeOrMoreNames.length - 1] + ending
  }
}
