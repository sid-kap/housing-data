import us from "us"

export function getStateFips(stateStr: string): number {
  const state = us.lookup(stateStr)
  if (state) {
    return parseInt(state.fips)
  } else {
    return undefined
  }
}

// TODO make this a consistent type
export function getStateAbbreviation(stateCode: number | string): string {
  if (typeof stateCode === "string" && stateCode.startsWith("CA-")) {
    return stateCode.substring(3)
  }
  const twoDigitStringCode = String(stateCode).padStart(2, "0")
  const state = us.lookup(twoDigitStringCode)
  if (typeof state === "undefined") {
    return ""
  } else {
    return state.abbr
  }
}
