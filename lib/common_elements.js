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
  const elemClasses = 'p-2 bg-purple-200 hover:bg-purple-100'
  return (
    <div className='flex bg-purple-100'>
      <a className={elemClasses} href='/'>State Comparisons</a>
      <a className={elemClasses} href='/states/Alabama'>States</a>
      <a className={elemClasses} href='/places/CA/Los Angeles'>Cities</a>
    </div>
  )
}
