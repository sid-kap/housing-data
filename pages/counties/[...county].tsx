import { useRouter } from "next/router"

import us from "us"

import CountyPlots from "lib/CountyPlots"
import { Page } from "lib/common_elements"

export default function County(): JSX.Element {
  const router = useRouter()
  const [stateAbbr, countyName] = router.query.county ?? [null, null]
  const stateCode = stateAbbr ? getStateFips(stateAbbr) : null

  return (
    <Page
      title={countyName ? countyName + ", " + stateAbbr : "Housing Data"}
      navIndex={3}
    >
      <CountyPlots
        countyName={countyName}
        stateAbbr={stateAbbr}
        stateCode={stateCode}
      />
    </Page>
  )
}

function getStateFips(stateStr: string): number {
  return parseInt(us.lookup(stateStr).fips)
}
