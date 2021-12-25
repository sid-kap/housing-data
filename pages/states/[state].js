import { useRouter } from "next/router"
import StatePlots from "../../lib/StatePlots.js"
import { Page } from "../../lib/common_elements.js"

export default function State() {
  const router = useRouter()
  const { state } = router.query

  return (
    <Page title={state} navIndex={1}>
      <StatePlots stateName={state} />
    </Page>
  )
}
