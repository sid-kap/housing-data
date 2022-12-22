import { useState } from "react"

import { useRouter } from "next/router"

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
