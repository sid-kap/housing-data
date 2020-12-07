import Head from 'next/head'
import dynamic from 'next/dynamic'
import { Nav, GitHubFooter } from '../../lib/common_elements.js'
import us from 'us'

const CountyPlots = dynamic(
  () => import('../../lib/CountyPlots.js'),
  { ssr: false }
)

export default function County ({ countyName, stateAbbr, stateCode }) {
  return (
    <div>
      <Head>
        <meta name='viewport' content='width=device-width, initial-scale=1.0' />
        <title>{countyName + ', ' + stateAbbr}</title>
      </Head>
      <Nav currentIndex={3} />
      <CountyPlots countyName={countyName} stateAbbr={stateAbbr} stateCode={stateCode} />
      <GitHubFooter />
    </div>
  )
}

export async function getServerSideProps (context) {
  const [stateAbbr, countyName] = context.params.county
  const stateCode = getStateFips(stateAbbr)

  return {
    props: {
      countyName,
      stateAbbr,
      stateCode
    }
  }
}

function getStateFips (stateStr) {
  return parseInt(us.lookup(stateStr).fips)
}
