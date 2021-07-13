import { Page } from '../../lib/common_elements.js'
import { useRouter } from 'next/router'
import { useFetch } from '../../lib/queries.js'
import { useMemo, useState, useCallback } from 'react'
import SelectSearch from 'react-select-search/dist/cjs'
import { titleCase } from 'title-case'
import Head from 'next/head'

import ReactMapboxGl, { Layer, Source, Popup, MapContext } from 'react-mapbox-gl'
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

    const options = [{
        name: 'Overview',
        value: 'Overview',
    }]
  for (let i = 0; i < summary.length; i++) {
    const row = summary[i]
    options.push({
      ...row,
      value: row.city,
      name: row.city
    })
    indexLookup[row.city] = i + 1
  }

  return [options, indexLookup]
}

export function useBufferSelector() {
    const [buffer, setBuffer] = useState(25)

    const bufferOptions = [0, 5, 10, 25, 50, 75, 100].map((bufferValue) => {
        return (
            <span key={bufferValue}>
            <input id={"buffer-" + bufferValue} type='radio' checked={buffer == bufferValue} value='conservative' onChange={() => setBuffer(bufferValue)} />
            <label htmlFor={"buffer-" + bufferValue} className='ml-1 mr-3 text-sm'>{bufferValue} feet</label>
            </span>
        )
    })
    const bufferInput = (
        <div>
            <p className="text-sm text-gray-500">Geocoding buffer size:</p>
            <div className="max-w-xs">
            {bufferOptions}
            </div>
        </div>
    )

    return {
        buffer: buffer,
        bufferInput: bufferInput
    }
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
    layer: string,
    element: any,
    location: LngLat,
}

const sitesOutlinePaintStyle = {
    'line-color': 'black',
    'line-width': 0.5,
}

const siteTypeOptions = [
    {
        name: 'All sites',
        value: 'overall',
    },
    {
        name: 'Nonvacant sites',
        value: 'nonvacant',
    },
    {
        name: 'Vacant sites',
        value: 'vacant',
    },
]

const matchingLogicOptions = [
    {
        name: 'APN only',
        value: 'apn_only',
    },
    {
        name: 'APN and geocoding',
        value: 'apn_and_geo',
    },
]



export default function RhnaCity (): JSX.Element {
  const router = useRouter()
  const cityName = (router.query.city as string) ?? 'Overview'

const isOverview = cityName == 'Overview'

  const [clickedElement, setClickedElement] = useState<ClickedElement>(null)

  const sitesUrl = !isOverview ? '/rhna_data/' + cityName + '/sites_with_matches.geojson': null
  const permitsUrl = !isOverview ? '/rhna_data/' + cityName + '/permits.geojson' : null

  const { data: summaryData } = useFetch('/rhna_data/summary.json')

  const [cityOptions, indexLookup] = useMemo(
    () => makeOptions(summaryData),
    [summaryData]
  )
  const currentOption = useMemo(
    () => cityOptions[indexLookup[cityName]],
    [summaryData, cityName]
  )

  let page = null
  const loading = false
  if (loading) {
    page = (
      <h1 className='mt-4 text-center text-2xl'>Loading (or city doesn't exist)...</h1>
    )
  } else {
    const [siteType, setSiteType] = useState('overall')
    const [matchingLogic, setMatchingLogic] = useState('apn_and_geo')

    const { buffer, bufferInput } = useBufferSelector()

    const matchingLogicField = matchingLogic == 'apn_only' ? 'results_apn_only' : `results_apn_and_geo_${buffer}ft`
    const geoMatchedField = `geo_matched_${buffer}ft`

    const sitesPaintStyle = {
      // This is the world's dumbest query language
      'fill-color': [
        'case',
        ['all', ['get', 'apn_matched'], ['get', geoMatchedField]], 'green',
        ['get', 'apn_matched'], 'yellow',
        ['get', geoMatchedField], 'blue',
        'red'
      ],
      'fill-opacity': 0.3,
    }
    console.log(sitesPaintStyle)

    const pdevField = [
        'get',
        'P(dev)',
        [
            'get',
            siteType,
            [
                'get',
                matchingLogicField,
            ]
        ]
    ]
    console.log(pdevField)

    const summaryPaintStyle = {
        'fill-color': [
            'interpolate',
            ['linear'],
            pdevField,
            -0.1,
            'white',
            0.5,
            'blue',
            1,
            'blue',
        ],
        'fill-opacity': isOverview ? 0.5 : 0,
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
        },
    }

    const onClickSiteOrPermit = (map, e) => {
        const features = map.queryRenderedFeatures(e.point, {
            layers: ['sitesWithMatchesLayer', 'permitsLayer', 'summaryLayer']
        })
        if (features.length > 0) {
            setClickedElement({
                layer: features[0].layer.id,
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


    page = (
        <div className="mx-auto mb-10 align-center items-center justify-center flex flex-col">
            <div className="lg:grid lg:grid-cols-3 flex flex-col">
                <div className="m-4 col-span-1">
                    <SelectSearch
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
                <div className="col-span-1 m-4">
                    {!isOverview && bufferInput}
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
                    <MapContext.Consumer>
                        {(map) => {
                            // Hide all the city names
                            for (let layer of map.getStyle().layers) {
                                if (layer.id.includes('place-')) {
                                    map.setLayoutProperty(layer.id, 'visibility', isOverview ? 'none' : 'visible')
                                }
                            }
                            return <></>
                        }}
                    </MapContext.Consumer>
                    <Source id='permits' geoJsonSource={{ data: permitsUrl, type: 'geojson' }} />
                    <Source id='sitesWithMatches' geoJsonSource={{ data: sitesUrl, type: 'geojson' }} />
                    <Source id='summary' geoJsonSource={{ data: '/rhna_data/summary.geojson', type: 'geojson' }} />
                    <Source id='summaryCentroids' geoJsonSource={{ data: '/rhna_data/summary_centroids.geojson', type: 'geojson' }} />
                    <Layer
                        id="sitesWithMatchesLayer"
                        type='fill'
                        sourceId='sitesWithMatches'
                        paint={sitesPaintStyle}
                        layout={{visibility: isOverview ? 'none': 'visible'}}
                    />
                    <Layer
                        id="sitesWithMatchesOutlineLayer"
                        type='line'
                        sourceId='sitesWithMatches'
                        paint={sitesOutlinePaintStyle}
                        minZoom={15}
                        layout={{visibility: isOverview ? 'none': 'visible'}}
                    />
                    <Layer
                        id="sitesWithMatchesTextLayer"
                        type='symbol'
                        sourceId='sitesWithMatches'
                        layout={{
                            'text-field': '{site_capacity_units}',
                            visibility: isOverview ? 'none': 'visible'
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
                        layout={{visibility: isOverview ? 'none': 'visible'}}
                    />
                    <Layer
                        id="summaryLayer"
                        type="fill"
                        sourceId="summary"
                        paint={summaryPaintStyle}
                        layout={{visibility: isOverview ? 'visible': 'none'}}
                    />
                    <Layer
                        id="summaryTextLayer"
                        type='symbol'
                        sourceId='summaryCentroids'
                        layout={{
                            'text-field': [
                                'concat',
                                ['get', 'city'],
                                '\n',
                                ['number-format', ['*', 1.6, pdevField], {'max-fraction-digits': 3}]
                            ],
                            visibility: isOverview ? 'visible' : 'none'
                        }}
                        paint={{
                            'text-color': 'hsl(0, 0, 35%)',
                        }}
                    />
                    {clickedElement && (
                        <Popup key={clickedElement.element.id} coordinates={clickedElement.location}>
                            {renderPopup(buffer, clickedElement.layer, clickedElement.element.properties)}
                        </Popup>
                    )}
                    {isOverview ? <></> : legend}
                </Map>
            </div>
            {currentOption && makeMatchTable(currentOption, buffer)}
            {isOverview &&
            <div className="lg:grid lg:grid-cols-3 flex flex-col">
                <div className="m-4 col-span-1">
                    <SelectSearch
                    // @ts-ignore
                        search
                        onChange={setSiteType}
                        options={siteTypeOptions}
                        fuseOptions={fuseOptions}
                        value={siteType}
                        renderOption={renderOption}
                    />
                </div>
                <div className="m-4 col-span-1">
                    <SelectSearch
                    // @ts-ignore
                        search
                        onChange={setMatchingLogic}
                        options={matchingLogicOptions}
                        fuseOptions={fuseOptions}
                        value={matchingLogic}
                        renderOption={renderOption}
                    />
                </div>
                <div className="m-4 col-span-1">
                    {bufferInput}
                </div>
            </div>
            }
        </div>
    )
  }

  return (
    <div>
        <Head>
            <title>{cityName}</title>
            <meta name='viewport' content='width=device-width, initial-scale=1.0' />
        </Head>

        {page}
    </div>
  )
}

const legendSpanClass = "mx-1 w-3 h-3 inline-block border border-black border-opacity-100"
const legendCircle = "mx-1 w-3 h-3 inline-block rounded-full"
const legend = (
    <div className="p-2 absolute right-6 bottom-10 border bg-opacity-80 bg-white">
        <div>
            <span
                className={legendSpanClass}
                style={{backgroundColor: 'red', opacity: 0.3}}></span>
            Unmatched site
        </div>
        <div>
            <span
                className={legendSpanClass}
                style={{backgroundColor: 'green', opacity: 0.3}}></span>
            Matched site (APN and address)
        </div>
        <div>
            <span
                className={legendSpanClass}
                style={{backgroundColor: 'blue', opacity: 0.3}}></span>
            Matched site (Address only)
        </div>
        <div>
            <span
                className={legendSpanClass}
                style={{backgroundColor: 'yellow', opacity: 0.3}}></span>
            Matched site (APN only)
        </div>
        <div>
            <span
                className={legendCircle}
                style={{backgroundColor: 'green'}}></span>
            Permit (single-family or multifamily)
        </div>
        <div>
            <span
                className={legendCircle}
                style={{backgroundColor: 'hsl(169, 76%, 50%)'}}></span>
            Permit (ADU)
        </div>
    </div>
)

function makeTableRow(results) {
    return ['overall', 'nonvacant', 'vacant'].map(
        (siteType) => {
            console.log(results)
            const tableValue = (
                results[siteType]['P(dev)'] == null ? <>N/A</>
                : <>
                    {results[siteType]['P(dev)']?.toFixed(3)}&nbsp;
                    <span className="text-gray-400">({results[siteType]['# matches'].replaceAll(' ', '')})</span>
                </>
            );
            return <td className="text-center">{tableValue}</td>
        }
    )
}

function makeMatchTable(result, buffer) {
    const apnResults = result.results_apn_only
    const bothResults = result[`results_apn_and_geo_${buffer}ft`]
    console.log(apnResults)
    console.log(bothResults)

    return (
        <>
        <table className="table-auto match-table mt-4">
            <tr>
                <th className="text-center" colSpan={4}>Likelihood of development for inventory sites in {result.city}<span className="text-gray-500">*</span></th>
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
            <tr className="bg-blue-100">
                <th className="text-left">APN or address</th>
                {makeTableRow(bothResults)}
            </tr>
        </table>
        <div className="mt-4 text-sm text-gray-500 max-w-md">(*The likelihood of development is extrapolated from the 2015-2019 period to 8 years, see report for formula.)</div>
        </>
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
            <p><span className='font-bold'>Match type:</span> {match.match_type}</p>
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

function renderPopup (buffer, layer, element) {
  // Really ugly way of checking if they clicked on a site or a permit. TODO make this less dumb
  if (layer == 'sitesWithMatchesLayer') {
    // It's a site
    const matchResults = JSON.parse(element['match_results_' + buffer + 'ft'])
    return (
        <div className="max-h-72 overflow-y-auto">
            <p>Expected capacity in housing element: {element.site_capacity_units} units</p>
            {
                matchResults
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
        </div>
    )
  } else if (layer == 'permitsLayer') {
    // It's a permit
    return renderPermit(element)
  } else if (layer == 'summaryLayer') {
      const elementParsed = {...element}
      elementParsed.overall_match_stats = JSON.parse(elementParsed.overall_match_stats)
      elementParsed.vacant_match_stats = JSON.parse(elementParsed.vacant_match_stats)
      elementParsed.nonvacant_match_stats = JSON.parse(elementParsed.nonvacant_match_stats)
      return makeMatchTable(elementParsed, buffer)
  } else {
      throw 'Unknown layer clicked: ' + layer
  }
}
