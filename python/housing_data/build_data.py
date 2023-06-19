import argparse
from pathlib import Path

import pandas as pd
from housing_data.build_counties import load_counties
from housing_data.build_data_utils import (
    COUNTY_POPULATION_DIR,
    PUBLIC_DIR,
    add_per_capita_columns,
    write_list_json,
    write_to_json_directory,
)
from housing_data.build_metros import load_metros
from housing_data.build_places import load_places
from housing_data.build_states import load_states
from housing_data.california_apr import load_california_apr_data
from housing_data.canada_bper import load_canada_bper
from housing_data.county_population import get_county_population_estimates


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--data-repo-path",
        help="Use data from the given data repo path rather than pulling directly from the Census website.",
    )
    args = parser.parse_args()
    print("Args:", args)
    data_repo_path = Path(args.data_repo_path)

    # Make sure the public/ directory exists
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    states_df = load_states(data_repo_path)

    print("Loading county population data...")
    county_population_df = get_county_population_estimates(
        data_path=data_repo_path / COUNTY_POPULATION_DIR
        if args.data_repo_path
        else None,
        data_repo_path=data_repo_path if args.data_repo_path else None,
    )

    raw_places_df, places_df = load_places(data_repo_path, county_population_df)
    counties_df = load_counties(data_repo_path, raw_places_df, county_population_df)

    (
        california_places_df,
        california_counties_df,
        california_states_df,
    ) = load_california_apr_data(data_repo_path)

    # For California rows, add APR columns for units and buildings (not available for value)
    places_df = places_df.merge(
        california_places_df.assign(has_ca_hcd_data=True),
        on=["place_or_county_code", "state_code", "year"],
        how="left",
    )
    places_df["has_ca_hcd_data"] = places_df["has_ca_hcd_data"].fillna(False)

    counties_df = counties_df.merge(
        california_counties_df.assign(state_code=6, has_ca_hcd_data=True).astype(
            {"county_code": "Int64", "state_code": "Int64"}
        ),
        on=["county_code", "state_code", "year"],
        how="left",
    )
    counties_df["has_ca_hcd_data"] = counties_df["has_ca_hcd_data"].fillna(False)

    states_df = states_df.merge(
        california_states_df.assign(has_ca_hcd_data=True).astype(
            {"state_code": "Int64"}
        ),
        on=["state_code", "year"],
        how="left",
    )
    states_df["has_ca_hcd_data"] = states_df["has_ca_hcd_data"].fillna(False)

    add_per_capita_columns(places_df)
    add_per_capita_columns(counties_df)
    add_per_capita_columns(states_df)

    places_df.to_parquet(PUBLIC_DIR / "places_annual.parquet")
    counties_df.to_parquet(PUBLIC_DIR / "counties_annual.parquet")
    states_df.to_parquet(PUBLIC_DIR / "states_annual.parquet")

    metros_df = load_metros(data_repo_path, counties_df)
    add_per_capita_columns(metros_df)
    metros_df.to_parquet(PUBLIC_DIR / "metros_annual.parquet")

    (
        canada_places_df,
        canada_counties_df,
        canada_metros_df,
        canada_states_df,
    ) = load_canada_bper(data_repo_path)

    generate_json(
        pd.concat([places_df, canada_places_df]),
        pd.concat([counties_df, canada_counties_df]),
        pd.concat([metros_df, canada_metros_df]),
        pd.concat([states_df, canada_states_df]),
    )


def generate_json(
    places_df: pd.DataFrame,
    counties_df: pd.DataFrame,
    metros_df: pd.DataFrame,
    states_df: pd.DataFrame,
) -> None:
    # Places
    write_list_json(
        places_df,
        PUBLIC_DIR / "places_list.json",
        add_latest_population_column=True,
    )
    write_to_json_directory(places_df, PUBLIC_DIR / "places_data")

    # Metros
    write_list_json(
        metros_df,
        PUBLIC_DIR / "metros_list.json",
        add_latest_population_column=True,
        unhashable_columns=["county_names"],  # can't merge on a list-valued column
        extra_columns=["metro_type", "county_names"],
    )
    write_to_json_directory(
        metros_df.drop(columns=["county_names"]), PUBLIC_DIR / "metros_data"
    )

    # Counties
    write_list_json(
        counties_df.drop(columns=["state_code"]).rename(
            columns={"fips_state": "state_code"}
        ),
        PUBLIC_DIR / "counties_list.json",
        add_latest_population_column=True,
    )
    write_to_json_directory(counties_df, PUBLIC_DIR / "counties_data")

    # States
    write_list_json(
        states_df,
        PUBLIC_DIR / "states_list.json",
        add_latest_population_column=True,
    )
    write_to_json_directory(states_df, PUBLIC_DIR / "states_data")


if __name__ == "__main__":
    main()
