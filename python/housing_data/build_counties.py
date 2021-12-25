from pathlib import Path

import pandas as pd
from housing_data import building_permits_survey as bps
from housing_data import county_population
from housing_data.build_data_utils import (
    BPS_DIR,
    COUNTY_POPULATION_DIR,
    NUMERICAL_COLUMNS,
    PUBLIC_DIR,
    add_per_capita_columns,
    get_state_abbrs,
    write_to_json_directory,
)


def load_counties(
    use_data_repo: bool,
    places_df: pd.DataFrame = None,
    population_df: pd.DataFrame = None,
) -> pd.DataFrame:
    """
    :param population_df: (Optional) pass in a pre-loaded population df, so that we don't have to load it twice.
        Useful since county population data is used twice (here, and also in `load_places` for NYC boroughs,
        which show up in places also).
    """
    dfs = []

    # The county data only goes back to 1990 :(
    # TODO: maybe try to reconstruct the data by summing up the cities?
    # Can verify to see if this is reasonably by comparing on the [1990, 2020] period
    # Note: most cities do have a county code, which seems to stay consistent! So maybe I can just sum up over that.
    for year in range(1990, 2021):
        df = bps.load_data(
            scale="county",
            time_scale="annual",
            year=year,
            month=None,
            region=None,
            data_path=BPS_DIR if use_data_repo else None,
        ).assign(year=str(year))
        dfs.append(df)

    counties_df = pd.concat(dfs)

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
            COUNTY_POPULATION_DIR if use_data_repo else None
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

    counties_df["name"] = (
        counties_df["county_name"] + ", " + get_state_abbrs(counties_df["fips_state"])
    )

    counties_df.to_parquet(PUBLIC_DIR / "counties_annual.parquet")

    (
        counties_df[["county_name", "fips_state"]]
        .rename(columns={"fips_state": "state_code"})
        .drop_duplicates()
        .sort_values("county_name")
        .to_json(PUBLIC_DIR / "counties_list.json", orient="records")
    )

    write_to_json_directory(
        counties_df, Path(PUBLIC_DIR / "counties_data"), ["county_name", "fips_state"]
    )

    return counties_df


def impute_pre_1990_counties(counties_df, places_df):
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
