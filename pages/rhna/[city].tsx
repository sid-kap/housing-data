import { Page } from '../../lib/common_elements.js'
import { useRouter } from 'next/router'
import { useFetch } from '../../lib/queries.js'
import { useMemo, useState, useCallback } from 'react'
import WindowSelectSearch from '../../lib/WindowSelectSearch.js'
import { titleCase } from 'title-case'

import ReactMapboxGl, { Layer, Source, Popup } from 'react-mapbox-gl'
import { LngLat } from 'mapbox-gl'
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

function formatPercent(x: number | undefined): string {
    if (typeof x == 'undefined') {
        return ''
    }
    return (x * 100).toFixed(1) + '%'
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

type ClickedElement = {
    element: any,
    location: LngLat,
}

export default function RhnaCity (): JSX.Element {
  const router = useRouter()
  const cityName = (router.query.city as string) ?? null

  const [clickedElement, setClickedElement] = useState<ClickedElement>(null)

  const sitesUrl = '/rhna_data/' + cityName + '/sites_with_matches.geojson'
  // const { status: sitesStatus, data: sitesWithMatches } = useFetch(sitesUrl)
  const permitsUrl = '/rhna_data/' + cityName + '/permits.geojson'
  // const { status: permitsStatus, data: permits } = useFetch(permitsUrl)

  const { data: summaryData } = useFetch('/rhna_data/summary.json')
    console.log(summaryData)

  const [cityOptions, indexLookup] = useMemo(
    () => makeOptions(summaryData),
    [summaryData]
  )
  const currentOption = useMemo(
    () => cityOptions[indexLookup[cityName]],
    [summaryData, cityName]
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
    const sitesPaintStyle = {
      // This is the world's dumbest query language
      'fill-color': [
        'case',
        ['all', ['get', 'apn_matched'], ['get', 'geo_matched']], 'green',
        ['get', 'apn_matched'], 'yellow',
        ['get', 'geo_matched'], 'blue',
        'red'
      ],
      'fill-opacity': 0.3,
    }

      const sitesOutlinePaintStyle = {
          // This is the world's dumbest query language
          'line-color': 'black',
          'line-width': 0.5,
      }

    const permitsPaintStyle = {
      'circle-color': [
        'case',
        ['==', ['get', 'permit_category'], 'ADU'], 'hsl(169, 76%, 50%)',
        ['==', ['get', 'permit_category'], 'SU'], 'hsl(169, 76%, 50%)',
        'green'
      ],
      'circle-radius': {
        base: 1.75,
        stops: [
          [12, 1.5],
          [15, 4],
          [22, 180]
        ]
      }
      // 'icon-image': 'permit',
      // 'icon-size': 0.25,
      // 'text-field': "{permit_address}",
    }

    const onClickSiteOrPermit = (map, e) => {
        const features = map.queryRenderedFeatures(e.point, {
            layers: ['sitesWithMatchesLayer', 'permitsLayer']
        })
        if (features.length > 0) {
            setClickedElement({
                element: features[0],
                location: e.lngLat.toArray()
            })
        } else {
            setClickedElement(null)
        }
    }

    const onChange = useCallback(
      (newCity) => {
        if (newCity !== cityName) {
          router.push('/rhna/' + newCity.replace('#', '%23'))
        }
      }, [cityName]
    )

    const onMapMove = (map, e) => {
        const hoveredFeatures = map.queryRenderedFeatures(e.point)
        const isPointing = hoveredFeatures.filter(feat => (feat.source == 'sitesWithMatches') || (feat.source == 'permits')).length > 0
        if (isPointing) {
            map.getCanvas().style.cursor = "pointer"
        } else {
            map.getCanvas().style.cursor = "default"
        }
    }

    // <div className='max-w-md max-h-md mx-auto align-center'>
    page = (
        <div className="mx-auto mb-10 align-center items-center justify-center flex flex-col">
            <div className="lg:grid lg:grid-cols-3 flex flex-col">
                <div className="m-4 col-span-1">
                    <WindowSelectSearch
                    // @ts-ignore
                        search
                        onChange={onChange}
                        options={cityOptions}
                        fuseOptions={fuseOptions}
                        value={cityName}
                        renderOption={renderOption}
                    />
                </div>
                <div className="col-span-1">
                    <h1 className='mt-4 text-center text-4xl'>{cityName}</h1>
                </div>
                <div className="col-span-1">
                </div>
            </div>
            <div className='w-full justify-center flex flex-row'>
                <Map
                    style='mapbox://styles/mapbox/streets-v9'
                    containerStyle={{
                        height: '700px',
                        width: '1000px'
                    }}
                    fitBounds={currentOption?.bounds || bayAreaBounds}
                    onMouseMove={onMapMove}
                    onClick={onClickSiteOrPermit}
                >
                    <Source id='permits' geoJsonSource={{ data: permitsUrl, type: 'geojson' }} />
                    <Source id='sitesWithMatches' geoJsonSource={{ data: sitesUrl, type: 'geojson' }} />
                    <Layer
                        id="sitesWithMatchesLayer"
                        type='fill'
                        sourceId='sitesWithMatches'
                        paint={sitesPaintStyle}
                    />
                    <Layer
                        id="sitesWithMatchesOutlineLayer"
                        type='line'
                        sourceId='sitesWithMatches'
                        paint={sitesOutlinePaintStyle}
                        minZoom={15}
                    />
                    <Layer
                        id="sitesWithMatchesTextLayer"
                        type='symbol'
                        sourceId='sitesWithMatches'
                        layout={{
                            'text-field': '{site_capacity_units}',
                        }}
                        paint={{
                            'text-color': 'hsl(0, 0, 35%)',
                        }}
                        minZoom={17}
                    />
                    <Layer
                        id="permitsLayer"
                        type='circle'
                        sourceId='permits'
                        paint={permitsPaintStyle}
                    />
                    {clickedElement && (
                        <Popup key={clickedElement.element.id} coordinates={clickedElement.location}>
                            {renderPopup(clickedElement.element.properties)}
                        </Popup>
                    )}
                </Map>
            </div>
            {makeMatchTable(currentOption)}
        </div>
    )
  }
    /* onMouseEnter={(e) => e.target.getCanvas().style.cursor = "pointer"}
     * onMouseLeave={(e) => e.target.getCanvas().style.cursor = "default"} */

  // <Image id={'permit'} url={'https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png'} />
  return (
    <Page title={cityName} navIndex={5}>
      {page}
    </Page>
  )
}

function makeTableRow(results) {
    console.log(results)
    return results.map(
        (d) => {
            return (
                <>
                    <td>
                        {formatPercent(d?.fraction)}&nbsp;
                        <span className="text-gray-400">({d?.matches}/{d?.sites})</span>
                    </td>
                </>
            )
        }
    )
}

function makeMatchTable(result) {
    const statsList = result ? [
        result.overall_match_stats,
        result.nonvacant_match_stats,
        result.vacant_match_stats,
    ] : [{}, {}, {}]

    const apnResults = statsList.map(d => d?.apn)
    const geoResults = statsList.map(d => d?.geo)
    const bothResults = statsList.map(d => d?.either)
    console.log(apnResults)

    return (
        <table className="table-auto match-table mt-4">
            <tr>
                <th className="text-center" colspan="4">Likelihood of development for {result.city}</th>
            </tr>
            <tr className="bg-blue-300">
                <th>Matching logic</th>
                <th className="text-center">Overall</th>
                <th className="text-center">Nonvacant sites</th>
                <th className="text-center">Vacant sites</th>
            </tr>
            <tr className="bg-blue-100">
                <th className="text-left">APN</th>
                {makeTableRow(apnResults)}
            </tr>
            <tr className="bg-gray-100">
                <th className="text-left">Address</th>
                {makeTableRow(geoResults)}
            </tr>
            <tr className="bg-blue-100">
                <th className="text-left">APN or address</th>
                {makeTableRow(bothResults)}
            </tr>
        </table>
    )
}

function renderMatch (match) {
    let address = match.permit_address?.toLowerCase()
    if (address) {
        address = titleCase(address)
    } else {
        address = "[no address]"
    }
    return (
        <li>
        <div>
            <p>{address}: {match.permit_units} units ({match.permit_year}).</p>
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
                  <p>
                      Matched permits
                      (total {matchResults.map(r => r.permit_units || 0).reduce((a, b) => a + b, 0)} units):
                  </p>
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
