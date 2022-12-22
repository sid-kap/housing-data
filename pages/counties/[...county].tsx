import { useRouter } from "next/router"
import { useCallback, useEffect, useMemo, useState } from "react"

import us from "us"

import CountyPlots from "lib/CountyPlots"
import { Page } from "lib/common_elements"

export default function County(): JSX.Element {
  const [title, setTitle] = useState("Housing Data")
  const router = useRouter()

  // Remove /places prefix from path
  const path = router.asPath.split("/").slice(2).join("/")

  return (
    <Page title={title} navIndex={3}>
      <CountyPlots path={path} setTitle={setTitle} />
    </Page>
  )
}
