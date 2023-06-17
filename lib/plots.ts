export const NUM_UNITS = [
  "adu",
  "1_unit",
  "2_units",
  "3_to_4_units",
  "5_plus_units",
  "projected",
]

export function* fieldsGenerator(
  types: string[] = ["units", "bldgs", "value"],
  suffixes: string[] = ["", "_per_capita", "_per_capita_per_1000"]
): IterableIterator<string> {
  for (const numUnits of NUM_UNITS) {
    for (const type of types) {
      for (const suffix of suffixes) {
        yield `${numUnits}_${type}${suffix}`
      }
    }
  }
}

export function* aprFieldsPerCapitaGenerator(): IterableIterator<string> {
  for (const numUnits of NUM_UNITS) {
    for (const type of ["units", "bldgs"]) {
      yield `${numUnits}_${type}_apr_per_capita`
    }
  }
}
