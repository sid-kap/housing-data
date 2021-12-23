import shutil
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import us
from housing_data import building_permits_survey as bps
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

# Paths relative to the housing-data-data repo
BPS_DIR = str(Path("data", "bps"))
STATE_POPULATION_DIR = str(Path("data", "population", "state"))
COUNTY_POPULATION_DIR = str(Path("data", "population", "county"))
PLACE_POPULATION_DIR = str(Path("data", "population", "place"))

# Last year and month for which monthly BPS data is available (and is cloned to housing-data-data).
LATEST_MONTH = (2021, 11)


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


def load_bps_all_years_plus_monthly(
    data_repo_path: Optional[str],
    scale: bps.Scale,
    region: Optional[bps.Region] = None,
    start_year: int = 1980,
) -> pd.DataFrame:
    """
    Loads the annual data from 1980 to 2020, plus the year-to-date data for the current
    year (2021).

    Adds columns "year" and "month" to identify when the data came from.
    ("month" will only be present for the final (incomplete) year.)
    """
    data_path = Path(data_repo_path, BPS_DIR) if data_repo_path else None

    dfs = []
    for year in range(start_year, 2021):
        data = bps.load_data(
            scale=scale,
            time_scale="annual",
            year=year,
            month=None,
            region=region,
            data_path=data_path,
        ).assign(year=str(year), month=None)
        dfs.append(data)

    current_year_data = bps.load_data(
        scale=scale,
        time_scale="monthly_year_to_date",
        year=LATEST_MONTH[0],
        month=LATEST_MONTH[1],
        region=region,
        data_path=data_path,
    ).assign(year=str(LATEST_MONTH[0]), month=LATEST_MONTH[1])
    dfs.append(current_year_data)

    return pd.concat(dfs)
