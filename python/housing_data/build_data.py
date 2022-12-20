import argparse
from pathlib import Path

import pandas as pd
from housing_data import county_population
from housing_data.build_counties import load_counties
from housing_data.build_data_utils import (
    CANADA_BPER_DIR,
    COUNTY_POPULATION_DIR,
    PUBLIC_DIR,
    write_list_to_json,
    write_to_json_directory,
)
from housing_data.build_metros import load_metros
from housing_data.build_places import load_places
from housing_data.build_states import load_states
from housing_data.canada_bper import load_canada_bper


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--data-repo-path",
        help="Use data from the given data repo path rather than pulling directly from the Census website.",
    )
    args = parser.parse_args()
    print("Args:", args)

    # Make sure the public/ directory exists
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    states_df = load_states(args.data_repo_path)

    print("Loading county population data...")
    county_population_df = county_population.get_county_population_estimates(
        data_path=Path(args.data_repo_path, COUNTY_POPULATION_DIR)
        if args.data_repo_path
        else None
    )
    county_population_df.to_parquet(PUBLIC_DIR / "county_populations.parquet")

    raw_places_df, places_df = load_places(args.data_repo_path, county_population_df)
    counties_df = load_counties(
        args.data_repo_path, raw_places_df, county_population_df
    )
    metros_df = load_metros(counties_df)

    canada_places_df = load_canada_bper(Path(args.data_repo_path, CANADA_BPER_DIR))

    generate_json(
        places_df,
        counties_df,
        metros_df,
        states_df,
        canada_places_df,
    )


def generate_json(
    places_df: pd.DataFrame,
    counties_df: pd.DataFrame,
    metros_df: pd.DataFrame,
    states_df: pd.DataFrame,
    canada_places_df: pd.DataFrame,
) -> None:
    # Places
    places_combined_df = pd.concat([places_df, canada_places_df])

    write_list_to_json(
        places_combined_df,
        PUBLIC_DIR / "places_list.json",
        ["place_name", "state_code", "alt_name", "name", "path"],
        add_latest_population_column=True,
    )
    write_to_json_directory(places_combined_df, PUBLIC_DIR / "places_data")

    # Metros
    write_list_to_json(
        metros_df,
        PUBLIC_DIR / "metros_list.json",
        ["name", "metro_name", "metro_name_with_suffix", "metro_type", "path", "county_names"],
        add_latest_population_column=True,
        unhashable_columns=["county_names"],  # can't merge on a list-valued column
    )
    write_to_json_directory(
        metros_df.drop(columns=["county_names"]), PUBLIC_DIR / "metros_data"
    )

    # Counties
    write_list_to_json(
        counties_df.drop(columns=["state_code"]).rename(
            columns={"fips_state": "state_code"}
        ),
        PUBLIC_DIR / "counties_list.json",
        ["name", "county_name", "state_code", "path"],
        add_latest_population_column=True,
    )
    write_to_json_directory(counties_df, PUBLIC_DIR / "counties_data")

    # States
    write_list_to_json(
        states_df,
        PUBLIC_DIR / "states_list.json",
        ["name", "state_name", "path"],
        add_latest_population_column=True,
    )
    write_to_json_directory(states_df, PUBLIC_DIR / "states_data")


if __name__ == "__main__":
    main()
