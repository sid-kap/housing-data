export class PathMapping<T> {
  placesList: T[]
  mapping: Map<string, number>
  // Class that makes it easy to get from page path to the relevant row in the place list.
  constructor(placesList: T[], pathFn: (object) => string = (e) => e.path) {
    this.placesList = placesList
    this.mapping = new Map()

    for (let i = 0; i < placesList.length; i++) {
      const row = placesList[i]
      this.mapping[pathFn(row)] = i
    }
  }

  getEntryForPath(path: string): T {
    const index = this.mapping[path]
    return index ? this.placesList[index] : undefined
  }
}

/**
 * A scoreFn to use with the fuzzysort library that adds a score factor
 * that depends on log(population) field, so that larger cities surface
 * earlier in the results.
 *
 * Really we just want this to serve as a tie-breaker, so maybe
 * eps * log(population) would be more correct than what we're doing now.
 */
export function scoreFnWithPopulation(a) {
  var max = -9007199254740991
  for (var i = a.length - 1; i >= 0; --i) {
    var result = a[i]
    if (result === null) continue
    var score = result.score
    if (score > max) max = score
  }
  if (max === -9007199254740991) return null
  return max + Math.log(a.obj.population)
}
