import { useRouter } from 'next/router'
import PlacePlots from '../../lib/PlacePlots.js'
import { Page } from '../../lib/common_elements.js'

export default function Place () {
  const router = useRouter()
  const [state, place] = router.query.place ?? [null, null]

  return (
    <Page title={place ? place + ', ' + state : 'Housing Data'} navIndex={4}>
      <PlacePlots place={place} state={state} />
    </Page>
  )
}
