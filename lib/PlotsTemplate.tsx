import { useEffect, useRef } from "react"

import BarPlot from "lib/BarPlot"
import { CurrentYearExtrapolationInfo } from "lib/projections"
import { useFetch } from "lib/queries"
import {
  HcdDataInfo,
  usePerCapitaInput,
  usePreferHcdDataInput,
  useUnitsSelect,
} from "lib/selects"

interface Option {
  value: string
  name: string
  has_ca_hcd_data: boolean
}

export function makeOptions<T extends { path: string }, U>(
  jsonList: T[]
): [U[], Map<string, U>] {
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

  const { denom, perCapitaInput } = usePerCapitaInput()
  const perCapita = denom === "per_capita"

  const { preferHcdData, preferHcdDataInput } = usePreferHcdDataInput()

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
          preferHcdData={preferHcdData}
        />
      </div>
      <div className="flex flex-row mx-auto flex-wrap">
        <div className="align-center items-center justify-center flex flex-col max-w-3xl">
          {perCapitaInput}
          {selected?.has_ca_hcd_data && preferHcdDataInput}
          {countyList ?? ""}
          <div>
            <CurrentYearExtrapolationInfo />
            {selected?.has_ca_hcd_data && <HcdDataInfo />}
          </div>
        </div>
        <DownloadData
          data={data}
          name={selected?.name + ".json"}
          selected={selected?.name}
        />
      </div>
    </div>
  )
}

export function DownloadData({
  data,
  name,
  selected,
}: {
  data: object
  name: string
  selected: Any
}): JSX.Element {
  const url = useRef("#")

  // This runs every time selected changes
  useEffect(() => {
    url.current = URL.createObjectURL(
      new Blob([JSON.stringify(data)], { type: "octet/stream" })
    )
    // Cleanup function
    return () => {
      if (url.current != "#" && typeof window !== "undefined") {
        URL.revokeObjectURL(url.current)
      }
    }
  }, [selected])

  return (
    <a
      href={url.current}
      className="text-sm text-blue-500 hover:text-blue-300"
      download={name}
    >
      download data
    </a>
  )
}
