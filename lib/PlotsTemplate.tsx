import BarPlot from "lib/BarPlot"
import { CurrentYearExtrapolationInfo } from "lib/projections"
import { useFetch } from "lib/queries"
import { usePerCapitaInput, useUnitsSelect } from "lib/selects"

interface Option {
  value: string
  name: string
}

export function makeOptions<T extends { path: string }, U>(
  jsonList: T[]
): [Option[], Map<string, U>] {
  const options = []
  const optionsMap = new Map()
  for (const { path, ...fields } of jsonList) {
    const option = {
      value: path,
      ...fields,
    }
    options.push(option)
    optionsMap.set(path, option)
  }

  return [options, optionsMap]
}

export default function PlotsTemplate({
  selected,
  select,
  jsonRoot,
  countyList,
}: {
  selected: Option | null
  select: JSX.Element
  jsonRoot: string
  countyList?: JSX.Element
}): JSX.Element {
  const { data } = useFetch(
    selected != null ? jsonRoot + selected.value + ".json" : null
  )

  const { selectedUnits, unitsSelect } = useUnitsSelect()

  const { denom, populationInput } = usePerCapitaInput()
  const perCapita = denom === "per_capita"

  return (
    <div className="mx-auto mb-10 align-center items-center flex flex-col justify-center">
      <div className="lg:grid lg:grid-cols-3 flex flex-col">
        <div className="m-4 col-span-1">{select}</div>
        <div className="mt-4 mb-1 col-span-1 text-center">
          <h1 className="text-4xl">{selected?.name}</h1>
        </div>
        <div className="col-span-1 m-4">{unitsSelect}</div>
      </div>

      <div className="w-full flex flex-row">
        <BarPlot
          data={{ table: data }}
          units={selectedUnits}
          perCapita={perCapita}
        />
      </div>
      {populationInput}
      {countyList ?? ""}
      <CurrentYearExtrapolationInfo />
    </div>
  )
}
