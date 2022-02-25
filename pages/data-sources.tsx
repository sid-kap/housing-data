import Head from "next/head"

import { GitHubFooter, Nav } from "../lib/common_elements"

export default function DataSources(): JSX.Element {
  const faq = "text-lg font-semibold mt-4 mb-1"
  const link = "text-blue-500 hover:text-blue-300"
  const para = "mb-2"

  return (
    <div>
      <Head>
        <title>Data Sources/FAQs</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <Nav currentIndex={5} />
      <div className="max-w-2xl mx-auto mb-10 align-center flex flex-col justify-center">
        <h1 className="mt-4 text-4xl text-center">Data Sources/FAQs</h1>
        <h2 className={faq}>Where is this data from?</h2>
        <p className={para}>
          The{" "}
          <a className={link} href="https://www.census.gov/construction/bps/">
            Building Permits Survey
          </a>{" "}
          (BPS) is a survey of local governments on the number of new,
          privately-owned housing units they issued building permits for every
          year, issued by the US Census Bureau. (Some cities are surveyed every
          month, while some are surveyed annually.) The form they send out looks
          like{" "}
          <a
            className={link}
            href="https://www.census.gov/construction/bps/pdf/c404.pdf"
          >
            this
          </a>
          .
        </p>
        <h2 className={faq}>What does "permitted" mean?</h2>
        <p className={para}>
          Not every housing unit that receives a permit is actually built. Some
          fraction of "housing permits" start construction and become "housing
          starts", and then some fraction of those become "housing completions".
        </p>
        <p className={para}>
          More detailed information on what fraction of permits become starts or
          completion is in the Census{" "}
          <a
            className={link}
            href="https://www.census.gov/construction/nrc/nrcdatarelationships.html"
          >
            Survey of Construction (SOC)
          </a>
          . Unlike the BPS, the SOC is done only on a sample of cities and
          building projects, so the data would be a little noisier.
        </p>
        <p className={para}>
          To get an overall sense of what fraction of permits become starts or
          completions: the SOC reports that for single-family housing, starts
          are usually 2.5% greater than permits, and completions 3.5% less than
          starts. For multifamily, starts are generally 22.5% less than permits,
          and completions 7.5% less than starts. I might add SOC data here at
          some point.
        </p>

        <h2 className={faq}>How accurate is the data?</h2>
        <p className={para}>
          I'm not sure! They claim that only{" "}
          <a
            className={link}
            href="https://www.census.gov/construction/bps/how_the_data_are_collected/#nonresponse"
          >
            5% of rows
          </a>{" "}
          in the 2019 annual data survey had to be imputed because of
          nonresponse, but that doesn't mean that the officials in each city
          know how to fill out the form accurately. From other folks who've
          played with this data, I've gathered that the data is generally more
          reliable for bigger cities, whose bureaucracy is presumably more
          competent at filling out these forms, and less so for small towns.
        </p>
        <h2 className={faq}>I think some of the numbers here look wrong?</h2>
        <p className={para}>
          The Census Bureau has their own{" "}
          <a className={link} href="https://socds.huduser.gov/permits/">
            tool
          </a>{" "}
          for making tables from the BPS, so trying the same state/city and year
          there and comparing the two numbers might be a good start.
        </p>
        <h2 className={faq}>How are per capita number computed?</h2>
        <p className={para}>
          The "per capita units" number is just the number of new permitted
          units in one year divided by the Census population estimate for that
          year (the July 1 estimate). The plots are shown as "units permitted
          per 1000 residents" so that the numbers are in a scale that is easier
          to understand. Most cities build somewhere between 1 to 15 units per
          1000 population per year.
        </p>
        <p className={para}>
          Most of the population data is from Census yearly intercensal
          estimates. The only exception is places/cities for the years
          1981–1989, for which intercensal estimates weren't available, and so I
          had to take the Census's decade estimates (for 1980 and 1990) and
          linearly interpolate between those two. In most cases the
          approximation shouldn't affect things too much (this isn't{" "}
          <em>that</em> different from how the census creates intercensal
          estimates) but for extremely small cities that may cause some issues.
        </p>
        <h2 className={faq}>Can I play with the data?</h2>
        <p className={para}>
          Yes! The data for states, metros, counties, and places/cities are
          available at:
        </p>
        <ul className={para + " list-disc list-inside ml-2"}>
          <li>
            <a
              className={link}
              href="https://housingdata.app/states_annual.parquet"
            >
              <code>https://housingdata.app/states_annual.parquet</code>
            </a>
          </li>
          <li>
            <a
              className={link}
              href="https://housingdata.app/metros_annual.parquet"
            >
              <code>https://housingdata.app/metros_annual.parquet</code>
            </a>
          </li>
          <li>
            <a
              className={link}
              href="https://housingdata.app/counties_annual.parquet"
            >
              <code>https://housingdata.app/counties_annual.parquet</code>
            </a>
          </li>
          <li>
            <a
              className={link}
              href="https://housingdata.app/places_annual.parquet"
            >
              <code>https://housingdata.app/places_annual.parquet</code>
            </a>
          </li>
        </ul>
        <p className={para}>
          If you're familiar with <code>pandas</code>, it's as easy as
        </p>
        <pre className={para}>
          import pandas as pd
          <br />
          df = pd.read_parquet('https://housingdata.app/states_annual.parquet')
        </pre>
      </div>
      <GitHubFooter />
    </div>
  )
}
