from pathlib import Path

import pandas as pd

PROVINCE_ABBREVIATIONS = {
    10: "NL",
    11: "PE",
    12: "NS",
    13: "NB",
    24: "QC",
    35: "ON",
    46: "MB",
    47: "SK",
    48: "AB",
    59: "BC",
    60: "YT",
    61: "NT",
    62: "NU",
}

PROVINCE_NAMES = {
    10: "Newfoundland and Labrador",
    11: "Prince Edward Island",
    12: "Nova Scotia",
    13: "New Brunswick",
    24: "Quebec",
    35: "Ontario",
    46: "Manitoba",
    47: "Saskatchewan",
    48: "Alberta",
    59: "British Columbia",
    60: "Yukon",
    61: "Northwest Territories",
    62: "Nunavut",
}

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


def fix_sgc(sgc: str) -> str:
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
    old_df["SGC"] = old_df["SGC"].astype(str).apply(fix_sgc)

    recent_df = pd.read_excel(file_path, sheet_name=1, skiprows=2)
    recent_df["SGC"] = recent_df["SGC"].astype(str)

    df = pd.concat([old_df, recent_df])

    df["Province Name"] = df["SGC"].str[:2].astype(int).map(PROVINCE_NAMES)
    df["Province Abbreviation"] = (
        df["SGC"].str[:2].astype(int).map(PROVINCE_ABBREVIATIONS)
    )

    df["units"] = df["UnitsCategory"].map(UNITS_CATEGORIES)
    df = df.drop(columns=["UnitsCategory"])

    # Ignore building type and work type for now
    # Later we might want to break out rowhouses or condos
    df = df.drop(columns=["BuildingType", "WorkType"])
    df = df.drop(columns=["value ($)"])

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
            df.astype({"units": str}),
            index=ids,
            columns="units",
            values="UnitsCreated",
            aggfunc="sum",
        )
        .fillna(0)
        .reset_index()
    )
    df["total_units"] = sum(df[col] for col in UNITS_CATEGORIES.values())

    df = df.rename(columns={"Municipality Name": "place_name"})
    df["state_code"] = "CA-" + df["Province Abbreviation"]

    # Replace / with en dash
    df["name"] = df["place_name"].str.replace("/", "–") + ", " + df["Province Abbreviation"]

    df["path"] = df["name"]
    df["population"] = 0

    df["year"] = df["year"].astype(str)

    return df