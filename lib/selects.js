import { useState } from "react"
import SelectSearch from "react-select-search/dist/cjs"

const unitsOptions = [
  { value: "units", name: "Units" },
  { value: "bldgs", name: "Buildings" },
  { value: "value", name: "Property value" },
]

export function makeUnitsSelect() {
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

export function usePerCapitaInput() {
  const [denom, setDenom] = useState("total")
  const populationInput = (
    <div>
      <input
        type="radio"
        checked={denom === "total"}
        value="total"
        onChange={() => setDenom("total")}
      />
      <label htmlFor="total" className="ml-1 mr-3">
        Total
      </label>
      <input
        type="radio"
        checked={denom === "per_capita"}
        value="per_capita"
        onChange={() => setDenom("per_capita")}
      />
      <label htmlFor="per_capita" className="ml-1 mr-3">
        Per capita
      </label>
    </div>
  )

  return {
    denom: denom,
    populationInput: populationInput,
  }
}
