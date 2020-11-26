import { useRouter } from "next/router";
import styles from "../../styles/Home.module.css";
import Head from "next/head";
import { useStateData } from "../../lib/data_loader.js";
import LineChart from "../LineChart.js";
import Select from "react-select";
import { useState, useEffect } from "react";
import { VegaLite } from "react-vega";

function* fields_generator(
  types = ["bldgs", "units", "value"],
  suffixes = ["_reported", ""]
) {
  for (let num_units of ["1_unit", "2_units", "3_to_4_units", "5_plus_units"]) {
    for (let type of types) {
      for (let suffix of suffixes) {
        yield num_units + "_" + type + suffix;
      }
    }
  }
}

const fields = Array.from(fields_generator());

function spec(units) {
  const filterFields = Array.from(fields_generator([units], [""]));

  return {
    width: 800,
    height: 600,
    encoding: {
      x: { field: "year", type: "temporal" },
      y: { field: "value", type: "quantitative" },
      color: { field: "key", type: "nominal" },
    },
    transform: [
      { fold: fields },
      {
        filter: {
          field: "key",
          oneOf: filterFields,
        },
      },
    ],
    data: { name: "table" }, // note: vega-lite data attribute is a plain object instead of an array
    usermeta: { embedOptions: { renderer: "svg" } },
    layer: [
      {
        mark: "bar",
        encoding: {
          x: {
            field: "year",
          },
          y: {
            field: "value",
          },
          color: {
            field: "key",
            scale: {
              scheme: "tableau10",
            },
          },
        },
        tooltip: true,
      },
    ],
    config: {
      bar: {
        continuousBandSize: 10,
      },
    },
  };
}

const unitsOptions = [
  { value: "units", label: "Units" },
  { value: "bldgs", label: "Buildings" },
  { value: "value", label: "Property value" },
];

const customStyles = {
  container: (provided) => ({
    ...provided,
    width: 150,
  }),
};

const statePickerStyles = {
  container: (provided) => ({
    ...provided,
    width: 300,
  }),
};

export default function State() {
  const router = useRouter();
  const { state: stateName } = router.query;

  const [request, response] = useStateData();

  const filteredData = response.data.filter(
    (row) => row.state_name == stateName
  );

  const data = { table: filteredData };

  const [selectedUnits, setSelectedUnits] = useState({
    value: "units",
    label: "Units",
  });

  const [stateOptions, setStateOptions] = useState([]);

  useEffect(() => {
    let stateNames = response.data
      .filter((row) => row.type == "state")
      .map((row) => row.state_name)
      .filter((row) => row != null);
    stateNames = Array.from(new Set(stateNames));
    setStateOptions(
      stateNames.map((state) => ({
        value: state,
        label: state,
      }))
    );
  }, [response.status]);

  return (
    <div>
      <Head>
        <title>{stateName}</title>
      </Head>

      <div className="grid grid-cols-3">
        <Select
          styles={statePickerStyles}
          defaultValue={stateName}
          onChange={(newState) =>
            newState != stateName
              ? router.push("/states/" + newState.value)
              : null
          }
          options={stateOptions}
          className="m-4 col-span-1"
          placeholder="Change state..."
          size={0.1}
        />

        <h1 className="mt-4 text-4xl col-span-1 text-center">{stateName}</h1>

        <div className="col-span-1" />
      </div>

      <div className={styles.container}>
        <Select
          styles={customStyles}
          defaultValue={selectedUnits}
          onChange={setSelectedUnits}
          options={unitsOptions}
          className="m-4"
        />

        <VegaLite spec={spec(selectedUnits.value)} data={data} />

        <table className="m-4 table-auto border border-black rounded-lg">
          <thead>
            <tr className="bg-green-500 text-gray-800">
              <th className="p-1 border border-black">Year</th>
              <th className="p-1 border border-black">Single-fam units</th>
              <th className="p-1 border border-black">2-unit units</th>
              <th className="p-1 border border-black">3-4 unit units</th>
              <th className="p-1 border border-black">5+ unit units</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((value, index) => (
              // toLocaleString adds thousands separator
              <tr key={index}>
                <td className="p-1 border border-black">{value.year}</td>
                <td className="p-1 border border-black">
                  {value["1_unit_units"].toLocaleString("en")}
                </td>
                <td className="p-1 border border-black">
                  {value["2_units_units"].toLocaleString("en")}
                </td>
                <td className="p-1 border border-black">
                  {value["3_to_4_units_units"].toLocaleString("en")}
                </td>
                <td className="p-1 border border-black">
                  {value["5_plus_units_units"].toLocaleString("en")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
