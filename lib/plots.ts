export function* fieldsGenerator(
  types = ["bldgs", "units", "value"],
  suffixes = ["_reported", ""],
  perCapitaSuffixes = ["", "_per_capita", "_per_capita_per_1000"]
) {
  for (const numUnits of [
    "1_unit",
    "2_units",
    "3_to_4_units",
    "5_plus_units",
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
