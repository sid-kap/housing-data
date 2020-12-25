import Link from 'next/link'
import Head from 'next/head'

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

export function Nav (props) {
  const currentIndex = props.currentIndex
  const classes = []
  for (let i = 0; i < 6; i++) {
    if (i === currentIndex) {
      classes.push('py-2 px-3 bg-purple-400 hover:bg-purple-100')
    } else {
      classes.push('py-2 px-3 bg-purple-300 hover:bg-purple-100')
    }
  }
  return (
    <nav className='flex bg-purple-200'>
      <Link href='https://housingdata.app'>
        <a className='py-1 px-2 font-semibold text-xl tracking-tight'>
          <span className='text-blue-600'>housing</span>
          <span className='text-green-600'>data</span>
          <span className='text-gray-600'>.app</span>
        </a>
      </Link>
      <Link href='/'>
        <a className={classes[0]}>State Comparisons</a>
      </Link>
      <Link href='/states/Alabama'>
        <a className={classes[1]}>States</a>
      </Link>
      <Link href='/metros/Bakersfield, CA'>
        <a className={classes[2]}>Metros</a>
      </Link>
      <Link href='/counties/TX/Harris County'>
        <a className={classes[3]}>Counties</a>
      </Link>
      <Link href='/places/CA/Los Angeles'>
        <a className={classes[4]}>Cities</a>
      </Link>
      <Link href='/data-sources'>
        <a className={classes[5]}>Data Sources/FAQ</a>
      </Link>
    </nav>
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
