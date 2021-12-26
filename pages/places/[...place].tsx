import { useRouter } from "next/router"
import PlacePlots from "../../lib/PlacePlots"
import { Page } from "../../lib/common_elements"

export default function Place() {
  const router = useRouter()
  const [state, place] = (router.query.place as [string, string]) ?? [
    null,
    null,
  ]

  return (
    <Page title={place ? place + ", " + state : "Housing Data"} navIndex={4}>
      <PlacePlots place={place} state={state} />
    </Page>
  )
}
