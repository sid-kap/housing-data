import { useState } from "react"

import { useRouter } from "next/router"

import StatePlots from "lib/StatePlots"
import { Page } from "lib/common_elements"

export default function State(): JSX.Element {
  const [title, setTitle] = useState("Housing Data")
  const router = useRouter()

  // Remove /states prefix from path
  const path = router.asPath.split("/").slice(2).join("/")

  return (
    <Page title={title} navIndex={1}>
      <StatePlots path={path} setTitle={setTitle} />
    </Page>
  )
}
