import { useRouter } from "next/router";
import StatePlots from "../../lib/StatePlots";
import { Page } from "../../lib/common_elements";

export default function State(): JSX.Element {
  const router = useRouter();
  const { state } = router.query as { state: string };

  return (
    <Page title={state} navIndex={1}>
      <StatePlots stateName={state} />
    </Page>
  );
}
