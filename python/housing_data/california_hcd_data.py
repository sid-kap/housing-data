"""
Loads California Housing and Community Development's dataset of housing
permits by place from 2018-2022.

This is probably more accurate than BPS. In particular, most cities don't
seem to be reporting ADUs to the Census, but they do to HCD.

Because of SB 35 triggers based on the amount of housing permitted, cities have
a greater incentive to report this data correctly.
"""
from functools import lru_cache
from pathlib import Path
from typing import Literal, Optional

import numpy as np
import pandas as pd
from housing_data.build_data_utils import DataSource, add_total_columns
from housing_data.fips_crosswalk import load_fips_crosswalk

BUILDING_PERMIT_COLUMNS = [
    "BP_VLOW_INCOME_DR",
    "BP_VLOW_INCOME_NDR",
    "BP_LOW_INCOME_DR",
    "BP_LOW_INCOME_NDR",
    "BP_MOD_INCOME_DR",
    "BP_MOD_INCOME_NDR",
    "BP_ABOVE_MOD_INCOME",
]


def load_california_hcd_data(
    data_path: Path,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    df = pd.read_csv(data_path / "data/apr/tablea2.csv.gz")

    # BPS doesn't include mobile homes, so we shouldn't include them here either
    df = df[df["UNIT_CAT"] != "MH"].copy()

    # Has some values that are not numbers (e.g. "2020-08-02")
    df["BP_ABOVE_MOD_INCOME"] = pd.to_numeric(
        df["BP_ABOVE_MOD_INCOME"], errors="coerce"
    )

    df["units"] = df[BUILDING_PERMIT_COLUMNS].sum(axis="columns", numeric_only=True)

    df = df[
        (df["units"] > 0)
        # Exclude rows with a certificate of occupancy, because it's very unlikely
        # they got their building permits and also completed the project in the same year.
        # And if they did, we'd probably see a separate row for when they got their
        # permit anyway.
        # NB: I only looked at LA data to validate this assumption. The data looks
        # _way_ more accurate when we drop these rows.
        & (df["CO_ISSUE_DT1"].isnull() | ((df["BP_ISSUE_DT1"] == df["CO_ISSUE_DT1"])))
    ].copy()

    df["building_type"] = np.select(
        [
            df["UNIT_CAT"] == "ADU",
            df["UNIT_CAT"].isin(["SFD", "SFA"]),
            (df["UNIT_CAT"] == "2 to 4") & df["units"].isin([1, 2]),
            # If there are 3, 4, or more units in the project, assume it's 3 or 4.
            # TBH my prior is that 2-plexes are way more common than 3- or 4-plexes.
            # But for simplicity let's just put them in 3-to-4.
            # From 2018 to 2022, there are only ~2400 units worth of 2/3/4 unit projects
            # with >4 units in the project. So misclassifying these is not a big deal.
            df["UNIT_CAT"] == "2 to 4",
            df["UNIT_CAT"] == "5+",
        ],
        [
            "adu",
            "1_unit",
            "2_units",
            "3_to_4_units",
            "5_plus_units",
        ],
        None,
    )
    assert df["building_type"].isnull().sum() == 0

    df = df.rename(columns={"YEAR": "year"}).astype({"year": str})

    places_df = _aggregate_to_geography(df, "place", data_path)
    counties_df = _aggregate_to_geography(df, "county", data_path)
    state_df = _aggregate_to_geography(df, "state", data_path)

    return places_df, counties_df, state_df


def _aggregate_to_geography(
    df: pd.DataFrame,
    level: Literal["place", "county", "state"],
    data_path: Optional[Path],
) -> pd.DataFrame:
    # Sum 1 for every row in the APRs dataset, since we have 1 row per project/building.
    # (Technically this might not be true if a project has multiple buildings, e.g. a townhouse
    # subdivision or something. But no one looks at the buildings charts anyways 🤷‍♂️)
    df["bldgs"] = 1

    if level == "place":
        index_cols = ["JURIS_NAME", "CNTY_NAME", "year"]
    elif level == "county":
        index_cols = ["CNTY_NAME", "year"]
    elif level == "state":
        index_cols = ["year"]

    wide_df = df.pivot_table(
        index=index_cols,
        columns="building_type",
        values=["units", "bldgs"],
        fill_value=0,
        aggfunc="sum",
    ).reset_index()

    wide_df.columns = [
        f"{level_1}_{level_0}_hcd" if level_1 else level_0
        for level_0, level_1 in wide_df.columns
    ]

    add_total_columns(wide_df, DataSource.CA_HCD)

    if level == "place":
        # Confirm that we can drop county because in California, a city can't span multiple counties
        assert (wide_df[["JURIS_NAME", "year"]].value_counts() == 1).all()
        wide_df = wide_df.drop(columns=["CNTY_NAME"])
    if level == "place":
        old_wide_df = wide_df
        # Add place_or_county_code
        wide_df = wide_df.merge(
            _load_fips_crosswalk(data_path), left_on="JURIS_NAME", right_on="name"
        ).drop(columns=["name", "county_code"])
        if len(old_wide_df) != len(wide_df):
            dropped_cities = set(old_wide_df["JURIS_NAME"]) - set(wide_df["JURIS_NAME"])
            added_cities = set(wide_df["JURIS_NAME"]) - set(old_wide_df["JURIS_NAME"])
            raise ValueError(
                f"wide_df had {len(old_wide_df)} rows before merge and {len(wide_df)} rows after merge. "
                f"{dropped_cities=} {added_cities=}"
            )
    elif level == "county":
        # Add county_code
        old_rows = len(wide_df)
        wide_df["name"] = wide_df["CNTY_NAME"].str.upper() + " COUNTY"
        wide_df = wide_df.merge(_load_fips_crosswalk(data_path), on="name").drop(
            columns=["CNTY_NAME", "name", "place_or_county_code"]
        )
        new_rows = len(wide_df)
        assert old_rows == new_rows, f"{old_rows=} != {new_rows=}"
    elif level == "state":
        wide_df["state_code"] = 6  # California

    return wide_df


@lru_cache
def _load_fips_crosswalk(data_path: Path) -> pd.DataFrame:
    crosswalk_df = load_fips_crosswalk(data_path)
    crosswalk_df = crosswalk_df[
        (crosswalk_df["State Code (FIPS)"] == 6)  # California rows
        & (
            (crosswalk_df["Place Code (FIPS)"] != 0)
            | (crosswalk_df["County Code (FIPS)"] != 0)
        )
    ].rename(columns={"State Code (FIPS)": "state_code"})

    crosswalk_df["name"] = (
        crosswalk_df["Area Name (including legal/statistical area description)"]
        .str.removesuffix(" city")
        .str.removesuffix(" town")
        .replace(
            {
                "San Buenaventura (Ventura)": "VENTURA",
                "El Paso de Robles (Paso Robles)": "PASO ROBLES",
                "St. Helena": "SAINT HELENA",
                "Cathedral City": "CATHEDRAL",
                "Carmel-by-the-Sea": "CARMEL",
                "La Cañada Flintridge": "LA CANADA FLINTRIDGE",
                "Angels": "ANGELS CAMP",
                # The crosswalk has a city called "Amador City city".
                # I think the BPS data cleaning code messes this city up and shortens it to just "Amador".
                # This is wrong/we should probably fix it like we fixed Jersey City, but for now
                # let's just change it "AMADOR" to fix the "rows dropped in merge" error
                "Amador City": "AMADOR",
            }
        )
        .str.upper()
    )

    crosswalk_df["place_or_county_code"] = np.where(
        crosswalk_df["County Code (FIPS)"] != 0,
        crosswalk_df["County Code (FIPS)"].astype(str) + "_county",
        crosswalk_df["Place Code (FIPS)"].astype(str),
    )
    crosswalk_df["county_code"] = crosswalk_df["County Code (FIPS)"]
    return crosswalk_df[["name", "place_or_county_code", "county_code", "state_code"]]
