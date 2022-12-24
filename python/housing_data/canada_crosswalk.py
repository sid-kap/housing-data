from pathlib import Path

import pandas as pd

# TODO download these file in housing-data-data/download_data.py
DATA_PATH = Path("..", "canada", "2021_92-150-X_eng")

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


def load_crosswalk() -> pd.DataFrame:
    """
    Returns a crosswalk DF that maps each place to the census division,
    province, and metro-area (if it's in one).

    Will have the columns:
    - name
    - type
    - UID (7-digit SGC: 2 for province, 2 for census division, 3 for place)
    - population (2021)
    - census_division
    - province
    - metro
    - metro_province
    """
    # equivalent of place/city
    csd_df = pd.read_csv(DATA_PATH / "CSD.csv", encoding="latin1")

    # roughly equivalent to county
    cd_df = pd.read_csv(DATA_PATH / "CD.csv", encoding="latin1")

    # equivalent of state
    province_df = pd.read_csv(DATA_PATH / "PR.csv", encoding="latin1")

    # equivalent of metro area
    cma_df = pd.read_csv(DATA_PATH / "CMA_CA.csv", encoding="latin1")

    df = (
        csd_df[
            ["CSDname", "CSDtype", "CSDuid", "CSDpop_2021", "PRuid", "CDcode", "CMAuid"]
        ]
        .merge(cd_df[["CDname", "CDcode", "PRuid"]], on=["CDcode", "PRuid"])
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
                "CSDname": "name",
                "CSDtype": "type",
                "CSDuid": "SGC",
                "CSDpop_2021": "population",
                "CDname": "census_division",
                "PRname": "province",
                "CMAname": "metro",
            }
        )
    )
    df["province"] = df["province"].map(PROVINCE_ABBREVIATIONS)
    df["metro_province"] = df["metro_province"].map(PROVINCE_ABBREVIATIONS)

    return df
