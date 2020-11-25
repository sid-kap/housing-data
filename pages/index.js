import Head from 'next/head'
import styles from '../styles/Home.module.css'
import LineChart from './LineChart.js'
import useFetch from 'use-http'

const spec_old = {
    width: 800,
    height: 600,
    mark: { type: 'bar', tooltip: true},
    encoding: {
        x: { field: 'a', type: 'ordinal' },
        y: { field: 'b', type: 'quantitative' },
    },
    data: { name: 'table' }, // note: vega-lite data attribute is a plain object instead of an array
};

const spec = {
    width: 800,
    height: 600,
    mark: { type: 'line', tooltip: true},
    encoding: {
        x: { field: 'year', type: 'temporal' },
        y: { field: '1_unit_units', type: 'quantitative' },
        color: { field: 'state_name', type: 'nominal' },
    },
    data: { name: 'table' }, // note: vega-lite data attribute is a plain object instead of an array
};

export default function Home() {
  const [request, response] = useFetch(
      '/state_annual.json',
      { data: [] }, // Default value, until the data is loaded.
      []
  );

  console.log(response.data);
  const data = { table: response.data};

  return (
    <div className={styles.container}>
      <Head>
        <title>Create Next App</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Welcome to <a href="https://nextjs.org">Next.js!</a>
        </h1>

        <p className={styles.description}>
          Get started by editing{' '}
          <code className={styles.code}>pages/index.js</code>
        </p>

        <div className={styles.grid}>
          <a href="https://nextjs.org/docs" className={styles.card}>
            <h3>Documentation &rarr;</h3>
            <p>Find in-depth information about Next.js features and API.</p>
          </a>

          <a href="https://nextjs.org/learn" className={styles.card}>
            <h3>Learn &rarr;</h3>
            <p>Learn about Next.js in an interactive course with quizzes!</p>
          </a>

          <a
            href="https://github.com/vercel/next.js/tree/master/examples"
            className={styles.card}
          >
            <h3>Examples &rarr;</h3>
            <p>Discover and deploy boilerplate example Next.js projects.</p>
          </a>

          <a
            href="https://vercel.com/import?filter=next.js&utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
            className={styles.card}
          >
            <h3>Deploy &rarr;</h3>
            <p>
              Instantly deploy your Next.js site to a public URL with Vercel.
            </p>
          </a>
        </div>
      </main>

      <LineChart spec={spec} data={data} />

      <footer className={styles.footer}>
        <a
          href="https://vercel.com?utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by{' '}
          <img src="/vercel.svg" alt="Vercel Logo" className={styles.logo} />
        </a>
      </footer>
    </div>
  )
}
