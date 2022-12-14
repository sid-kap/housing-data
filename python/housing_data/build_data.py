import argparse
from pathlib import Path

from housing_data import county_population
from housing_data.build_counties import load_counties
from housing_data.build_data_utils import COUNTY_POPULATION_DIR, PUBLIC_DIR
from housing_data.build_metros import load_metros
from housing_data.build_places import load_places
from housing_data.build_states import load_states


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--data-repo-path",
        help="Use data from the given data repo path rather than pulling directly from the Census website.",
    )
    args = parser.parse_args()
    print("Args:", args)

    # Make sure the public/ directory exists
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    load_states(args.data_repo_path)

    print("Loading county population data...")
    county_population_df = county_population.get_county_population_estimates(
        data_path=Path(args.data_repo_path, COUNTY_POPULATION_DIR)
        if args.data_repo_path
        else None
    )
    county_population_df.to_parquet(PUBLIC_DIR / "county_populations.parquet")

    raw_places_df = load_places(args.data_repo_path, county_population_df)
    counties_df = load_counties(
        args.data_repo_path, raw_places_df, county_population_df
    )
    # load_metros(counties_df)


if __name__ == "__main__":
    main()
