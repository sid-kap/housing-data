from pathlib import Path
from typing import Optional

import pandas as pd
from housing_data import place_population
from housing_data.build_data_utils import (
    PLACE_POPULATION_DIR,
    PUBLIC_DIR,
    DataSource,
    get_numerical_columns,
    get_state_abbrs,
    load_bps_all_years_plus_monthly,
)
from housing_data.building_permits_survey import REGIONS


def make_bps_fips_mapping(
    places_df: pd.DataFrame, place_population_df: pd.DataFrame
) -> pd.DataFrame:
    """
    Returns a DataFrame with columns:
    - 6_digit_id (str)
    - state_code (int)
    - place_or_county_code (str)
    """
    # The most recent years have fips code in BPS, so we'll use those to join.
    # Some years will have the same BPS 6-digit ID, so we can join roughly 1992 to present using that.
    # From 1980-1991 BPS has different FIPS codes, so it becomes a little trickier.
    mapping = places_df[places_df["year"] == "2019"][
        ["place_name", "fips place_code", "county_code", "state_code", "6_digit_id"]
    ].copy()

    assert (mapping.groupby(["6_digit_id", "state_code"]).size() == 1).all()

    fips_place_code_str = mapping["fips place_code"].astype(str).replace("<NA>", "")
    county_code_str = mapping["county_code"].astype(str).replace("<NA>", "")

    mapping["place_or_county_code"] = fips_place_code_str.where(
        ~mapping["fips place_code"].isin([0, 99990]), county_code_str + "_county"
    )

    # Fix NYC boroughs: we don't want to use the whole city population as the denominator in per-capita calculations
    # for the borough plots.
    # The boroughs all have place_or_county_code = 51000, state_code = 36, and place_name = the borough name.
    # The third condition below is needed because there is also a "New York City" total row which has the same state and
    # place code, but which we don't want to change.
    nyc_borough_rows = (
        (mapping["place_or_county_code"] == "51000")
        & (mapping["state_code"] == 36)
        & (mapping["place_name"] != "New York City")
    )

    mapping["place_or_county_code"] = mapping["place_or_county_code"].where(
        ~nyc_borough_rows,
        mapping["place_name"].map(
            {
                "Manhattan": "61_county",
                "Brooklyn": "47_county",
                "Bronx": "5_county",
                "Queens": "81_county",
                "Staten Island": "85_county",
            }
        ),
    )

    mapping = mapping[["6_digit_id", "state_code", "place_or_county_code"]]
    mapping["6_digit_id"] = mapping["6_digit_id"].astype(str)

    return mapping


def make_place_name_fips_mapping(merged_rows: pd.DataFrame) -> pd.DataFrame:
    """
    Returns a DataFrame with columns:
    - place_name (str)
    - state_code (int)
    - place_or_county_code (str)

    This is used to map recent (post-1992) rows to old (pre-1992) rows, since
    the 6-digit IDs changed and the old rows don't have FIPS codes either.

    This is not great, because it throws out towns with similar names
    (e.g. Albion town, NY and Albion village, NY).
    We should probably use the "town", "village", etc. designations for
    matching instead of throwing them away.
    """
    mapping = merged_rows[
        ["place_name", "state_code", "place_or_county_code"]
    ].drop_duplicates()

    # Remove dupes ( (place_name, state_code) tuples for which there are multiple fips codes)
    # TODO: some of these are probably cases of a village and a township with the same name,
    # or something like that. We can probably deal with this instead of throwing them all out
    dupes = mapping.duplicated(subset=["place_name", "state_code"], keep=False)
    mapping = mapping[~dupes].copy()

    # For this to be used as a mapping, it must also satisfy this property
    assert (mapping.groupby(["place_name", "state_code"]).size() == 1).all()

    return mapping


def add_place_population_data(
    places_df: pd.DataFrame, place_population_df: pd.DataFrame
) -> pd.DataFrame:
    """
    Tries to add a population column to as many rows in places_df as possible.

    The procedure is:
    - Get a mapping from BPS 6-digit code to FIPS code, via 2019 data
    - Use this to get FIPS codes for all post-1992 rows
    - For pre-1992 rows, match them to recent rows via place name and state code.
      This is lossy, because we throw out dupes (e.g. Albion town, NY and Albion village, NY).
      TODO: fix this
    """
    bps_fips_mapping = make_bps_fips_mapping(places_df, place_population_df)

    places_df = places_df.drop(columns=["fips place_code", "county_code"])

    # BPS changed their 6-digit IDs starting in 1992. For rows before 1992, we add "_pre_1992"
    # to distinguish them
    places_df["6_digit_id"] = (
        places_df["6_digit_id"]
        .astype(str)
        .where(
            places_df["year"] >= "1992",
            places_df["6_digit_id"].astype(str) + "_pre_1992",
        )
    )

    merged_df = places_df.merge(
        bps_fips_mapping, how="left", on=["6_digit_id", "state_code"], indicator=True
    )
    assert len(merged_df) == len(places_df)
    print(
        "First mapping handled {:.1%} of rows!".format(
            (merged_df["_merge"] == "both").mean()
        )
    )
    merged_rows = merged_df[merged_df["_merge"] == "both"].drop(columns=["_merge"])
    unmerged_rows = merged_df[merged_df["_merge"] == "left_only"].drop(
        columns=["_merge", "place_or_county_code"]
    )
    assert len(merged_rows) + len(unmerged_rows) == len(places_df)

    # For earlier rows, we'll have to figure out the IDs by matching place name and state code.
    # Let's use 2019 names assuming that those are similar.
    place_name_fips_mapping = make_place_name_fips_mapping(merged_rows)

    unmerged_rows_2 = unmerged_rows.merge(
        place_name_fips_mapping,
        how="left",
        on=["place_name", "state_code"],
        indicator=True,
    )

    print(
        "Second mapping handled {:.1%} of the remaining rows!".format(
            (unmerged_rows_2["_merge"] == "both").mean()
        )
    )
    unmerged_rows_2 = unmerged_rows_2.drop(columns=["_merge"])
    places_with_fips_df = pd.concat([merged_rows, unmerged_rows_2])

    # Now that every row has a FIPS code, let's merge in population!
    final_places_df = places_with_fips_df.merge(
        place_population_df.drop(columns=["place_name"]),
        left_on=["place_or_county_code", "state_code", "year"],
        right_on=["place_or_county_code", "state_code", "year"],
        how="left",
    )

    print(
        "Final fraction of rows with population: {:.1%}".format(
            final_places_df["population"].notnull().mean()
        )
    )

    return final_places_df


def _make_nyc_rows(raw_places_df: pd.DataFrame) -> pd.DataFrame:
    nyc_df = raw_places_df[
        raw_places_df["place_name"].isin(
            ["Manhattan", "Bronx", "Brooklyn", "Queens", "Staten Island"]
        )
        & (raw_places_df["state_code"] == 36)
    ]
    nyc_rows = (
        nyc_df.groupby("year")[
            get_numerical_columns(DataSource.BPS, totals=True, projected=True)
        ]
        .sum()
        .reset_index()
    )

    nyc_rows["fips place_code"] = 51000
    nyc_rows["state_code"] = 36
    nyc_rows["place_name"] = "New York City"

    # Fabricate a new 6-digit-id
    nyc_rows["6_digit_id"] = -1000

    return nyc_rows


def add_alt_names(raw_places_df: pd.DataFrame) -> None:
    """
    Add extra names to help with searching
    """
    raw_places_df["alt_name"] = None

    nyc_borough_rows = raw_places_df["place_name"].isin(
        ["Manhattan", "Bronx", "Brooklyn", "Queens", "Staten Island"]
    ) & (raw_places_df["state_code"] == 36)
    raw_places_df.loc[nyc_borough_rows, "alt_name"] = "New York City"

    nyc_rows = (raw_places_df["place_name"] == "New York City") & (
        raw_places_df["state_code"] == 36
    )
    raw_places_df.loc[
        nyc_rows, "alt_name"
    ] = "Manhattan Bronx Brooklyn Queens Staten Island"


def get_place_name_spellings(
    df: pd.DataFrame,
) -> dict[tuple[str, Optional[str], int], str]:
    """
    :param df: A DataFrame with columns place_name, place_type, and state_code.

    Returns a dict that specifies how we want to spell each place name.

    If the (place_name, state) tuple appears with only one place_type,
    we just use "{place_name}, {state_abbr}".
    Otherwise, we use "{place_name} {place_type}, {state_abbr}".
    Returns a mapping from (place name, place type)
    """
    mapping = {}
    for (place_name, state_code), group in df.groupby(["place_name", "state_code"]):
        place_types = group["place_type"].unique()
        if len(place_types) == 1:
            mapping[(place_name, place_types[0], state_code)] = place_name
        else:
            for place_type in place_types:
                mapping[(place_name, place_type, state_code)] = (
                    f"{place_name} {place_type}"
                    if place_type is not None
                    else place_name
                )

    return mapping


def fix_nyc_boroughs_population(
    place_populations_df: pd.DataFrame, counties_population_df: pd.DataFrame
) -> pd.DataFrame:
    if counties_population_df is not None:
        nyc_counties = [61, 47, 5, 81, 85]

        nyc_counties_df = counties_population_df[
            counties_population_df["county_code"].isin(nyc_counties)
            & (counties_population_df["state_code"] == 36)  # NY
        ].copy()
        nyc_counties_df["place_or_county_code"] = (
            nyc_counties_df["county_code"].astype(str) + "_county"
        )

        return pd.concat([place_populations_df, nyc_counties_df])
    else:
        return place_populations_df


def get_name_spelling(places_df: pd.DataFrame) -> pd.Series:
    name_spelling = get_place_name_spellings(places_df)
    name = pd.Series(
        places_df[["place_name", "place_type", "state_code"]].itertuples(
            index=False, name=None
        ),
        index=places_df.index,
    ).map(name_spelling)

    # Add name for comparison plots
    is_unincorporated = places_df["place_name"].str.contains("County") | places_df[
        "place_name"
    ].str.contains("Parish")
    name = is_unincorporated.map({True: "Unincorporated ", False: ""}) + name

    # Fix cities that have "City" in the name
    name[(name == "Jersey") & (places_df["state_code"] == 34)] = "Jersey City"
    name[(name == "Atlantic") & (places_df["state_code"] == 34)] = "Atlantic City"
    name[(name == "Culver") & (places_df["state_code"] == 6)] = "Culver City"

    return name


def load_places(
    data_repo_path: Path, counties_population_df: pd.DataFrame = None
) -> tuple[pd.DataFrame, pd.DataFrame]:
    raw_places_df = pd.concat(
        [
            load_bps_all_years_plus_monthly(data_repo_path, "place", region=region)
            for region in REGIONS
        ]
    )

    nyc_rows = _make_nyc_rows(raw_places_df)
    raw_places_df = pd.concat([raw_places_df, nyc_rows])

    add_alt_names(raw_places_df)

    raw_places_df.to_parquet(PUBLIC_DIR / "places_annual_without_population.parquet")

    place_populations_df = place_population.get_place_population_estimates(
        data_path=data_repo_path / PLACE_POPULATION_DIR
    )
    place_populations_df = fix_nyc_boroughs_population(
        place_populations_df, counties_population_df
    )

    places_df = add_place_population_data(raw_places_df, place_populations_df)

    name = get_name_spelling(places_df)
    state_abbrs = get_state_abbrs(places_df["state_code"])
    places_df["name"] = name + ", " + state_abbrs
    places_df["path_1"] = state_abbrs
    places_df["path_2"] = name.str.replace("/", "-").str.replace(" ", "_")
    places_df = places_df.drop(columns=["place_name", "place_type"])

    not_null_rows = places_df["path_1"].notnull() & places_df["path_2"].notnull()
    assert (
        not_null_rows.all()
    ), f"Found rows where path_1 or path_2 is null: {places_df[['path_1', 'path_2']]}"
    places_df = places_df[not_null_rows]

    return raw_places_df, places_df
