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

export default function Metro () {
  const router = useRouter()

  const { data: metrosListResponse } = useSWR('/metros_list.json')

  const [metroOptions, metroLookup] = useMemo(() => {
    const metroNames = metrosListResponse || []

    const lookupTable = {}
    const options = []
    for (let i = 0; i < metroNames.length; i++) {
      const metro = metroNames[i]
      if (metro.state_code !== null && metro.metro_name !== null) {
        options.push({
          value: i,
          name: metro.ma_name
        })

        // This feels stupid but I don't know if there's a better way
        lookupTable[metro.metro_name] = i
      }
    }
    console.log(options)

    return [options, lookupTable]
  }, [metrosListResponse])

  const metro = router.query.metro
  console.log(metro)

  const optionVal = useMemo(() => {
    if (metro !== null) {
      const index = metroLookup[metro]
      if (typeof index !== 'undefined') {
        return metroOptions[index].value
      }
    }
    return null
  }, [metro, metroLookup.length || 0])

  const { data } = useSWR(getJsonUrl(metro))
  console.log(data)

  return makePage(metro, optionVal, data, metroOptions, metroLookup, router)
}

function makePage (metro, optionVal, filteredData, metroOptions, metroLookup, router) {
  const onChange = function (newMetro) {
    const chosenOption = metroOptions[newMetro]
    if (chosenOption.name !== metro) {
      router.push('/metros/' + chosenOption.name.replace('#', '%23'))
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
        <title>{metro}</title>
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
              value={optionVal}
            />
          </div>
          <div className='mt-4 mb-1 col-span-3 text-center'>
            <h1 className='text-4xl'>{metro}</h1>
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
