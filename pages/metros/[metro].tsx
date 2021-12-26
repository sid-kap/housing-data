import { useState } from "react";
import { Page } from "../../lib/common_elements";
import { useRouter } from "next/router";

import MetroPlots from "../../lib/MetroPlots";

export default function Metro(): JSX.Element {
  const router = useRouter();
  const metroPath = (router.query.metro as string) ?? null;
  const [title, setTitle] = useState(metroPath);
  return (
    <Page title={title} navIndex={2}>
      <MetroPlots metroPath={metroPath} setTitle={setTitle} />
    </Page>
  );
}
