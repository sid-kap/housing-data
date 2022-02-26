export function* fieldsGenerator(
  types: string[] = ["bldgs", "units", "value"],
  suffixes: string[] = ["_reported", ""],
  perCapitaSuffixes: string[] = ["", "_per_capita", "_per_capita_per_1000"]
): IterableIterator<string> {
  for (const numUnits of [
    "1_unit",
    "2_units",
    "3_to_4_units",
    "5_plus_units",
    "projected",
  ]) {
    for (const type of types) {
      for (const suffix of suffixes) {
        for (const perCapitaSuffix of perCapitaSuffixes) {
          yield numUnits + "_" + type + suffix + perCapitaSuffix
        }
      }
    }
  }
}
