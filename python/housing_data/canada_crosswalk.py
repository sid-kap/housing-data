from pathlib import Path
from typing import Dict, Tuple

import pandas as pd

PROVINCE_ABBREVIATIONS = {
    "Newfoundland and Labrador": "NL",
    "Prince Edward Island": "PE",
    "Nova Scotia": "NS",
    "New Brunswick": "NB",
    "Quebec": "QC",
    "Ontario": "ON",
    "Manitoba": "MB",
    "Saskatchewan": "SK",
    "Alberta": "AB",
    "British Columbia": "BC",
    "Yukon": "YT",
    "Northwest Territories": "NT",
    "Nunavut": "NU",
}

# From https://www12.statcan.gc.ca/census-recensement/2021/ref/symb-ab-acr-eng.cfm#cst
CSD_TYPES = {
    "C": "city",
    "CT": "canton",
    "CU": "canton",
    "CV": "city",
    "CY": "city",
    "DM": "district municipality",
    "IM": "island municipality",
    "IRI": "Indian reserve",
    "MD": "municipal district",
    "MU": "municipality",
    "MÉ": "municipality",
    "P": "parish",
    "PE": "parish",
    "RCR": "rural community",
    "RDA": "regional district",
    "RGM": "regional municipality",
    "RM": "rural municipality",
    "RV": "resort village",
    "SM": "specialized municipality",
    "SV": "summer village",
    "T": "town",
    "TP": "township",
    "TV": "town",
    "V": "village",
    "VL": "village",
    # Not sure what these are
    "CN": "city",
    "FD": "municipality",
}

# From https://www12.statcan.gc.ca/census-recensement/2021/ref/symb-ab-acr-eng.cfm#cdt
CD_TYPES = {
    "CDR": "Census Division",
    "CT": "County",
    "CTY": "County",
    "DIS": "District",
    "DM": "District Municipality",
    "MRC": "Regional County Municipality",
    "RD": "Regional District",
    "REG": "Region",
    "RM": "Region Municipality",
    "TÉ": "Territory Equivalent",
    "T": "Territory",
    "UC": "United Counties",
}


def get_place_name_spellings(
    df: pd.DataFrame,
) -> Dict[Tuple[str, str, str], str]:
    """
    :param df: A DataFrame with columns place_name, type, and province.

    Returns a dict that maps (place_name, type, province) to:
    - "{place_name}, {state_abbr}" if the (place_name, type) tuple appears
      with only one place_type
    - otherwise, "{place_name} ({place_type}), {state_abbr}".

    (This is different from the US places, where we don't put parens around place_type.)
    """
    mapping = {}
    for (place_name, province), group in df.groupby(["place_name", "province"]):
        place_types = group["place_type"].unique()
        if len(place_types) == 1:
            mapping[(place_name, place_types[0], province)] = place_name
        else:
            for place_type in place_types:
                mapping[(place_name, place_type, province)] = (
                    f"{place_name} ({CSD_TYPES[place_type]})"
                    if place_type is not None
                    else place_name
                )

    return mapping


def load_crosswalk(data_path: Path) -> pd.DataFrame:
    """
    Returns a crosswalk DF that maps each place to the census division,
    province, and metro-area (if it's in one).

    Will have the columns:
    - place_name
    - SGC (7-digit SGC: 2 for province, 2 for census division, 3 for place)
    - population (2021)
    - census_division
    - province
    - province_abbr
    - metro
    - metro_province_abbr
    """
    # equivalent of place/city
    csd_df = pd.read_csv(data_path / "CSD.csv", encoding="latin1")

    # roughly equivalent to county
    cd_df = pd.read_csv(data_path / "CD.csv", encoding="latin1")

    # equivalent of state
    province_df = pd.read_csv(data_path / "PR.csv", encoding="latin1")

    # equivalent of metro area
    cma_df = pd.read_csv(data_path / "CMA_CA.csv", encoding="latin1")

    df = (
        csd_df[
            ["CSDname", "CSDtype", "CSDuid", "CSDpop_2021", "PRuid", "CDcode", "CMAuid"]
        ]
        .merge(cd_df[["CDname", "CDtype", "CDcode", "PRuid"]], on=["CDcode", "PRuid"])
        .merge(
            province_df[["PRname", "PRcode"]].rename(columns={"PRcode": "PRuid"}),
            on="PRuid",
        )
        .merge(
            cma_df[["CMAcode", "CMAname", "PRuid"]].rename(
                columns={"CMAcode": "CMAuid", "PRuid": "metro_province_id"}
            ),
            on="CMAuid",
            how="left",
        )
        .merge(
            province_df[["PRname", "PRcode"]].rename(
                columns={"PRcode": "metro_province_id", "PRname": "metro_province"}
            ),
            on="metro_province_id",
        )
        .drop(columns=["PRuid", "CDcode", "CMAuid", "metro_province_id"])
        .rename(
            columns={
                "CSDname": "place_name",
                "CSDtype": "place_type",
                "CSDuid": "SGC",
                "CSDpop_2021": "population",
                "PRname": "province",
                "CMAname": "metro",
            }
        )
    )
    df["province_abbr"] = df["province"].map(PROVINCE_ABBREVIATIONS)
    df["metro_province_abbr"] = df["metro_province"].map(PROVINCE_ABBREVIATIONS)
    df["SGC"] = df["SGC"].astype(str).str.zfill(7)
    df["census_division"] = df["CDname"] + " " + df["CDtype"].map(CD_TYPES)
    df = df.drop(columns=["CDname", "CDtype"])

    spellings = get_place_name_spellings(df)
    df["place_name"] = (
        df[["place_name", "place_type", "province"]].apply(tuple, axis=1).map(spellings)
    )
    df = df.drop(columns=["place_type", "metro_province"])

    return df
