export function GitHubFooter (props) {
  return (
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
