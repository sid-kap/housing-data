import Head from 'next/head'
import { useState } from 'react'
import { Nav, GitHubFooter } from '../../lib/common_elements.js'

// import fs from 'fs'
// import path from 'path'

import MetroPlots from '../../lib/MetroPlots.js'
// const MetroPlots = dynamic(
//   () => import('../../lib/MetroPlots.js'),
//   { ssr: false }
// )

export default function Metro ({ metroPath, metrosList, data }) {
  const [title, setTitle] = useState(metroPath)
  // return <h1>test</h1>
  return (
    <div>
      <Head>
        <meta name='viewport' content='width=device-width, initial-scale=1.0' />
        <title>{title}</title>
      </Head>
      <Nav currentIndex={2} />
      <MetroPlots metroPath={metroPath} metrosList={metrosList} setTitle={setTitle} />
      <GitHubFooter />
    </div>
  )
}

export async function getServerSideProps (context) {
  const metroPath = context.params.metro

  // const metrosList = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/metros_list.json')))
  // const metrosList = []
  const metrosList = null

  const data = null

  // const data = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public', getJsonUrl(metroPath))))
  // const data = []
  // console.log(data)

  return {
    props: {
      metroPath,
      metrosList,
      data
    }
  }
}
