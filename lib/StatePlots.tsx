import { useRouter } from "next/router"
import { useFetch } from "../lib/queries"
import SelectSearch from "react-select-search/dist/cjs"
import { useMemo } from "react"
import BarPlot from "../lib/BarPlot"
import { makeUnitsSelect, usePerCapitaInput } from "../lib/selects"
import { PlainObject } from "react-vega/src/types"

interface RawOption {
  type: string
  state_name: string
}

interface Option {
  value: string
  name: string
  path: string
}

export function makeStateOptions(statesList: RawOption[]): Option[] {
  let stateNames = statesList
    .filter((row) => row.type === "state")
    .map((row) => row.state_name)
    .filter((row) => row !== null) // TODO remove null row from data file
  stateNames = Array.from(new Set(stateNames))

  return stateNames.map((state) => ({
    value: state,
    name: state,
    path: `/states_data/${state}.json`,
  }))
}

function prepareData(stateData: RawOption[], stateName: string): PlainObject {
  const filteredData = stateData.filter((row) => row.state_name === stateName)

  return { table: filteredData }
}

function makeStateSelect(
  stateOptions: Option[],
  stateName: string,
  router
): JSX.Element {
  return (
    <SelectSearch
      search
      value={stateName}
      onChange={(newState) =>
        newState !== stateName ? router.push("/states/" + newState) : null
      }
      options={stateOptions}
      placeholder="Change state..."
    />
  )
}

export default function StatePlots({
  stateName,
}: {
  stateName: string
}): JSX.Element {
  const router = useRouter()

  const { status, data: stateData } = useFetch("/state_annual.json")

  const data = useMemo(
    () => prepareData(stateData ?? [], stateName),
    [status, stateName]
  )

  const stateOptions = useMemo(
    () => makeStateOptions(stateData ?? []),
    [status]
  )

  const stateSelect = useMemo(
    () => makeStateSelect(stateOptions, stateName, router),
    [stateOptions, stateName, router]
  )
  const { selectedUnits, unitsSelect } = makeUnitsSelect()

  const { denom, populationInput } = usePerCapitaInput()
  const perCapita = denom === "per_capita"

  return (
    <div className="flex flex-col justify-center items-center mx-auto mb-10">
      <div className="flex flex-col lg:grid lg:grid-cols-3">
        <div className="m-4 col-span-1">{stateSelect}</div>
        <h1 className="mt-4 text-4xl col-span-1 text-center">{stateName}</h1>
        <div className="col-span-1 m-4">{unitsSelect}</div>
      </div>

      <div className="w-full flex flex-row">
        <BarPlot data={data} units={selectedUnits} perCapita={perCapita} />
      </div>
      {populationInput}
    </div>
  )
}
