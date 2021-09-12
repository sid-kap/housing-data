import argparse
from subprocess import Popen

from housing_data import county_population
from housing_data.build_counties import load_counties
from housing_data.build_data_utils import (
    COUNTY_POPULATION_DIR,
    GITHUB_DATA_REPO_DIR,
    PUBLIC_DIR,
)
from housing_data.build_metros import load_metros
from housing_data.build_places import load_places
from housing_data.build_states import load_states


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--use-data-repo",
        help="Use data from https://github.com/sid-kap/housing-data-data "
        "rather than pulling directly from the Census website.",
        action="store_true",
    )
    args = parser.parse_args()
    print("Args:", args)

    # Make sure the public/ directory exists
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    if args.use_data_repo:
        # Download the source data repo
        Popen(
            [
                "git",
                "clone",
                "https://github.com/sid-kap/housing-data-data",
                str(GITHUB_DATA_REPO_DIR),
            ]
        ).wait()

    load_states(args.use_data_repo)

    print("Loading county population data...")
    county_population_df = county_population.get_county_population_estimates(
        data_path=COUNTY_POPULATION_DIR if args.use_data_repo else None
    )
    county_population_df.to_parquet(PUBLIC_DIR / "county_populations.parquet")

    raw_places_df = load_places(args.use_data_repo, county_population_df)
    counties_df = load_counties(args.use_data_repo, raw_places_df, county_population_df)
    load_metros(counties_df, args.use_data_repo)


if __name__ == "__main__":
    main()
