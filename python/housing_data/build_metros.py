from pathlib import Path

import pandas as pd
from housing_data.build_data_utils import (
    NUMERICAL_COLUMNS,
    PUBLIC_DIR,
    add_per_capita_columns,
    write_to_json_directory,
)


def load_metros(counties_df: pd.DataFrame, use_data_repo: bool) -> None:
    counties_df = counties_df.drop(
        columns=[col for col in counties_df.columns if "_per_capita" in col]
    )

    crosswalk_df = pd.read_csv(
        "http://data.nber.org/cbsa-csa-fips-county-crosswalk/cbsa2fipsxw.csv"
    )

    # Could also get county name from 'countycountyequivalent' in crosswalk_df... I'm indifferent, just using the
    # one from counties_df for now.
    crosswalk_df = (
        crosswalk_df[["fipsstatecode", "fipscountycode", "csatitle", "cbsatitle"]]
        .rename(
            columns={
                "fipsstatecode": "fips_state",
                "fipscountycode": "fips_county",
                "csatitle": "csa_name",
                "cbsatitle": "cbsa_name",
            }
        )
        .dropna(subset=["cbsa_name"])[
            ["fips_state", "fips_county", "csa_name", "cbsa_name"]
        ]
    )

    merged_df = crosswalk_df.merge(
        counties_df, on=["fips_state", "fips_county"], how="left"
    )

    columns_to_drop = [
        "fips_state",
        "fips_county",
        "region_code",
        "division_code",
        "survey_date",
    ]

    aggregate_functions = {
        col: pd.NamedAgg(column=col, aggfunc="sum") for col in NUMERICAL_COLUMNS
    }
    aggregate_functions["county_names"] = pd.NamedAgg(
        column="county_name", aggfunc=lambda counties: counties.tolist()
    )
    aggregate_functions["population"] = pd.NamedAgg(column="population", aggfunc="sum")

    cbsas_df = (
        merged_df.drop(columns=["csa_name"] + columns_to_drop)
        .groupby(["cbsa_name", "year"])
        .agg(**aggregate_functions)
        .reset_index()
        .rename(columns={"cbsa_name": "metro_name"})
        .assign(metro_type="cbsa")
    )

    csas_df = (
        merged_df.drop(columns=["cbsa_name"] + columns_to_drop)
        .groupby(["csa_name", "year"])
        .agg(**aggregate_functions)
        .reset_index()
        .rename(columns={"csa_name": "metro_name"})
        .assign(metro_type="csa")
    )

    metros_df = pd.concat([cbsas_df, csas_df])

    add_per_capita_columns(metros_df)
    metros_df["path"] = metros_df["metro_name"].str.replace("/", "-")

    metros_df.to_parquet(PUBLIC_DIR / "metros_annual.parquet")

    (
        metros_df[["metro_name", "metro_type", "path", "county_names"]]
        .drop_duplicates(subset=["metro_name", "metro_type", "path"])
        .sort_values("metro_name")
        .to_json(PUBLIC_DIR / "metros_list.json", orient="records")
    )

    write_to_json_directory(
        metros_df.drop(columns=["county_names"]),
        Path(PUBLIC_DIR, "metros_data"),
        ["path"],
    )
