import Link from 'next/link'
import Head from 'next/head'
import { useState, useCallback } from 'react'
import { useMediaQuery } from 'react-responsive'

export function GitHubFooter (props) {
  const linkClasses = 'text-blue-500 hover:text-blue-300'

  return (
    <div>
      <p className='mb-4 mx-4 p-1 text-center bg-purple-200 rounded-lg'>
        This is a work in progress! Feedback and feature ideas are welcome
        on&nbsp;
        <a
          href='https://github.com/sid-kap/housing-data/issues/new'
          className='text-blue-500 hover:text-blue-300'
        >
          GitHub
        </a>
        .
      </p>
      <p className='m-4 text-center text-gray-500 text-xs'>
        Data from the <a className={linkClasses} href='https://www.census.gov/construction/bps/'>US Census Building Permits Survey</a>. Created by <a className={linkClasses} href='http://twitter.com/sidkap_'>Sid Kapur</a>.
      </p>
    </div>
  )
}

// from https://css-tricks.com/snippets/svg/svg-hamburger-menu/
const hamburger = (
  <svg viewBox='0 0 100 80' viewbox='0 0 100 100' style={{ width: '100%', height: '100%' }}>
    <rect width='100' height='15' rx='5' style={{ fill: 'white' }} />
    <rect y='30' width='100' height='15' rx='5' style={{ fill: 'white' }} />
    <rect y='60' width='100' height='15' rx='5' style={{ fill: 'white' }} />
  </svg>
)

function HideableNav ({ logo, items, currentIndex }) {
  const isMobile = useMediaQuery({ maxWidth: 800 })

  const [open, setOpenState] = useState(false)
  const toggle = useCallback(
    () => setOpenState(!open)
  )

  const button = (
    <button onClick={toggle} className='float-right text-2xl bg-purple-500 text-white cursor-pointer rounded p-1 my-1 h-8 mx-1'>
      {hamburger}
    </button>
  )

  const commonClasses = 'py-2 px-3'
  const classes = []
  for (let i = 0; i < 6; i++) {
    if (i === currentIndex) {
      classes.push(commonClasses + ' bg-purple-400 hover:bg-purple-100')
    } else {
      classes.push(commonClasses + ' bg-purple-300 hover:bg-purple-100')
    }
  }

  const children = items.map(
    (item, index) => (
      <Link href={item.url} key={item.url}>
        <a className={classes[index]}>{item.name}</a>
      </Link>
    )
  )

  if (isMobile) {
    return (
      <nav>
        <div className='flex flex-row bg-purple-200'>
          {logo}
          <div className='flex-grow' />
          {button}
        </div>
        <div className={'flex flex-col absolute z-10 bg-gray-100 w-full' + (open ? '' : ' hidden')}>
          {children}
        </div>
      </nav>
    )
  } else {
    return (
      <nav className='flex flex-row bg-purple-200'>
        {logo}
        {children}
      </nav>
    )
  }
}

const logo = (
  <Link href='https://housingdata.app'>
    <a className='py-1 px-2 font-semibold text-xl tracking-tight'>
      <span className='text-blue-600'>housing</span>
      <span className='text-green-600'>data</span>
      <span className='text-gray-600'>.app</span>
    </a>
  </Link>
)

const navItems = [
  {
    url: '/',
    name: 'State Comparisons'
  },
  {
    url: '/states/Alabama',
    name: 'States'
  },
  {
    url: '/metros/Bakersfield, CA',
    name: 'Metros'
  },
  {
    url: '/counties/TX/Harris County',
    name: 'Counties'
  },
  {
    url: '/places/CA/Los Angeles',
    name: 'Cities'
  },
  {
    url: '/data-sources',
    name: 'Data Sources/FAQ'
  }
]

export function Nav ({ currentIndex }) {
  return (
    <HideableNav logo={logo} items={navItems} currentIndex={currentIndex} />
  )
}

export function Page ({ title, navIndex, children }) {
  return (
    <div>
      <Head>
        <title>{title}</title>
        <meta name='viewport' content='width=device-width, initial-scale=1.0' />
      </Head>

      <Nav currentIndex={navIndex} />
      {children}
      <GitHubFooter />
    </div>
  )
}
