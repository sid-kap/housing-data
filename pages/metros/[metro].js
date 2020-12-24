import { useState } from 'react'
import { Page } from '../../lib/common_elements.js'
import { useRouter } from 'next/router'

import MetroPlots from '../../lib/MetroPlots.js'

export default function Metro () {
  const router = useRouter()
  const metroPath = router.query.metro ?? null
  const [title, setTitle] = useState(metroPath)
  return (
    <Page title={title} navIndex={2}>
      <MetroPlots metroPath={metroPath} setTitle={setTitle} />
    </Page>
  )
}
