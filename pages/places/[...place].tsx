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
      <svg
        height="0"
        width="0"
        xmlns="http://www.w3.org/2000/svg"
        version="1.1"
      >
        {" "}
        <defs>
          {" "}
          <pattern
            id="circles-1"
            patternUnits="userSpaceOnUse"
            width="10"
            height="10"
          >
            {" "}
            <image
              xlinkHref="data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMCcgaGVpZ2h0PScxMCc+CiAgPHJlY3Qgd2lkdGg9JzEwJyBoZWlnaHQ9JzEwJyBmaWxsPSJ3aGl0ZSIgLz4KICA8Y2lyY2xlIGN4PSIxIiBjeT0iMSIgcj0iMSIgZmlsbD0iYmxhY2siLz4KPC9zdmc+"
              x="0"
              y="0"
              width="10"
              height="10"
            >
              {" "}
            </image>{" "}
          </pattern>{" "}
        </defs>{" "}
      </svg>

      <svg
        height="0"
        width="0"
        xmlns="http://www.w3.org/2000/svg"
        version="1.1"
      >
        {" "}
        <defs>
          {" "}
          <pattern
            id="diagonal-stripe-2"
            patternUnits="userSpaceOnUse"
            width="10"
            height="10"
          >
            {" "}
            <image
              xlinkHref="data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMCcgaGVpZ2h0PScxMCc+CiAgPHJlY3Qgd2lkdGg9JzEwJyBoZWlnaHQ9JzEwJyBmaWxsPSd3aGl0ZScvPgogIDxwYXRoIGQ9J00tMSwxIGwyLC0yCiAgICAgICAgICAgTTAsMTAgbDEwLC0xMAogICAgICAgICAgIE05LDExIGwyLC0yJyBzdHJva2U9J2JsYWNrJyBzdHJva2Utd2lkdGg9JzInLz4KPC9zdmc+"
              x="0"
              y="0"
              width="10"
              height="10"
            >
              {" "}
            </image>{" "}
          </pattern>{" "}
        </defs>{" "}
      </svg>
      <PlacePlots place={place} state={state} />
    </Page>
  )
}
