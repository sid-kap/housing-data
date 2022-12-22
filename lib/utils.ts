/**
 * A scoreFn to use with the fuzzysort library that adds a score factor
 * that depends on log(population) field, so that larger cities surface
 * earlier in the results.
 *
 * Really we just want this to serve as a tie-breaker, so maybe
 * eps * log(population) would be more correct than what we're doing now.
 */
export function scoreFnWithPopulation(a) {
  let max = -9007199254740991
  for (let i = a.length - 1; i >= 0; --i) {
    const result = a[i]
    if (result === null) continue
    const score = result.score
    if (score > max) max = score
  }
  if (max === -9007199254740991) return null
  return max + Math.log(a.obj.population + 1)
}
