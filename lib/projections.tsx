const currentYear = "2025"
export const projectedUnitsLabel = `Projected units, ${currentYear}*`

const months = {
  1: "January",
  2: "February",
  3: "March",
  4: "April",
  5: "May",
  6: "June",
  7: "July",
  8: "August",
  9: "September",
  10: "October",
  11: "November",
  12: "December",
}

// eslint-disable-next-line @typescript-eslint/no-inferrable-types
const latestMonth: number = 5
const glueWord = latestMonth == 2 ? "and" : "through"
const observedMonths =
  latestMonth == 1
    ? months[latestMonth]
    : `${months[1]} ${glueWord} ${months[latestMonth]}`

export function CurrentYearExtrapolationInfo(): JSX.Element {
  return (
    <>
      <div className="text-xs mt-3 text-left">
        *{currentYear} includes data from {observedMonths}.
      </div>
      <div className="text-xs text-left">
        &nbsp;The remainder of the year is extrapolated from the monthly rate
        from {observedMonths} {currentYear}.
      </div>
    </>
  )
}
