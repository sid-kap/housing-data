import Head from 'next/head'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Nav, GitHubFooter } from '../../lib/common_elements.js'

const MetroPlots = dynamic(
  () => import('../../lib/MetroPlots.js'),
  { ssr: false }
)

export default function Metro ({ metroPath }) {
  const [title, setTitle] = useState(metroPath)
  return (
    <div>
      <Head>
        <meta name='viewport' content='width=device-width, initial-scale=1.0' />
        <title>{title}</title>
      </Head>
      <Nav currentIndex={2} />
      <MetroPlots metroPath={metroPath} setTitle={setTitle} />
      <GitHubFooter />
    </div>
  )
}

export async function getServerSideProps (context) {
  const metroPath = context.params.metro

  return {
    props: {
      metroPath
    }
  }
}
