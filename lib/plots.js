export function * fieldsGenerator (
  types = ['bldgs', 'units', 'value'],
  suffixes = ['_reported', '']
) {
  for (const numUnits of [
    '1_unit',
    '2_units',
    '3_to_4_units',
    '5_plus_units'
  ]) {
    for (const type of types) {
      for (const suffix of suffixes) {
        yield numUnits + '_' + type + suffix
      }
    }
  }
}

export const keyMapping = {
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
