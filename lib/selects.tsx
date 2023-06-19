import { useState } from "react"

import SelectSearch from "react-select-search/dist/cjs"

const unitsOptions = [
  { value: "units", name: "Units" },
  { value: "bldgs", name: "Buildings" },
  { value: "value", name: "Property value" },
]

export function useUnitsSelect(): {
  selectedUnits: string
  unitsSelect: JSX.Element
} {
  const [selectedUnits, setSelectedUnits] = useState("units")
  const unitsSelect = (
    <SelectSearch
      value={selectedUnits}
      onChange={setSelectedUnits}
      options={unitsOptions}
    />
  )
  return {
    selectedUnits,
    unitsSelect,
  }
}

type Denom = "total" | "per_capita"

export function usePerCapitaInput(): {
  denom: string
  perCapitaInput: JSX.Element
} {
  const [denom, setDenom] = useState<Denom>("total")
  const perCapitaInput = (
    <div>
      <label className="mr-3">
        <input
          type="radio"
          checked={denom === "total"}
          onChange={() => setDenom("total")}
        />
        <span className="ml-1">Total</span>
      </label>
      <label className="mr-3">
        <input
          type="radio"
          checked={denom === "per_capita"}
          onChange={() => setDenom("per_capita")}
        />
        <span className="ml-1">Per capita</span>
      </label>
    </div>
  )

  return {
    denom: denom,
    perCapitaInput: perCapitaInput,
  }
}

export function usePreferHcdDataInput(): {
  preferHcdData: boolean
  preferHcdDataInput: JSX.Element
} {
  const [preferAprData, setPreferAprData] = useState<boolean>(true)
  const preferHcdDataInput = (
    <div className="mt-2">
      <label className="mr-3">
        <input
          type="checkbox"
          checked={preferAprData}
          onChange={() => setPreferAprData(!preferAprData)}
        />
        <span className="ml-1">Prefer California HCD data for 2018–2022†</span>
      </label>
    </div>
  )

  return {
    preferHcdData: preferAprData,
    preferHcdDataInput: preferHcdDataInput,
  }
}

export function HcdDataInfo(): JSX.Element {
  return (
    <>
      <div className="text-xs mt-3 text-left">
        †Use California HCD's{" "}
        <a
          href="https://www.hcd.ca.gov/planning-and-community-development/annual-progress-reports"
          className="text-blue-500 hover:text-blue-300"
        >
          Annual Progress Reports
        </a>{" "}
        data, which is likely more accurate than the Census Building Permits
        Survey, and unlike BPS includes an ADU category.
      </div>
    </>
  )
}
