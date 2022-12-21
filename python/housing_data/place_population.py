from __future__ import annotations

from io import StringIO
from pathlib import Path
from typing import TYPE_CHECKING

import numpy as np
import pandas as pd
from housing_data.build_data_utils import impute_2020s_population
from housing_data.data_loading_helpers import get_path, get_url_text

if TYPE_CHECKING:
    from typing import List, Optional


def _get_places_crosswalk_df(data_path: Optional[Path] = None) -> pd.DataFrame:
    df = pd.read_fwf(
        get_path(
            "https://www2.census.gov/geo/tiger/PREVGENZ/pl/us_places.txt", data_path
        )
    )

    df["State Code"] = df["CENSUS"] // 10000
    df["Place Code"] = df["CENSUS"] % 10000
    df = df.rename(columns={"FIPS": "place_fips"})

    df["place_fips"] = df["place_fips"].astype("Int64")

    return df


def get_unincorporated_places_populations_1980() -> pd.DataFrame:
    """
    Manually computes the unincorporated population of each county, by subtracting all
    incorporated jurisdictions from the 1980 county population total.

    We need to do this because sadly nhgis_ds104_1980_place_02398.csv, which has rows for
    "remainder of X county", only includes 31 of 50-something states.

    This is super easy, probably less work than learning how to use the place_02398 dataset.
    I verified that this method gives the same numbers as that other dataset in the
    31 states that are present.
    """
    # TODO download programmatically, add header=1
    counties_df = pd.read_csv("../raw_data/nhgis0015_ds104_1980_county.csv", header=1)
    counties_df = counties_df.rename(columns={"Total": "County Total"})[
        ["County Total", "County Code", "State Code", "County Name"]
    ]
    counties_df["Place Name"] = counties_df["County Name"] + np.where(
        counties_df["State Code"] == 22, " Parish", " County"
    )
    counties_df = counties_df.drop(columns=["County Name"])

    places_df = pd.read_csv("../raw_data/nhgis0015_ds104_1980_place_070.csv", header=1)

    # We can't simply add up the CDPs and "REMAINDER OF <county subdivision name>" rows and
    # assume that that equals the total unincorporated population... because it empirically
    # doesn't, if we compare against nhgis0015_ds104_1980_place_02398.csv.
    # This is why the county dataset is needed.
    unincorp_rows = places_df["Area Name"].str.contains("CDP") | (
        places_df["Place Code"] == 9999
    )
    county_cities_total_df = (
        places_df[~unincorp_rows]
        .groupby(["County Code", "State Code"])["Total"]
        .sum()
        .rename("County Cities Total")
        .reset_index()
    )

    remainder_df = counties_df.merge(
        county_cities_total_df, on=["County Code", "State Code"], how="left"
    )

    remainder_df["place_or_county_code"] = (
        remainder_df["County Code"].astype(str) + "_county"
    )
    remainder_df["Total"] = remainder_df["County Total"] - remainder_df[
        "County Cities Total"
    ].fillna(0)

    remainder_df = remainder_df.drop(columns=["County Total", "County Cities Total"])

    return remainder_df


def get_place_populations_1980(data_path: Optional[Path]) -> pd.DataFrame:
    # Assuming this is run from `python/`
    # For the header row, use the nice descriptive names that IPUMS provides rather than the code names
    df = pd.read_csv("../raw_data/nhgis0015_ds104_1980_place_070.csv", header=1)

    df = df[
        [
            "Place Name",
            "Place Code",
            "State Code",
            "County Code",
            "County Name",
            "Total",
            "Area Name",
        ]
    ].copy()

    # In 1980, FIPS wasn't a thing so the census had a separate coding system for places.
    # Luckily, there is a crosswalk available that we can use to convert 1980 Census Place Codes to FIPS.
    crosswalk_df = _get_places_crosswalk_df(data_path)
    old_len = len(df)
    df = df.merge(
        crosswalk_df.drop(columns=["NAME"]), how="left", on=["Place Code", "State Code"]
    )
    assert len(df) == old_len

    # 9999 indicates balance of county. That makes this super easy, IPUMS is great!
    unincorp_rows = (df["Place Code"] == 9999) | df["Area Name"].str.contains("CDP")
    df = df[~unincorp_rows]

    df = df.drop(columns=["Area Name"])

    df["place_or_county_code"] = df["place_fips"].astype(str)

    # Combine cities that are spread across multiple counties
    df = (
        df.groupby(["Place Name", "place_or_county_code", "State Code"])[["Total"]]
        .sum()
        .reset_index()
    )

    df = pd.concat([df, get_unincorporated_places_populations_1980()])

    df = df.rename(
        columns={
            "Place Name": "place_name",
            "State Code": "state_code",
            "Total": "population",
        }
    )

    df["year"] = "1980"
    df = df.drop(columns=["County Code"])

    # A few rare dupes we found... I don't care about this for now
    df = df[
        (df["place_or_county_code"] != "<NA>")
        & ~((df["place_or_county_code"] == "69336") & (df["state_code"] == 42))
    ]

    # Fix Miami-Dade County name and code
    dade_county = (df["place_or_county_code"] == "25_county") & (df["state_code"] == 12)
    df.loc[dade_county, "place_name"] = "Miami-Dade County"
    df.loc[dade_county, "place_or_county_code"] = "86_county"

    return df


def _load_raw_place_populations_1990s(data_path: Optional[Path]) -> pd.DataFrame:
    tables = get_url_text(
        "https://www2.census.gov/programs-surveys/popest/tables/1990-2000/"
        "2000-subcounties-evaluation-estimates/sc2000f_us.txt",
        data_path,
    ).split("\f")

    common_cols = [
        "Block",
        "type",
        "state_fips",
        "county_fips",
        "subcounty_fips",
        "place_fips",
        "state_abbr",
        "place",
    ]

    date_cols_0 = [
        "2000-04-01",
        "2000-07-01",
        "1999-07-01",
        "1998-07-01",
        "1997-07-01",
        "1996-07-01",
        "1995-07-01",
    ]
    date_cols_1 = [
        "1994-07-01",
        "1993-07-01",
        "1992-07-01",
        "1991-07-01",
        "1990-07-01",
        "1990-04-01",
    ]

    nameses = [
        common_cols + date_cols_0,
        common_cols + date_cols_0,
        common_cols + date_cols_1,
        common_cols + date_cols_1,
    ]

    dfs = []
    for table_str, names in zip(tables, nameses):
        start_index = table_str.index("Block")
        table_str = table_str[start_index:]

        io = StringIO(table_str)
        io.readline()
        io.readline()

        df = pd.read_fwf(io, names=names, index_col=False, infer_nrows=5000)
        dfs.append(df)

    df_1 = pd.concat([dfs[0], dfs[1]])
    df_2 = pd.concat([dfs[2], dfs[3]])

    combined_df = df_1.merge(
        df_2,
        on=[
            "place",
            "state_abbr",
            "state_fips",
            "county_fips",
            "subcounty_fips",
            "place_fips",
        ],
        how="outer",
    )

    combined_df = combined_df[
        [
            "place",
            "state_abbr",
            "state_fips",
            "county_fips",
            "subcounty_fips",
            "place_fips",
        ]
        + [f"{year}-07-01" for year in range(1990, 2001)]
    ].copy()

    # Cast from float to nullable int
    combined_df["place_fips"] = combined_df["place_fips"].astype("Int64")

    return combined_df


def _fix_place_names(place_names: pd.Series) -> pd.Series:
    """
    For the 1990s dataset
    """
    suffixes = ["city", "village", "town", "township", "borough"]

    replace_pt_strings = [
        (f" {suffix} \\(pt.\\)$", " " + suffix) for suffix in suffixes
    ]

    for s1, s2 in replace_pt_strings:
        place_names = place_names.str.replace(s1, s2, regex=True)

    place_names = place_names.str.replace("^Balance of ", "", regex=True)
    place_names = place_names.str.replace(r" \(balance\)$", "", regex=True)

    return place_names


def remove_dupe_cities(df: pd.DataFrame) -> pd.DataFrame:
    """
    If there are two places in the same state with different place_fips codes, then fuck it I have no idea which city
    s which (recall that BPS before 2000 doesn't have place FIPS codes---they may not have existed back then).
    I'm deleting those rows

    Operates on a "wide format" DataFrame where the years are all in separate columns.
    (Otherwise we'd need to group by 'year' also when finding dupes.)
    """
    dupes = df.groupby(["place_name", "state_code"]).size().loc[lambda x: x > 1]
    dupe_cities = set(
        dupes.reset_index()[["place_name", "state_code"]]
        .drop_duplicates()
        .itertuples(index=False, name=None)
    )

    place_state_tuples = pd.Series(
        list(zip(df["place_name"], df["state_code"])), index=df.index
    )
    return df[~place_state_tuples.isin(dupe_cities)]


def get_place_populations_1990s(data_path: Optional[Path]) -> pd.DataFrame:
    combined_df = _load_raw_place_populations_1990s(data_path)

    city_rows = (
        combined_df["subcounty_fips"].isnull() & combined_df["place_fips"].notnull()
    )

    # In our place dataset, county means the balance of the county.
    # So only keep rows that either don't contain county, or contain balance of,
    # and then rename those to just "X County" (remove the "Balance of")
    county_rows = combined_df["place"].str.contains("Balance of.*County")

    combined_df = combined_df[city_rows | county_rows].copy()
    combined_df["place"] = _fix_place_names(combined_df["place"])

    numerical_columns = [f"{year}-07-01" for year in range(1990, 2001)]
    for col in numerical_columns:
        combined_df[col] = combined_df[col].str.replace(",", "").astype(int)

    combined_df["place_or_county_code"] = (
        combined_df["place_fips"]
        .astype(str)
        .where(
            combined_df["place_fips"].notnull(),
            combined_df["county_fips"].astype(str) + "_county",
        )
    )

    # Combine the parts of cities that are in different counties
    combined_df = (
        combined_df.drop(columns=["county_fips", "subcounty_fips"])
        .groupby(
            ["place", "state_abbr", "state_fips", "place_fips", "place_or_county_code"],
            dropna=False,
        )
        .sum()
        .reset_index()
    )

    rename_dict = {"place": "place_name", "state_fips": "state_code"}
    rename_dict.update({f"{year}-07-01": f"{year}" for year in range(1990, 2001)})
    combined_df = combined_df.rename(columns=rename_dict)

    # First confirm that the only dupes (same place and state) is if they have different fips
    assert (
        combined_df.groupby(
            ["place_name", "state_code", "place_fips", "place_or_county_code"]
        )
        .size()
        .loc[lambda x: x > 1]
        .size
        == 0
    )

    combined_df = remove_dupe_cities(combined_df)

    combined_df = combined_df.drop(columns=["state_abbr", "place_fips"])

    return combined_df.melt(
        id_vars=["place_name", "state_code", "place_or_county_code"],
        var_name="year",
        value_name="population",
    )


def _get_recent_decades_df(
    url: str, has_consolidated_cities: bool, years: List[int]
) -> pd.DataFrame:
    df = pd.read_csv(url, encoding="latin_1")

    state_rows = (df["COUNTY"] == 0) & (df["PLACE"] == 0)

    if has_consolidated_cities:
        not_consolidated_city_rows = df["CONCIT"] == 0
    else:
        not_consolidated_city_rows = pd.Series(True, index=df.index)

    # WOWWWW the format is so nice!!! makes things so easy!!
    df = df[
        (
            (df["COUNTY"] == 0)  # indicates total of a city across all counties it's in
            | (df["PLACE"] == 99990)  # indicates a "Balance of county" record
        )
        & (df["COUSUB"] == 0)  # remove townships and shit (county subdivisions)
        & not_consolidated_city_rows
        & ~state_rows  # remove states
    ].copy()

    df["place_or_county_code"] = (
        df["PLACE"]
        .astype(str)
        .where(df["PLACE"] != 99990, df["COUNTY"].astype(str) + "_county")
    )

    df = df[
        ["NAME", "STATE", "place_or_county_code"]
        + [f"POPESTIMATE{year}" for year in years]
    ]

    rename_dict = {"NAME": "place_name", "STATE": "state_code"}
    rename_dict.update({f"POPESTIMATE{year}": f"{year}" for year in years})
    df = df.rename(columns=rename_dict)

    df = remove_dupe_cities(df)

    df["place_name"] = df["place_name"].str.replace("^Balance of ", "", regex=True)

    return df.melt(
        id_vars=["place_name", "place_or_county_code", "state_code"],
        var_name="year",
        value_name="population",
    )


def get_place_populations_2000s(data_path: Optional[Path]) -> pd.DataFrame:
    # This one doesn't include consolidated cities, so no need to remove those rows
    return _get_recent_decades_df(
        get_path(
            "https://www2.census.gov/programs-surveys/popest/datasets/2000-2010/intercensal/cities/sub-est00int.csv",
            data_path,
        ),
        has_consolidated_cities=False,
        years=list(range(2000, 2011)),
    )


def get_place_populations_2010s(data_path: Optional[Path]) -> pd.DataFrame:
    # This one has consolidated cities that need to be removed
    return _get_recent_decades_df(
        get_path(
            "https://www2.census.gov/programs-surveys/popest/datasets/2010-2020/cities/SUB-EST2020_ALL.csv",
            data_path,
        ),
        has_consolidated_cities=True,
        years=list(range(2010, 2021)),
    )


def interpolate_1980s_populations(
    df_1980: pd.DataFrame, df_1990s: pd.DataFrame
) -> pd.DataFrame:
    """
    Since we don't have yearly intercensal estimates for the 1980s, linear interp the city populations
    for 1981-1989.
    """
    start_df = df_1980[["state_code", "place_or_county_code", "population"]].rename(
        columns={"population": "1980"}
    )
    end_df = df_1990s.query('year == "1990"')[
        ["state_code", "place_or_county_code", "population"]
    ].rename(columns={"population": "1990"})
    assert start_df["1980"].notnull().all()
    assert end_df["1990"].notnull().all()

    interp_df = start_df.merge(
        end_df,
        on=["state_code", "place_or_county_code"],
        how="inner",  # only interp rows that have both start and end data
    )
    interp_df[[f"{year}" for year in range(1981, 1990)]] = None
    interp_df = interp_df.sort_index(axis="columns")
    interp_df = interp_df.melt(
        id_vars=["state_code", "place_or_county_code"],
        var_name="year",
        value_name="population",
    ).sort_values(["state_code", "place_or_county_code", "year"])

    # linear interpolate for now! but pandas has more options I could look into...
    interp_df["population"] = interp_df["population"].astype(float).interpolate()
    interp_df = interp_df[interp_df["year"] != "1990"]

    # Add back place_name
    interp_df = interp_df.merge(
        df_1990s[
            ["state_code", "place_or_county_code", "place_name"]
        ].drop_duplicates(),
        on=["state_code", "place_or_county_code"],
        how="left",
    )

    return interp_df


def get_place_population_estimates(data_path: Optional[Path] = None) -> pd.DataFrame:
    """
    Returns a DataFrame with the columns:
    - state_code (int)
    - place_or_county_code (str): either a place code (e.g. 12345) or a county code (e.g. 12345_county)
    - place_name (str)
    - year (str)
    - population (float)

    Note that county rows (e.g. "Los Angeles County", with state_code 6, place_or_county_code 37_county)
    refers to the unincorporated county area population.
    """
    print("Loading 1980 populations...")
    df_1980 = get_place_populations_1980(data_path)
    print("Loading 1990s populations...")
    df_1990s = get_place_populations_1990s(data_path)
    print("Loading 2000s populations...")
    df_2000s = get_place_populations_2000s(data_path)
    print("Loading 2010s populations...")
    df_2010s = get_place_populations_2010s(data_path)

    # Remove the dupes by only taking [1990, 2000) from the 90s dataset,
    # [2000, 2010) from the 2000s dataset, etc. since these decade ones have both the start and end year.
    #
    # TODO: do something smarter to smooth out the discontinuities/slope changes at 2000 and 2010.
    # Maybe some kind of scaling thing, where we set
    #   pop_year = old_series_estimates_year * new_series_2000 / old_series_2000
    # (i.e. scale the 1990s populations as a fraction of the 2000 estimate, to line up with the
    # new series's 2000 value.)
    # This would help with the jumps we see from 1999 to 2000, and from 2009 to 2010 (you can see this in Google too)
    df_1990s = df_1990s[df_1990s["year"] != "2000"]
    df_2000s = df_2000s[df_2000s["year"] != "2010"]

    print("Interpolating 1980s populations...")
    interp_df = interpolate_1980s_populations(df_1980, df_1990s)

    df_2020s = impute_2020s_population(df_2010s)

    combined_df = pd.concat([interp_df, df_1990s, df_2000s, df_2010s, df_2020s])

    return combined_df
