import { fieldsGenerator } from "../lib/plots"
import ContainerDimensions from "react-container-dimensions"
import { VegaLite } from "react-vega"
import { TopLevelSpec } from "vega-lite"
import { Transform } from "vega-lite/src/transform"
import { StringFieldDef } from "vega-lite/src/channeldef"
import { PlainObject } from "react-vega/src/types"

const unitsLabels = {
  units: "Units permitted",
  bldgs: "Housing buildings permitted",
  value: "Property value of permitted buildings",
}

const baseKeyMapping = {
  "1_unit_units": "1 unit",
  "1_unit_bldgs": "1 unit",
  "1_unit_value": "1 unit",
  "2_units_units": "2 units",
  "2_units_bldgs": "2 units",
  "2_units_value": "2 units",
  "3_to_4_units_units": "3-4 units",
  "3_to_4_units_bldgs": "3-4 units",
  "3_to_4_units_value": "3-4 units",
  "5_plus_units_units": "5+ units",
  "5_plus_units_bldgs": "5+ units",
  "5_plus_units_value": "5+ units",
  projected_units: "Projected units",
  projected_bldgs: "Projected units",
  projected_value: "Projected units",
}

const orderMapping = {
  "1_unit_units": 3,
  "1_unit_bldgs": 3,
  "1_unit_value": 3,
  "2_units_units": 2,
  "2_units_bldgs": 2,
  "2_units_value": 2,
  "3_to_4_units_units": 1,
  "3_to_4_units_bldgs": 1,
  "3_to_4_units_value": 1,
  "5_plus_units_units": 0,
  "5_plus_units_bldgs": 0,
  "5_plus_units_value": 0,
  projected_units: 4,
  projected_bldgs: 4,
  projected_value: 4,
}

export const keyMapping = {}
for (const [key, value] of Object.entries(baseKeyMapping)) {
  keyMapping[key] = value
  keyMapping[key + "_per_capita"] = value
  keyMapping[key + "_per_capita_per_1000"] = value
}

const fields = Array.from(fieldsGenerator())

export default function BarPlot({
  data,
  units,
  perCapita,
}: {
  data: PlainObject
  units: string
  perCapita: boolean
}): JSX.Element {
  return (
    <ContainerDimensions>
      {({ width, height }) => (
        <VegaLite
          spec={makeSpec(units, perCapita, width, height)}
          data={data}
        />
      )}
    </ContainerDimensions>
  )
}

function makeTransforms(
  units: string,
  filterFields: string[],
  perThousand: boolean
): Transform[] {
  let transforms: Transform[] = [
    { fold: fields },
    {
      filter: {
        field: "key",
        oneOf: filterFields,
      },
    },
    {
      calculate: JSON.stringify(keyMapping) + '[datum.key] || "Error"',
      as: "key_pretty_printed",
    },
  ]

  if (perThousand) {
    const baseFields = Array.from(
      fieldsGenerator([units], [""], ["_per_capita"])
    )
    const perThousandTransforms: Transform[] = baseFields.map((field) => {
      return {
        calculate: "1000 * datum['" + field + "']",
        as: field + "_per_1000",
      }
    })

    transforms = perThousandTransforms.concat(transforms)
  }

  return transforms
}

function makeSpec(
  units: string,
  perCapita: boolean,
  width: number,
  height: number
): TopLevelSpec {
  const perThousand = perCapita && units === "units"
  const perCapitaSuffix = perCapita ? "_per_capita" : ""
  const perThousandSuffix = perThousand ? "_per_1000" : ""
  const suffix = perCapitaSuffix + perThousandSuffix

  const filterFields = Array.from(fieldsGenerator([units], [""], [suffix]))

  const plotWidth = Math.min(width * 0.92, 936)
  const continuousBandSize = (plotWidth * 10) / 936

  const yLabel = unitsLabels[units]
  const yTitleSuffix = perCapita
    ? perThousand
      ? " per 1000 residents"
      : " per capita"
    : ""
  const yTitle = yLabel + yTitleSuffix

  const yFormat = units === "value" ? (perCapita ? "$.2f" : "$s") : null

  const transforms = makeTransforms(units, filterFields, perThousand)

  return {
    width: plotWidth,
    height: 0.75 * plotWidth,
    autosize: {
      type: "fit",
      contains: "padding",
    },
    encoding: {
      x: {
        field: "year",
        type: "temporal",
        axis: { title: "Year", titleFontSize: 13, labelFontSize: 14 },
      },
      y: {
        field: "value",
        type: "quantitative",
        axis: {
          title: yTitle,
          format: yFormat,
          titleFontSize: 13,
          labelFontSize: 14,
          titleAngle: 0,
          titleX: -50,
          titleY: -13,
          titleAlign: "left",
        },
      },
      color: {
        field: "key",
        type: "nominal",
        // axis: { title: 'Unit count' },
        legend: { titleFontSize: 12, labelFontSize: 12, title: "Unit count" },
      },
      order: {
        field: "bar_chart_order",
      },
    },
    transform: transforms,
    data: { name: "table" }, // note: vega-lite data attribute is a plain object instead of an array
    usermeta: { embedOptions: { renderer: "svg" } },
    layer: [
      {
        mark: {
          type: "bar",
          tooltip: { content: "data" },
        },
        encoding: {
          x: {
            field: "year",
          },
          y: {
            field: "value",
          },
          color: {
            field: "key_pretty_printed",
            scale: {
              scheme: "tableau10",
            },
          },
          tooltip: [
            // Typescript doesn't like that this StringFieldDef includes scale
            {
              field: "year",
              type: "temporal",
              scale: { type: "utc" },
              timeUnit: "utcyear",
              title: "Year",
            } as StringFieldDef<string>,
            { field: "1_unit_units", title: "1 unit", format: "," },
            { field: "2_units_units", title: "2 units", format: "," },
            { field: "3_to_4_units_units", title: "3-4 units", format: "," },
            { field: "5_plus_units_units", title: "5+ units", format: "," },
            { field: "total_units", title: "Total units", format: "," },
            { field: "projected_units", title: "Projected units", format: "," },
          ],
        },
        // tooltip: true
      },
    ],
    config: {
      bar: {
        continuousBandSize: continuousBandSize,
      },
    },
  }
}
