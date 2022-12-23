from typing import Dict

import pandas as pd
from housing_data.build_data_utils import (
    NUMERICAL_COLUMNS,
    PUBLIC_DIR,
    add_per_capita_columns,
)


def load_crosswalk_df() -> pd.DataFrame:
    # TODO: cache this file to housing-data-data to speed up builds by a few seconds
    crosswalk_df = pd.read_csv(
        "http://data.nber.org/cbsa-csa-fips-county-crosswalk/cbsa2fipsxw.csv"
    )

    # Drop the μSAs, no one cares about them.
    # Most of them are just one county anyway, so showing the combined metro stats doesn't
    # (in most cases) provide any value beyond what's in the county view.
    crosswalk_df = crosswalk_df[
        crosswalk_df["metropolitanmicropolitanstatis"]
        == "Metropolitan Statistical Area"
    ]

    # Could also get county name from 'countycountyequivalent' in crosswalk_df... I'm indifferent, just using the
    # one from counties_df for now.
    crosswalk_df = (
        crosswalk_df[["fipsstatecode", "fipscountycode", "csatitle", "cbsatitle"]]
        .rename(
            columns={
                "fipsstatecode": "fips_state",
                "fipscountycode": "fips_county",
                "csatitle": "csa_name",
                # This only includes MSAs now, so we can rename CBSA to MSA
                "cbsatitle": "msa_name",
            }
        )
        .dropna(subset=["msa_name"])[
            ["fips_state", "fips_county", "csa_name", "msa_name"]
        ]
    )

    crosswalk_df = crosswalk_df.astype({"fips_state": "Int64", "fips_county": "Int64"})

    return crosswalk_df


def combine_metro_rows(
    df: pd.DataFrame, metro_type: str, crosswalk_df: pd.DataFrame
) -> pd.DataFrame:
    """
    :param metro_type: 'msa' or 'csa'
    """
    assert metro_type in ["msa", "csa"]

    metro_col = f"{metro_type}_name"

    if metro_type == "msa":
        other_metro_col = "csa_name"
        metro_name_suffix = "MSA"
    elif metro_type == "csa":
        other_metro_col = "msa_name"
        metro_name_suffix = "CSA"
    else:
        raise ValueError(f"Unknown metro_type: {metro_type}")

    combined_df = (
        df.drop(columns=[other_metro_col])
        .groupby([metro_col, "year"])
        .agg(**get_aggregate_functions())
        .reset_index()
        .rename(columns={metro_col: "metro_name"})
        .assign(metro_type=metro_type)
    )

    combined_df["metro_name_with_suffix"] = combined_df["metro_name"].str.replace(
        ",", " " + metro_name_suffix + ","
    )

    # Only keep a metros in 2021 if all of its counties were observed.
    # Most counties are actually not observed (yet) in 2021, because lots of cities are only surveyed
    # yearly, not monthly.
    num_counties_in_each_metro = (
        crosswalk_df.groupby(metro_col)
        .size()
        .reset_index(name="num_counties")
        .rename(columns={metro_col: "metro_name"})
    )
    combined_df = combined_df.merge(
        num_counties_in_each_metro, on="metro_name", how="left"
    )

    combined_df = combined_df[
        (combined_df["year"] != "2021")
        | (combined_df["num_observed_counties"] == combined_df["num_counties"])
    ]

    combined_df = combined_df.drop(columns=["num_observed_counties", "num_counties"])

    return combined_df


def get_aggregate_functions() -> Dict[str, pd.NamedAgg]:
    aggregate_functions = {
        col: pd.NamedAgg(column=col, aggfunc="sum") for col in NUMERICAL_COLUMNS
    }
    aggregate_functions["county_names"] = pd.NamedAgg(
        column="name", aggfunc=lambda counties: counties.tolist()
    )
    aggregate_functions["population"] = pd.NamedAgg(column="population", aggfunc="sum")

    # So that we can check if all the counties in a metro were observed in that year
    aggregate_functions["num_observed_counties"] = pd.NamedAgg(
        column="name", aggfunc="count"
    )

    return aggregate_functions


def load_metros(counties_df: pd.DataFrame) -> pd.DataFrame:
    counties_df = counties_df.drop(
        columns=[col for col in counties_df.columns if "_per_capita" in col]
    )

    crosswalk_df = load_crosswalk_df()

    merged_df = crosswalk_df.merge(
        counties_df, on=["fips_state", "fips_county"], how="left"
    ).drop(columns=["fips_state", "fips_county"])

    msas_df = combine_metro_rows(merged_df, "msa", crosswalk_df)
    csas_df = combine_metro_rows(merged_df, "csa", crosswalk_df)

    metros_df = pd.concat([msas_df, csas_df])

    add_per_capita_columns(metros_df)

    metros_df["path_1"] = None
    metros_df["path_2"] = (
        metros_df["metro_name"]
        .str.replace("/", "_")
        .str.replace("-", "_")
        .str.replace(" ", "_")
        .str.replace(",", "")
    )

    # This field is only used in comparison plots in the plotting code.
    # For the plot labels, would like to use the full metro name with the "MSA" or "CSA" suffix.
    metros_df["name"] = metros_df["metro_name_with_suffix"]
    metros_df = metros_df.drop(columns=["metro_name_with_suffix", "metro_name"])

    metros_df.to_parquet(PUBLIC_DIR / "metros_annual.parquet")

    return metros_df
