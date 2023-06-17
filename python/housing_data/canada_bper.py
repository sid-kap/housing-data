from pathlib import Path

import pandas as pd
from housing_data.build_data_utils import (
    CANADA_BPER_DIR,
    CANADA_CROSSWALK_DIR,
    OPTIONAL_PREFIXES,
    OPTIONAL_SUFFIXES,
    PREFIXES,
    SUFFIXES,
    add_per_capita_columns,
)
from housing_data.canada_crosswalk import load_crosswalk
from housing_data.canada_population import load_populations

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


SPECIAL_CHARACTERS = {
    "É": "E",
    "Î": "I",
    "à": "a",
    "á": "a",
    "â": "a",
    "ç": "c",
    "è": "e",
    "é": "e",
    "ê": "e",
    "ô": "o",
}


def _add_alt_names(df: pd.DataFrame) -> None:
    alt_names = df["name"]
    for char, ascii_char in SPECIAL_CHARACTERS.items():
        alt_names = alt_names.str.replace(char, ascii_char)

    # Only include alt name if some chars were swapped
    alt_names = alt_names.mask(alt_names == df["name"], None)

    df["alt_name"] = alt_names


def load_canada_bper(data_repo_path: Path) -> pd.DataFrame:
    df = load_raw_bper(data_repo_path)
    fix_montreal(df)

    df = pivot_and_add_geos(df, data_repo_path)
    df = df.merge(load_populations(data_repo_path), how="left", on=["year", "SGC"])
    df = df.drop(columns=["SGC"])

    places_df = load_places(df)
    counties_df = aggregate_to_counties(df)
    metros_df = aggregate_to_metros(df)
    states_df = aggregate_to_states(df)

    places_df.to_parquet("../public/canada_places_annual.parquet")
    counties_df.to_parquet("../public/canada_counties_annual.parquet")
    metros_df.to_parquet("../public/canada_metros_annual.parquet")
    states_df.to_parquet("../public/canada_states_annual.parquet")

    return places_df, counties_df, metros_df, states_df


def _add_per_capita_columns(df: pd.DataFrame) -> None:
    for prefix in PREFIXES:
        for suffix in set(SUFFIXES + OPTIONAL_SUFFIXES) - {"units"}:
            # We don't have bldgs or value for Canada
            df[prefix + suffix] = 0
            df[prefix + suffix] = 0

    for prefix in OPTIONAL_PREFIXES:
        for suffix in OPTIONAL_SUFFIXES:
            # We don't have any California-specific columns
            df[prefix + suffix] = 0
            df[prefix + suffix] = 0

    add_per_capita_columns(df)


def load_raw_bper(data_repo_path: Path) -> pd.DataFrame:
    file_path = data_repo_path / CANADA_BPER_DIR / "Case1091138_revised.xlsx"

    old_df = pd.read_excel(file_path, sheet_name=0, skiprows=2)
    old_df = old_df.rename(
        columns={"SGC": "Municipality Name", "Municipality Name": "SGC"}
    )
    old_df["SGC"] = old_df["SGC"].astype(str).apply(_fix_old_sgc)

    recent_df = pd.read_excel(file_path, sheet_name=1, skiprows=2)
    recent_df["SGC"] = recent_df["SGC"].astype(str)

    df = pd.concat([old_df, recent_df])
    df.to_parquet("../public/canada_bper_raw.parquet")

    return df


def fix_montreal(df: pd.DataFrame) -> None:
    # Map arrondissements/boroughs of Montreal to the city SGC code
    df.loc[
        df["SGC"].str.startswith("2466A") | df["SGC"].str.startswith("2466a"), "SGC"
    ] = "2466023"


def pivot_and_add_geos(df: pd.DataFrame, data_repo_path: Path) -> pd.DataFrame:
    df = df.merge(
        load_crosswalk(data_repo_path / CANADA_CROSSWALK_DIR), how="left", on="SGC"
    )

    df["units"] = df["UnitsCategory"].map(UNITS_CATEGORIES)
    df = df.drop(columns=["UnitsCategory"])

    # Ignore building type and work type for now
    # TODO: maybe break out rowhouses or condos
    # TODO: maybe add value in CAD
    df = df.drop(columns=["BuildingType", "WorkType", "value ($)"])

    # 92 duplicate rows
    df = df.drop_duplicates()

    ids = [
        "SGC",
        "place_name",
        "province",
        "province_abbr",
        "year",
        "census_division",
        "metro",
        "metro_province_abbr",
    ]

    df = (
        pd.pivot_table(
            df, index=ids, columns="units", values="UnitsCreated", aggfunc="sum"
        )
        .fillna(0)
        .reset_index()
    )
    df["total_units"] = sum(df[col] for col in set(UNITS_CATEGORIES.values()))

    return df


def load_places(df: pd.DataFrame) -> pd.DataFrame:
    df["path_1"] = df["province_abbr"]
    df["path_2"] = (
        df["place_name"]
        .str.replace("/", "–")
        .str.replace(" ", "_")
        .str.replace("(", "", regex=False)
        .str.replace(")", "", regex=False)
    )
    df["name"] = df["place_name"] + ", " + df["province_abbr"]
    df = df.drop(columns=["place_name"])

    df["year"] = df["year"].astype(str)
    df = df.drop(columns=["province"])

    _add_per_capita_columns(df)
    _add_alt_names(df)
    return df


def aggregate_to_counties(df: pd.DataFrame) -> pd.DataFrame:
    df = df.groupby(["census_division", "year", "province_abbr"], as_index=False).sum()
    _add_per_capita_columns(df)

    df["path_1"] = df["province_abbr"]
    df["path_2"] = df["census_division"].str.replace(r"[ /\-\.]+", "_", regex=True)
    df["name"] = df["census_division"] + ", " + df["province_abbr"]
    df["year"] = df["year"].astype(str)

    _add_alt_names(df)
    return df


def aggregate_to_metros(df: pd.DataFrame) -> pd.DataFrame:
    df = (
        df.drop(columns=["place_name", "province_abbr", "province"])
        .groupby(["metro", "year", "metro_province_abbr"], as_index=False)
        .sum()
    )
    _add_per_capita_columns(df)

    metro = df["metro"].str.replace(" - ", "–")
    df["path_1"] = None
    df["path_2"] = (
        metro.str.replace("–", "_").str.replace("/", "_").str.replace(" ", "_")
        + "_"
        + df["metro_province_abbr"]
    )
    df["name"] = metro + " CMA, " + df["metro_province_abbr"]
    df["year"] = df["year"].astype(str)
    df = df.drop(columns=["metro_province_abbr"])

    df["metro_type"] = "cma"
    df["county_names"] = pd.Series([[]] * len(df), index=df.index)

    _add_alt_names(df)
    return df


def aggregate_to_states(df: pd.DataFrame) -> pd.DataFrame:
    df = (
        df.drop(columns=["path_1", "path_2"])
        .groupby(["province", "year"], as_index=False)
        .sum()
    )
    _add_per_capita_columns(df)

    df["path_1"] = None
    df["path_2"] = df["province"].str.replace(" ", "_")
    df["name"] = df["province"]
    df["year"] = df["year"].astype(str)

    _add_alt_names(df)
    return df
