from pathlib import Path
from typing import Dict, Optional, Tuple

import pandas as pd
from housing_data.canada_crosswalk import load_crosswalk

PROVINCE_NAMES = {}

_UNITS_CATEGORIES = {
    1: "1_unit",
    2: "2_units",
    3: "3_to_4_units",
    4: "5_plus_units",
    5: "5_plus_units",
    6: "5_plus_units",
    7: "5_plus_units",
    8: "5_plus_units",
    # 4: "5_to_9_units",
    # 5: "10_to_19_units",
    # 6: "20_to_49_units",
    # 7: "50_to_99_units",
    # 8: "100_plus_units",
}

UNITS_CATEGORIES = {k: v + "_units" for k, v in _UNITS_CATEGORIES.items()}

BUILDING_TYPES = {
    110: "single_detached",
    115: "single_condo",
    130: "mobile_home",
    150: "seasonal",
    210: "semi_detached",
    215: "semi_detached_condo",
    310: "apartment",
    315: "apartment_condo",
    330: "rowhouse",
    335: "rowhouse_condo",
}


def _fix_old_sgc(sgc: str) -> str:
    """
    The older BPER data I got has incorrect SGC codes. They added an extra leading 0 in the CD.
    (The code is supposed to be XX YY ZZZ, where X is the province/territory,
    Y is the census division, and Z is the census subdivision. They did XX YYY ZZZ.)
    """
    # Drop the zero at index 2
    assert sgc[2] == "0", sgc
    return sgc[:2] + sgc[3:]


def standardize_municipality_names(
    df: pd.DataFrame, old_df: pd.DataFrame, recent_df: pd.DataFrame
) -> None:
    # The earlier years are properly title-cased, while the later years (2018-2021)
    # are all upper-case. Title-case is better
    old_df = old_df[["SGC", "Municipality Name", "year"]]
    recent_df = recent_df[["SGC", "Municipality Name", "year"]].copy()
    recent_df["Municipality Name"] = recent_df["Municipality Name"].str.title()

    name_mapping = (
        pd.concat([old_df, recent_df])
        .drop_duplicates()
        .sort_values("year")
        .groupby("SGC")
        .first()["Municipality Name"]
        .to_dict()
    )
    df["Municipality Name"] = df["SGC"].map(name_mapping)


def load_canada_bper(data_path: Path) -> pd.DataFrame:
    file_path = data_path / "Case1091138_revised.xlsx"

    old_df = pd.read_excel(file_path, sheet_name=0, skiprows=2)
    old_df = old_df.rename(
        columns={"SGC": "Municipality Name", "Municipality Name": "SGC"}
    )
    old_df["SGC"] = old_df["SGC"].astype(str).apply(_fix_old_sgc)

    recent_df = pd.read_excel(file_path, sheet_name=1, skiprows=2)
    recent_df["SGC"] = recent_df["SGC"].astype(str)

    df = pd.concat([old_df, recent_df])
    df.to_parquet("../public/canada_bper_raw.parquet")

    return load_places(df)


def load_places(
    df: pd.DataFrame, old_df: pd.DataFrame, recent_df: pd.DataFrame
) -> pd.DataFrame:
    # df["Province Name"] = df["SGC"].str[:2].astype(int).map(PROVINCE_NAMES)

    df = df.merge(load_crosswalk(), how="left", on="SGC")

    # df["Province Abbreviation"] = (
    #     df["SGC"].str[:2].astype(int).map(PROVINCE_ABBREVIATIONS)
    # )

    df["units"] = df["UnitsCategory"].map(UNITS_CATEGORIES)
    df = df.drop(columns=["UnitsCategory"])

    # Ignore building type and work type for now
    # TODO: maybe break out rowhouses or condos
    # TODO: maybe add value in CAD
    df = df.drop(columns=["BuildingType", "WorkType", "value ($)"])

    standardize_municipality_names(df, old_df, recent_df)

    # 92 duplicate rows
    df = df.drop_duplicates()

    ids = [
        "year",
        "Province",
        "Municipality Name",
        "SGC",
        "Province Name",
        "Province Abbreviation",
    ]

    df = (
        pd.pivot_table(
            df, index=ids, columns="units", values="UnitsCreated", aggfunc="sum"
        )
        .fillna(0)
        .reset_index()
    )
    df["total_units"] = sum(df[col] for col in UNITS_CATEGORIES.values())

    df["name"] = df["Municipality Name"] + ", " + df["Province Abbreviation"]
    df["path_1"] = df["Province Abbreviation"]
    df["path_2"] = df["Municipality Name"].str.replace("/", "–").str.replace(" ", "_")

    df["population"] = df["population"].fillna(1)

    df["year"] = df["year"].astype(str)
    df = df.drop(
        columns=["Province Name", "Province Abbreviation", "Municipality Name"]
    )

    return df


def get_place_name_spellings(
    df: pd.DataFrame,
) -> Dict[Tuple[str, Optional[str], int], str]:
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
