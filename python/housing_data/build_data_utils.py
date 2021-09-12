import shutil
from pathlib import Path

import numpy as np
import pandas as pd
import us
from tqdm import tqdm

UNITS_COLUMNS = [
    "1_unit_units",
    "2_units_units",
    "3_to_4_units_units",
    "5_plus_units_units",
]

NUMERICAL_COLUMNS = [
    "1_unit_bldgs",
    "1_unit_units",
    "1_unit_value",
    "2_units_bldgs",
    "2_units_units",
    "2_units_value",
    "3_to_4_units_bldgs",
    "3_to_4_units_units",
    "3_to_4_units_value",
    "5_plus_units_bldgs",
    "5_plus_units_units",
    "5_plus_units_value",
    "1_unit_bldgs_reported",
    "1_unit_units_reported",
    "1_unit_value_reported",
    "2_units_bldgs_reported",
    "2_units_units_reported",
    "2_units_value_reported",
    "3_to_4_units_bldgs_reported",
    "3_to_4_units_units_reported",
    "3_to_4_units_value_reported",
    "5_plus_units_bldgs_reported",
    "5_plus_units_units_reported",
    "5_plus_units_value_reported",
    "total_units",
]

NUMERICAL_NON_REPORTED_COLUMNS = [
    col for col in NUMERICAL_COLUMNS if "reported" not in col
]

PUBLIC_DIR = Path("../public")
GITHUB_DATA_REPO_DIR = Path("../housing-data-data")
BPS_DIR = str(Path(GITHUB_DATA_REPO_DIR, "data", "bps"))
STATE_POPULATION_DIR = str(Path(GITHUB_DATA_REPO_DIR, "data", "population", "state"))
COUNTY_POPULATION_DIR = str(Path(GITHUB_DATA_REPO_DIR, "data", "population", "county"))
PLACE_POPULATION_DIR = str(Path(GITHUB_DATA_REPO_DIR, "data", "population", "place"))


def write_to_json_directory(df, path, group_cols=None):
    assert len(group_cols) in [1, 2]

    path.mkdir(exist_ok=True)
    shutil.rmtree(path)

    for name, group in tqdm(df.groupby(group_cols)):
        # small_name is the place or county name, big_name is the state code
        if isinstance(name, tuple):
            small_name, big_name = name
            assert isinstance(small_name, str)
            assert isinstance(big_name, (str, int, np.int64))
            sub_path = Path(path, f"{big_name}")
        elif isinstance(name, str):
            small_name = name
            sub_path = Path(path)
        else:
            raise ValueError(
                f"Unknown type of grouping columns: {group_cols}. Found: {name}"
            )

        sub_path.mkdir(parents=True, exist_ok=True)
        group.reset_index(drop=True).to_json(
            Path(sub_path, f"{small_name}.json"), orient="records"
        )


def add_per_capita_columns(df):
    # There are three cities (Sitka, Weeki Wachee, and Carlton Landing) that had population 0 in some years
    population = df["population"].where(df["population"] != 0, pd.NA)

    for col in NUMERICAL_NON_REPORTED_COLUMNS:
        df[col + "_per_capita"] = df[col] / population


def get_state_abbrs(state_codes: pd.Series) -> pd.Series:
    """
    :param state_codes: state_codes: pd.Series of int
    :return: pd.Series of state abbrs as str
    """
    return state_codes.astype(str).str.zfill(2).map(us.states.mapping("fips", "abbr"))
