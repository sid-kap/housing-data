from pathlib import Path
from typing import Optional

import pandas as pd
from housing_data import county_population
from housing_data.build_data_utils import (
    COUNTY_POPULATION_DIR,
    NUMERICAL_COLUMNS,
    PUBLIC_DIR,
    add_per_capita_columns,
    get_state_abbrs,
    load_bps_all_years_plus_monthly,
)


def load_counties(
    data_repo_path: Optional[Path],
    places_df: pd.DataFrame = None,
    population_df: pd.DataFrame = None,
) -> pd.DataFrame:
    """
    :param population_df: (Optional) pass in a pre-loaded population df, so that we don't have to load it twice.
        Useful since county population data is used twice (here, and also in `load_places` for NYC boroughs,
        which show up in places also).
    """
    # The county data only goes back to 1990 :(
    # To get 1980 to 1990, we have to sum up the cities + unincorporated areas in each county
    counties_df = load_bps_all_years_plus_monthly(
        data_repo_path, "county", start_year=1990
    )

    if places_df is not None:
        imputed_counties_df = impute_pre_1990_counties(counties_df, places_df)
        counties_df = pd.concat([counties_df, imputed_counties_df])

    # In some cases the county name is fucked up in some subset of years.
    # Let's just make it consistent by choosing the most recent one
    # Get the county_name of the most recent record (this is ok because the
    # imputed ones are all at the beginning of the time range)
    metadata_df = counties_df[["fips_state", "fips_county", "county_name", "year"]]
    metadata_df = (
        metadata_df.sort_values("year")
        .drop_duplicates(subset=["fips_state", "fips_county"], keep="last")
        .drop(columns="year")
    )

    counties_df = counties_df.drop(columns=["county_name"]).merge(
        metadata_df, on=["fips_state", "fips_county"], how="left"
    )

    if population_df is None:
        population_df = county_population.get_county_population_estimates(
            data_repo_path / COUNTY_POPULATION_DIR if data_repo_path else None
        )

    counties_df = counties_df.merge(
        population_df,
        how="left",
        left_on=["fips_county", "fips_state", "year"],
        right_on=["county_code", "state_code", "year"],
    )
    add_per_capita_columns(counties_df)

    # TODO figure out why some are null/which ones are getting dropped
    counties_df = counties_df[counties_df["county_name"].notnull()]

    state_abbrs = get_state_abbrs(counties_df["fips_state"])
    counties_df["name"] = counties_df["county_name"] + ", " + state_abbrs
    counties_df["path_1"] = state_abbrs
    counties_df["path_2"] = counties_df["county_name"].str.replace(" ", "_")
    counties_df = counties_df.drop(columns=["county_name"])

    counties_df.to_parquet(PUBLIC_DIR / "counties_annual.parquet")

    return counties_df


def impute_pre_1990_counties(
    counties_df: pd.DataFrame, places_df: pd.DataFrame
) -> pd.DataFrame:
    summed_places_df = (
        places_df.groupby(["county_code", "state_code", "year"])[NUMERICAL_COLUMNS]
        .sum()
        .reset_index()
    )

    imputed_counties_df = summed_places_df[summed_places_df["year"] < "1990"].copy()
    imputed_counties_df["imputed"] = True
    imputed_counties_df = imputed_counties_df.rename(
        columns={"county_code": "fips_county", "state_code": "fips_state"}
    )

    return imputed_counties_df
