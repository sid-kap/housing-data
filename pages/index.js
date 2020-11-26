import Head from "next/head";
import styles from "../styles/Home.module.css";
import LineChart from "./LineChart.js";
import useFetch from "use-http";
import Select from "react-select";
import { useState } from "react";
import { useStateData } from "../lib/data_loader.js";
import { VegaLite } from "react-vega";

const spec = {
  width: 800,
  height: 600,
  encoding: {
    x: { field: "year", type: "temporal" },
    y: { field: "1_unit_units", type: "quantitative" },
    color: { field: "state_name", type: "nominal" },
  },
  data: { name: "table" }, // note: vega-lite data attribute is a plain object instead of an array
  usermeta: { embedOptions: { renderer: "svg" } },
  layer: [
    {
      mark: "line",
      encoding: {
        x: {
          field: "year",
          scale: {
            domain: ["1980", "2025"],
          },
        },
        y: {
          field: "1_unit_units",
        },
      },
      tooltip: true,
      point: true,
    },
    {
      mark: "text",
      encoding: {
        x: { aggregate: "max", field: "year" },
        y: { aggregate: { argmax: "year" }, field: "1_unit_units" },
        text: { aggregate: { argmax: "year" }, field: "state_name" },
      },
    },
  ],
  config: {
    text: {
      align: "left",
      dx: 3,
      dy: 1,
    },
  },
};

const options = [
  { value: "state", label: "State" },
  { value: "region", label: "Region" },
  { value: "country", label: "Country" },
  { value: "all", label: "All" },
];

function filterData(data, type) {
  if (type == "all") {
    return data;
  } else {
    return data.filter((row) => row.type == type);
  }
}

export default function Home() {
  const [request, response] = useStateData();

  console.log(response.data);

  const [selectedType, setSelectedOption] = useState({
    value: "all",
    label: "All",
  });
  const customStyles = {
    container: (provided) => ({
      ...provided,
      width: 150,
    }),
  };

  const data = { table: filterData(response.data, selectedType.value) };

  return (
    <div className={styles.container}>
      <Head>
        <title>Housing Data</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Welcome to <a href="https://nextjs.org">Next.js!</a>
        </h1>

        <p className={styles.description}>
          Get started by editing{" "}
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

      <Select
        styles={customStyles}
        defaultValue={selectedType}
        onChange={setSelectedOption}
        options={options}
      />

      <VegaLite spec={spec} data={data} />

      <footer className={styles.footer}>
        <a
          href="https://vercel.com?utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by{" "}
          <img src="/vercel.svg" alt="Vercel Logo" className={styles.logo} />
        </a>
      </footer>
    </div>
  );
}
