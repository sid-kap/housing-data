import { Page } from '../../lib/common_elements.js'
import { useRouter } from 'next/router'
import { useFetch } from '../../lib/queries.js'
import { useMemo, useState, useCallback } from 'react'
import WindowSelectSearch from '../../lib/WindowSelectSearch.js'
import { titleCase } from 'title-case'

import ReactMapboxGl, { Layer, Source, Popup } from 'react-mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const Map = ReactMapboxGl({
  accessToken: 'pk.eyJ1Ijoic2lkLWthcCIsImEiOiJjamRpNzU2ZTMxNWE0MzJtZjAxbnphMW5mIn0.b6m4jgFhPOPOYOoaNGmogQ'
})

const bayAreaBounds = [
  [-123.1360271, 36.97640742],
  [-121.53590925, 38.82979915]
]

function makeOptions (summaryResponse) {
  const summary = summaryResponse || []
  const indexLookup = {}

  const options = []
  for (let i = 0; i < summary.length; i++) {
    const row = summary[i]
    options.push({
      ...row,
      value: row.city,
      name: row.city
    })
    indexLookup[row.city] = i
  }

  return [options, indexLookup]
}

const fuseOptions = {
  keys: ['name'],
  threshold: 0.1,
  distance: 5
}

function renderOption (domProps, option, snapshot, className) {
  return (
    <button className={className} {...domProps}>
      {option.name}
    </button>
  )
  // <span className='text-xs rounded bg-purple-200 p-1'>{option.metro_type.toUpperCase()}</span>
}

export default function RhnaCity () {
  const router = useRouter()
  const cityName = router.query.city ?? null

  const [clickedElement, setClickedElement] = useState(null)

  const sitesUrl = '/rhna_data/' + cityName + '/sites_with_matches.geojson'
  // const { status: sitesStatus, data: sitesWithMatches } = useFetch(sitesUrl)
  const permitsUrl = '/rhna_data/' + cityName + '/permits.geojson'
  // const { status: permitsStatus, data: permits } = useFetch(permitsUrl)

  const { data: summaryData } = useFetch('/rhna_data/summary.json')

  const [cityOptions, indexLookup] = useMemo(
    () => makeOptions(summaryData),
    [summaryData]
  )
  const currentOption = useMemo(
    () => cityOptions[indexLookup[cityName]],
    [cityName]
  )
  console.log(currentOption)

  let page = null
  // if ((sitesStatus != 'success') || (permitsStatus != 'success')) {
  const loading = false
  if (loading) {
    page = (
      <h1 className='mt-4 text-center text-2xl'>Loading (or city doesn't exist)...</h1>
    )
  } else {
    // console.log(sitesWithMatches)
    // console.log(permits)

    const paint = {
      // This is the world's dumbest query language
      'fill-color': [
        'case',
        ['all', ['get', 'apn_matched'], ['get', 'geo_matched']], 'green',
        ['get', 'apn_matched'], 'yellow',
        ['get', 'geo_matched'], 'blue',
        'red'
      ],
      'fill-opacity': 0.3
    }
    const symbolLayout = {
      'circle-color': [
        'case',
        ['==', ['get', 'permit_category'], 'ADU'], 'hsl(169, 76%, 50%)',
        ['==', ['get', 'permit_category'], 'SU'], 'hsl(169, 76%, 50%)',
        'green'
      ],
      'circle-radius': {
        base: 1.75,
        stops: [
          [12, 2],
          [22, 180]
        ]
      }
      // 'icon-image': 'permit',
      // 'icon-size': 0.25,
      // 'text-field': "{permit_address}",
    }

    // const onClick = useCallback((e) => {

    // })
    const onClickSiteOrPermit = (e) => {
      console.log(e.lngLat)
      setClickedElement({
        element: e.features[0],
        location: e.lngLat
      })
    }

    const onChange = useCallback(
      (newCity) => {
        if (newCity !== cityName) {
          router.push('/rhna/' + newCity.replace('#', '%23'))
        }
      }, [cityName]
    )
    // center={[-122.2730, 37.8715]}

    page = (
      <>
        <h1 className='mt-4 text-center text-4xl'>{cityName}</h1>
        <WindowSelectSearch
          search
          onChange={onChange}
          options={cityOptions}
          fuseOptions={fuseOptions}
          value={cityName}
          renderOption={renderOption}
        />
        <div className='max-w-md max-h-md mx-auto'>
          <Map
            style='mapbox://styles/mapbox/streets-v9'
            containerStyle={{
              height: '700px',
              width: '700px'
            }}
            fitBounds={currentOption?.bounds || bayAreaBounds}
          >
            <Source id='permits' geoJsonSource={{ data: permitsUrl, type: 'geojson' }} />
            <Source id='sitesWithMatches' geoJsonSource={{ data: sitesUrl, type: 'geojson' }} />
            <Layer
              type='fill'
              sourceId='sitesWithMatches'
              paint={paint}
              onClick={onClickSiteOrPermit}
            />
            <Layer
              type='circle'
              sourceId='permits'
              paint={symbolLayout}
              onClick={onClickSiteOrPermit}
            />
            {clickedElement && (
              <Popup key={clickedElement.element.id} coordinates={clickedElement.location}>
                {renderPopup(clickedElement.element.properties)}
              </Popup>
            )}
          </Map>
        </div>
        {clickedElement && JSON.stringify(clickedElement)}
        <p>
          <ul className='list-disc list-outside px-10'>
            <li> stuff
              <p>one</p>
              <p>two</p>
              <p>three</p>
              <p>{titleCase('hello hi sdfSDFSDIFJSDF SDFSDFSDF'.toLowerCase())}</p>
            </li>
          </ul>
        </p>
      </>
    )
  }

  // <Image id={'permit'} url={'https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png'} />
  return (
    <Page title={cityName} navIndex={5}>
      {page}
    </Page>
  )
}

function renderMatch (match) {
  return (
    <li>
      <div>
        <p>{titleCase(match.permit_address.toLowerCase())}: {match.permit_units} units ({match.permit_year}).</p>
        <p><span className='font-bold'>Type:</span> {match.permit_category}</p>
        <p><span className='font-bold'>Match type:</span> {match.match_type.join(', ')}</p>
      </div>
    </li>
  )
}

function renderPermit (permit) {
  return (
    <div>
      <p>{titleCase(permit.permit_address.toLowerCase())}: {permit.permit_units} units ({permit.permit_year}).</p>
      <p><span className='font-bold'>Type:</span> {permit.permit_category}</p>
    </div>
  )
}

function renderPopup (element) {
  // Really ugly way of checking if they clicked on a site or a permit. TODO make this less dumb
  if (typeof (element.match_results) !== 'undefined') {
    // It's a site
    const matchResults = JSON.parse(element.match_results)
    return (
      <>
        <p>Expected capacity in housing element: {element.site_capacity_units} units</p>
        {
          (matchResults.length > 0)
            ? (
              <>
                <p> Matched permits:</p>
                <ul className='list-disc list-outside pl-5'>
                  {matchResults.map(renderMatch)}
                </ul>
              </>
              )
            : (<p>Matched permits: None</p>)
          }
      </>
    )
  } else {
    // It's a permit
    return renderPermit(element)
  }
}
