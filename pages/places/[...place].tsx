import { useState } from "react"
import { useRouter } from "next/router"

import PlacePlots from "lib/PlacePlots"
import { Page } from "lib/common_elements"

export default function Place() {
  const [title, setTitle] = useState("Housing Data")
  const router = useRouter()
  // Remove /places
  const path = router.asPath.split("/").slice(2).join("/")

  return (
    <Page title={title} navIndex={4}>
      <PlacePlots path={path} setTitle={setTitle} />
    </Page>
  )
}
