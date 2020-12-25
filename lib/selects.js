import { useState } from 'react'
import SelectSearch from 'react-select-search/dist/cjs'

const unitsOptions = [
  { value: 'units', name: 'Units' },
  { value: 'bldgs', name: 'Buildings' },
  { value: 'value', name: 'Property value' }
]

export function makeUnitsSelect () {
  const [selectedUnits, setSelectedUnits] = useState('units')
  const unitsSelect = (
    <SelectSearch
      value={selectedUnits}
      onChange={setSelectedUnits}
      options={unitsOptions}
    />
  )
  return {
    selectedUnits, unitsSelect
  }
}
