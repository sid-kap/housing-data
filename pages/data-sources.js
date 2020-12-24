import { Nav, GitHubFooter } from '../lib/common_elements.js'
import Head from 'next/head'

export default function DataSources () {
  const faq = 'font-semibold mt-4'
  const link = 'text-blue-500 hover:text-blue-300'
  const para = 'mb-2'

  return (
    <div>
      <Head>
        <title>Data Sources/FAQs</title>
        <meta name='viewport' content='width=device-width, initial-scale=1.0' />
      </Head>
      <Nav currentIndex={5} />
      <div className='max-w-2xl mx-auto mb-10 align-center flex flex-col justify-center'>
        <h1 className='mt-4 text-4xl text-center'>Data Sources/FAQs</h1>
        <h2 className={faq}>Where is this data from?</h2>
        <p className={para}>
          The <a className={link} href='https://www.census.gov/construction/bps/'>Building Permits Survey</a> (BPS) is a survey of local governments on the number of new, privately-owned housing units they issued building permits for every year, issued by the US Census Bureau. (Some cities are surveyed every month, while some are surveyed annually.) The form they send out looks like <a className={link} href='https://www.census.gov/construction/bps/pdf/c404.pdf'>this</a>.
        </p>
        <h2 className={faq}>What does "permitted" mean?</h2>
        <p className={para}>Not every housing unit that receives a permit is actually built. Some fraction of "housing permits" becomes a "housing start", and then some fraction of those become "housing completions".</p>
        <p className={para}>The Census also does a survey on housing starts and completions as part of the <a className={link} href='https://www.census.gov/construction/nrc/nrcdatarelationships.html'>Survey of Construction (SOC)</a>. They report that overall, for single-family housing, starts were 2.5% greater than permits, and completions were 3.5% less than starts. For multifamily, starts were 22.5% less than permits, and completions were 7.5% less than starts. I might try to add SOC data here at some point.</p>

        <h2 className={faq}>How accurate is the data?</h2>
        <p className={para}>I'm not sure! They claim that only <a className={link} href='https://www.census.gov/construction/bps/how_the_data_are_collected/#nonresponse'>5% of rows</a> in the 2019 annual data survey had to be imputed because of nonresponse, but that doesn't mean that the officials in each city know how to fill out the form accurately. From other folks who've played with this data, I've gathered that the data is generally more reliable for bigger cities, whose bureaucracy is presumably more competent at filling out these forms, and less so for small towns.</p>
        <h2 className={faq}>I think some of the numbers here look wrong?</h2>
        <p>The Census Bureau has their own <a className={link} href='https://socds.huduser.gov/permits/'>tool</a> for making tables from the BPS, so trying the same state/city and year there and comparing the two numbers might be a good start.</p>
      </div>
      <GitHubFooter />
    </div>
  )
}

// Need to add this to indicate that it's a static page
export async function getStaticProps (context) {
  return {
    props: {}
  }
}
