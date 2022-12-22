import { useState } from "react"

import { useRouter } from "next/router"

import MetroPlots from "lib/MetroPlots"
import { Page } from "lib/common_elements"

export default function Metro(): JSX.Element {
  const [title, setTitle] = useState("Housing Data")
  const router = useRouter()

  // Remove /metros prefix from path
  const path = router.asPath.split("/").slice(2).join("/")

  return (
    <Page title={title} navIndex={2}>
      <MetroPlots path={path} setTitle={setTitle} />
    </Page>
  )
}
