function makeIndexLookup(placesList, nameField) {
  const lookupTable = {}

  for (let i = 0; i < placesList.length; i++) {
    lookupTable[placesList[i][nameField]] = i
  }

  return lookupTable
}

export class PathMapping {
    placesList: object[]
    mapping: Map<string, number>
  // Class that makes it easy to get from page path to the relevant row in the place list.
    constructor(placesList: object[], pathFn: (object) => string = (e) => e.path) {
    this.placesList = placesList
    this.mapping = new Map()

    for (let i = 0; i < placesList.length; i++) {
      const row = placesList[i]
      this.mapping[pathFn(row)] = i
    }
  }

  getEntryForPath(path) {
    const index = this.mapping[path]
    return index ? this.placesList[index] : undefined
  }
}
