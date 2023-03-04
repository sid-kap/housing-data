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
    </div>
  )

  return {
    denom: denom,
    populationInput: populationInput,
  }
}
