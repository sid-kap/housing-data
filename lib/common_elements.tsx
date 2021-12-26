import Link from "next/link"
import Head from "next/head"
import { useState, useCallback } from "react"

export function CurrentYearExtrapolationInfo(props): JSX.Element {
  return (
    <div>
      <div className="text-xs mt-3 text-left">
        *2021 includes data from January–November.
      </div>
      <div className="text-xs text-left">
        &nbsp;The remainder of the year is extrapolated from the monthly rate
        from January to November 2021.
      </div>
    </div>
  )
}

export function GitHubFooter(props): JSX.Element {
  const linkClasses = "text-blue-500 hover:text-blue-300"

  return (
    <div>
      <p className="mb-4 mx-4 p-1 text-center bg-purple-200 rounded-lg">
        This is a work in progress! Feedback and feature ideas are welcome
        on&nbsp;
        <a
          href="https://github.com/sid-kap/housing-data/issues/new"
          className="text-blue-500 hover:text-blue-300"
        >
          GitHub
        </a>
        .
      </p>
      <p className="m-4 text-center text-gray-500 text-xs">
        Data from the{" "}
        <a
          className={linkClasses}
          href="https://www.census.gov/construction/bps/"
        >
          US Census Building Permits Survey
        </a>
        . Created by{" "}
        <a className={linkClasses} href="http://twitter.com/sidkap_">
          Sid Kapur
        </a>
        .
      </p>
    </div>
  )
}

// from https://css-tricks.com/snippets/svg/svg-hamburger-menu/
const hamburger = (
  <svg viewBox="0 0 100 80" style={{ width: "100%", height: "100%" }}>
    <rect width="100" height="15" rx="5" style={{ fill: "white" }} />
    <rect y="30" width="100" height="15" rx="5" style={{ fill: "white" }} />
    <rect y="60" width="100" height="15" rx="5" style={{ fill: "white" }} />
  </svg>
)

function HideableNav({ logo, items, currentIndex }) {
  const [open, setOpenState] = useState(false)
  const toggle = useCallback(
    () => setOpenState((currentOpen) => !currentOpen),
    []
  )

  const button = (
    <button
      onClick={toggle}
      className="bg-purple-500 cursor-pointer rounded p-1 my-1 h-8 w-8 mx-1"
    >
      {hamburger}
    </button>
  )

  const commonClasses = "py-2 px-3 hover:bg-purple-100"
  const classes = []
  for (let i = 0; i < items.length; i++) {
    if (i === currentIndex) {
      classes.push(commonClasses + " bg-purple-400")
    } else {
      classes.push(commonClasses + " bg-purple-300")
    }
  }

  const children = items.map((item, index) => (
    <Link href={item.url} key={item.url}>
      <a className={classes[index]}>{item.name}</a>
    </Link>
  ))

  // Note: I had to set the visible nav using media queries and hidden rather than JS if/else
  // because otherwise NextJS throws an error. (It doesn't like when the static-rendered page
  // and the first rehydrate have different elements or different properties.)
  const mobileNav = (
    <nav className="wide-enough-for-nav:hidden">
      <div className="flex flex-row bg-purple-200">
        {logo}
        <div className="flex-grow" />
        {button}
      </div>
      <div
        className={
          "flex flex-col absolute z-10 bg-gray-100 w-full" +
          (open ? "" : " hidden")
        }
      >
        {children}
      </div>
    </nav>
  )

  const desktopNav = (
    <nav className="flex-row bg-purple-200 hidden wide-enough-for-nav:flex">
      {logo}
      {children}
    </nav>
  )

  return (
    <>
      {mobileNav}
      {desktopNav}
    </>
  )
}

const logo = (
  <Link href="https://housingdata.app">
    <a className="py-1 px-2 font-semibold text-xl tracking-tight">
      <span className="text-blue-600">housing</span>
      <span className="text-green-600">data</span>
      <span className="text-gray-600">.app</span>
    </a>
  </Link>
)

const navItems = [
  {
    url: "/",
    name: "Comparisons",
  },
  {
    url: "/states/Alabama",
    name: "States",
  },
  {
    url: "/metros/Bakersfield, CA",
    name: "Metros",
  },
  {
    url: "/counties/TX/Harris County",
    name: "Counties",
  },
  {
    url: "/places/CA/Los Angeles",
    name: "Cities",
  },
  {
    url: "/data-sources",
    name: "Data Sources/FAQ",
  },
]

export function Nav({ currentIndex }) {
  return (
    <HideableNav logo={logo} items={navItems} currentIndex={currentIndex} />
  )
}

function Favicons() {
  // code and files generated at https://realfavicongenerator.net/favicon_result?file_id=p1eqe14ktav9g1bnv1v22dbm1lb26
  return (
    <>
      <link
        rel="apple-touch-icon"
        sizes="180x180"
        href="/apple-touch-icon.png?v=jw3vaonzmE"
      />
      <link
        rel="icon"
        type="image/png"
        sizes="32x32"
        href="/favicon-32x32.png?v=jw3vaonzmE"
      />
      <link
        rel="icon"
        type="image/png"
        sizes="16x16"
        href="/favicon-16x16.png?v=jw3vaonzmE"
      />
      <link rel="manifest" href="/site.webmanifest?v=jw3vaonzmE" />
      <link
        rel="mask-icon"
        href="/safari-pinned-tab.svg?v=jw3vaonzmE"
        color="#5bbad5"
      />
      <link rel="shortcut icon" href="/favicon.ico?v=jw3vaonzmE" />
      <meta name="apple-mobile-web-app-title" content="Housing Data" />
      <meta name="application-name" content="Housing Data" />
      <meta name="msapplication-TileColor" content="#da532c" />
      <meta name="theme-color" content="#eeeeee" />
    </>
  )
}

export function Page({ title, navIndex, children }) {
  return (
    <div>
      <Head>
        <title>{title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <Favicons />
      </Head>

      <Nav currentIndex={navIndex} />
      {children}
      <GitHubFooter />
    </div>
  )
}
