import { Page } from '../../lib/common_elements.js'
import us from 'us'
import CountyPlots from '../../lib/CountyPlots.js'
import { useRouter } from 'next/router'

export default function County () {
  const router = useRouter()
  const [stateAbbr, countyName] = router.query.county ?? [null, null]
  const stateCode = stateAbbr ? getStateFips(stateAbbr) : null

  return (
    <Page title={countyName ? countyName + ', ' + stateAbbr : 'Housing Data'} navIndex={3}>
      <CountyPlots countyName={countyName} stateAbbr={stateAbbr} stateCode={stateCode} />
    </Page>
  )
}

function getStateFips (stateStr) {
  return parseInt(us.lookup(stateStr).fips)
}
