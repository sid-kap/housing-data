import { fieldsGenerator } from '../lib/plots.js'
import ContainerDimensions from 'react-container-dimensions'
import { VegaLite } from 'react-vega'

const unitsLabels = {
  units: 'Units permitted',
  bldgs: 'Housing buildings permitted',
  value: 'Property value of permitted buildings'
}

const baseKeyMapping = {
  '1_unit_units': '1 unit',
  '2_units_units': '2 units',
  '3_to_4_units_units': '3-4 units',
  '5_plus_units_units': '5+ units',
  '1_unit_bldgs': '1 unit',
  '2_units_bldgs': '2 units',
  '3_to_4_units_bldgs': '3-4 units',
  '5_plus_units_bldgs': '5+ units',
  '1_unit_value': '1 unit',
  '2_units_value': '2 units',
  '3_to_4_units_value': '3-4 units',
  '5_plus_units_value': '5+ units'
}

export const keyMapping = {}
for (const [key, value] of Object.entries(baseKeyMapping)) {
  keyMapping[key] = value
  keyMapping[key + '_per_capita'] = value
  keyMapping[key + '_per_capita_per_1000'] = value
}

const fields = Array.from(fieldsGenerator())

export default function BarPlot ({ data, units, perCapita }) {
  return (
    <ContainerDimensions>
      {({ width, height }) => (
        <VegaLite spec={makeSpec(units, perCapita, width, height)} data={data} />
      )}
    </ContainerDimensions>
  )
}

function makeSpec (units, perCapita, width, height) {
  const perThousand = perCapita && (units === 'units')
  const perCapitaSuffix = perCapita ? '_per_capita' : ''
  const perThousandSuffix = perThousand ? '_per_1000' : ''
  const suffix = perCapitaSuffix + perThousandSuffix

  const filterFields = Array.from(fieldsGenerator([units], [''], [suffix], perCapita))

  const plotWidth = Math.min(width * 0.92, 936)
  const continuousBandSize = plotWidth * 10 / 936

  const yLabel = unitsLabels[units]
  const yTitleSuffix = perCapita ? (perThousand ? ' per 1000 residents' : ' per capita') : ''
  const yTitle = yLabel + yTitleSuffix

  const yFormat = units === 'value' ? (perCapita ? '$.2f' : '$s') : null

  let transforms = [
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
  ]

  if (perThousand) {
    const baseFields = Array.from(fieldsGenerator([units], [''], ['_per_capita']))
    const perThousandTransforms = baseFields.map((field) => {
      return {
        calculate: '1000 * datum[\'' + field + '\']',
        as: field + '_per_1000'
      }
    })

    transforms = perThousandTransforms.concat(transforms)
  }

  return {
    width: plotWidth,
    height: 0.75 * plotWidth,
    autosize: {
      type: 'fit',
      contains: 'padding'
    },
    encoding: {
      x: {
        field: 'year',
        type: 'temporal',
        axis: { title: 'Year', titleFontSize: 13, labelFontSize: 14 }
      },
      y: {
        field: 'value',
        type: 'quantitative',
        axis: {
          title: yTitle,
          format: yFormat,
          titleFontSize: 13,
          labelFontSize: 14,
          titleAngle: 0,
          titleX: -50,
          titleY: -13,
          titleAlign: 'left'
        }
      },
      color: {
        field: 'key',
        type: 'nominal',
        axis: { title: 'Unit count' },
        legend: { titleFontSize: 12, labelFontSize: 12 }
      }
    },
    scales: [
      {
        name: 'legend_labels',
        type: 'nominal',
        domain: ['1_unit_units' + suffix, '2_units_units' + suffix, '3_to_4_units_units' + suffix, '5_plus_units_units' + suffix],
        range: ['1 unit', '2 units', '3-4 units', '5+ units']
      }
    ],
    transform: transforms,
    data: { name: 'table' }, // note: vega-lite data attribute is a plain object instead of an array
    usermeta: { embedOptions: { renderer: 'svg' } },
    layer: [
      {
        mark: {
          type: 'bar',
          tooltip: { content: 'data' }
        },
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
          },
          tooltip: [
            { field: 'year', type: 'temporal', scale: { type: 'utc' }, timeUnit: 'utcyear', title: 'Year' },
            { field: '1_unit_units', title: '1 unit', format: ',' },
            { field: '2_units_units', title: '2 units', format: ',' },
            { field: '3_to_4_units_units', title: '3-4 units', format: ',' },
            { field: '5_plus_units_units', title: '5+ units', format: ',' },
            { field: 'total_units', title: 'Total units', format: ',' }
          ]
        },
        tooltip: true
      }
    ],
    config: {
      bar: {
        continuousBandSize: continuousBandSize
      }
    }
  }
}
