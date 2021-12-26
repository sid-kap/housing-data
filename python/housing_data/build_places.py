from pathlib import Path
from typing import List, Optional

import pandas as pd
from housing_data import place_population
from housing_data.build_data_utils import (
    NUMERICAL_COLUMNS,
    PLACE_POPULATION_DIR,
    PUBLIC_DIR,
    add_per_capita_columns,
    get_state_abbrs,
    load_bps_all_years_plus_monthly,
    write_to_json_directory,
)
from housing_data.building_permits_survey import Region


def make_bps_fips_mapping(
    places_df: pd.DataFrame, place_population_df: pd.DataFrame
) -> pd.DataFrame:
    """
    Returns a DataFrame with columns: 6_digit_id, state_code, place_or_county_code
    """
    # The most recent years have fips code in BPS, so we'll use those to join.
    # Some years will have the same BPS 6-digit ID, so we can join roughly 1992 to present using that.
    # From 1980-1991 BPS has different FIPS codes, so it becomes a little trickier.
    mapping = places_df[(places_df["year"] == "2019")][
        ["place_name", "fips place_code", "county_code", "state_code", "6_digit_id"]
    ].copy()

    # For it to be a mapping, each BPS ID should appear only once per state...
    assert (mapping.groupby(["6_digit_id", "state_code"]).size() == 1).all()

    fips_place_code_str = mapping["fips place_code"].astype(str).replace("<NA>", "")
    county_code_str = mapping["county_code"].astype(str).replace("<NA>", "")

    mapping["place_or_county_code"] = fips_place_code_str.where(
        ~mapping["fips place_code"].isin([0, 99990]), county_code_str + "_county"
    )

    # Fix NYC boroughs: we don't want to use the whole city population as the denominator in per-capite calculations
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


def make_place_name_fips_mapping(merged_rows):
    mapping = merged_rows[
        ["place_name", "state_code", "place_or_county_code"]
    ].drop_duplicates()

    # Remove dupes ( (place_name, state_code) tuples for which there are multiple fips codes)
    dupes = mapping.groupby(["place_name", "state_code"]).size().loc[lambda x: x > 1]
    mapping = (
        mapping.merge(
            dupes.rename("dupe_count").reset_index().drop(columns=["dupe_count"]),
            on=["place_name", "state_code"],
            how="left",
            indicator=True,
        )
        .loc[lambda df: df["_merge"] == "left_only"]
        .drop(columns=["_merge"])
    )

    # For this to be used as a mapping, it must also satisfy this property
    assert (mapping.groupby(["place_name", "state_code"]).size() == 1).all()

    return mapping


def add_place_population_data(
    places_df: pd.DataFrame, place_population_df: pd.DataFrame
) -> pd.DataFrame:
    bps_fips_mapping = make_bps_fips_mapping(places_df, place_population_df)

    places_df = places_df.drop(columns=["fips place_code", "county_code"])

    # BPS changed their 6-digit IDs starting in 1992. So for rows from before 1992, we add '_pre_1992'
    # to the ID to distinguish them.
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

    # Finally, let's merge in population!
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

    add_per_capita_columns(final_places_df)

    return final_places_df


def _make_nyc_rows(raw_places_df):
    nyc_df = raw_places_df[
        raw_places_df["place_name"].isin(
            ["Manhattan", "Bronx", "Brooklyn", "Queens", "Staten Island"]
        )
        & (raw_places_df["state_code"] == 36)
    ]
    # TODO might need to add "month" to the groupby?
    nyc_rows = nyc_df.groupby("year")[NUMERICAL_COLUMNS].sum().reset_index()

    nyc_rows["fips place_code"] = 51000
    nyc_rows["state_code"] = 36
    nyc_rows["place_name"] = "New York City"

    # Fabricate a new 6-digit-id
    nyc_rows["6_digit_id"] = -1000

    return nyc_rows


def add_alt_names(raw_places_df):
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


def load_places(
    data_repo_path: Optional[str], counties_population_df: pd.DataFrame = None
) -> pd.DataFrame:
    dfs = []
    regions: List[Region] = ["west", "midwest", "south", "northeast"]
    for region in regions:
        data = load_bps_all_years_plus_monthly(data_repo_path, "place", region=region)
        dfs.append(data)
    raw_places_df = pd.concat(dfs)

    nyc_rows = _make_nyc_rows(raw_places_df)
    raw_places_df = pd.concat([raw_places_df, nyc_rows])

    add_alt_names(raw_places_df)

    # raw_places_df.to_parquet(PUBLIC_DIR / "places_annual_without_population.parquet")

    place_populations_df = place_population.get_place_population_estimates(
        data_path=Path(data_repo_path, PLACE_POPULATION_DIR) if data_repo_path else None
    )

    if counties_population_df is not None:
        nyc_counties = [61, 47, 5, 81, 85]

        nyc_counties_df = counties_population_df[
            counties_population_df["county_code"].isin(nyc_counties)
            & (counties_population_df["state_code"] == 36)  # NY
        ].copy()
        nyc_counties_df["place_or_county_code"] = (
            nyc_counties_df["county_code"].astype(str) + "_county"
        )

        place_populations_df = pd.concat([place_populations_df, nyc_counties_df])

    places_df = add_place_population_data(raw_places_df, place_populations_df)

    # Add name for comparison plots
    is_unincorporated = places_df["place_name"].str.contains("County") | places_df[
        "place_name"
    ].str.contains("Parish")

    places_df["name"] = (
        is_unincorporated.map({True: "Unincorporated ", False: ""})
        + places_df["place_name"]
        + ", "
        + get_state_abbrs(places_df["state_code"])
    )

    places_df.to_parquet(PUBLIC_DIR / "places_annual.parquet")

    (
        places_df[["place_name", "state_code", "alt_name", "name"]]
        .drop_duplicates()
        .sort_values("place_name")
        .to_json(PUBLIC_DIR / "places_list.json", orient="records")
    )

    write_to_json_directory(
        places_df, Path(PUBLIC_DIR, "places_data"), ["place_name", "state_code"]
    )

    return raw_places_df
