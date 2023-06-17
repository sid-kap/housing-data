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
  populationInput: JSX.Element
} {
  const [denom, setDenom] = useState<Denom>("total")
  const [preferAprData, setPreferAprData] = useState<boolean>(true)
  const populationInput = (
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
      <div className="mt-2">
        <label className="mr-3">
          <input
            type="checkbox"
            checked={preferAprData}
            onChange={() => setPreferAprData(!preferAprData)}
          />
          <span className="ml-1">Prefer HCD APR data</span>
        </label>
      </div>
    </div>
  )

  return {
    denom: denom,
    preferAprData: preferAprData,
    populationInput: populationInput,
  }
}
