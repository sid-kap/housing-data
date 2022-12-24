import shutil
from pathlib import Path
from typing import List, Optional

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
    "total_bldgs",
    "total_units",
    "total_value",
    "projected_bldgs",
    "projected_units",
    "projected_value",
]

NUMERICAL_NON_REPORTED_COLUMNS = [
    col for col in NUMERICAL_COLUMNS if "reported" not in col
]

PUBLIC_DIR = Path("../public")

# Paths relative to the housing-data-data repo
BPS_DIR = Path("data", "bps")
STATE_POPULATION_DIR = Path("data", "population", "state")
COUNTY_POPULATION_DIR = Path("data", "population", "county")
PLACE_POPULATION_DIR = Path("data", "population", "place")

CANADA_BPER_DIR = Path("manual_data", "canada-bper")
CANADA_CROSSWALK_DIR = Path("data", "canada-crosswalk")

# Last year and month for which monthly BPS data is available (and is cloned to housing-data-data).
LATEST_MONTH = (2022, 9)
LAST_YEAR_ANNUAL_DATA_RELEASED = True


def write_to_json_directory(df: pd.DataFrame, path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir()

    for (json_dir, json_name), group in tqdm(
        df.groupby(["path_1", "path_2"], dropna=False)
    ):
        sub_path = path / json_dir if not pd.isnull(json_dir) else path
        sub_path.mkdir(exist_ok=True)
        group.reset_index(drop=True).to_json(
            sub_path / f"{json_name}.json", orient="records"
        )


DEFAULT_COLUMNS = ["name", "path_1", "path_2"]


def write_list_to_json(
    df: pd.DataFrame,
    output_path: Path,
    columns: List[str],
    add_latest_population_column: bool = False,
    unhashable_columns: Optional[List[str]] = None,
) -> None:
    """
    :param unhashable_columns: Columns to not include in calls to drop_duplicates, merge, etc. because
        they would cause "[type] is not hashable" errors.
    """
    columns = DEFAULT_COLUMNS + columns
    hashable_columns = list(set(columns) - set(unhashable_columns or []))
    subset_df = df[columns].copy().drop_duplicates(subset=hashable_columns)

    # Refers to both the path of the json file (https://housingdata.app/places_data/{path}.json)
    # and the URL path (https://housingdata.app/places/{path})
    subset_df["path"] = (subset_df["path_1"] + "/").fillna("") + subset_df["path_2"]

    if add_latest_population_column:
        latest_populations = df[df["year"] == "2020"][
            hashable_columns + ["population"]
        ].drop_duplicates()
        subset_df = subset_df.merge(latest_populations, on=hashable_columns, how="left")
        subset_df["population"] = subset_df["population"].fillna(0).astype(int)
        subset_df = subset_df.sort_values("name", ascending=False)

    subset_df = subset_df.sort_values(hashable_columns)
    subset_df = subset_df.drop(columns=["path_1", "path_2"])
    subset_df.to_json(output_path, orient="records")


def add_per_capita_columns(df: pd.DataFrame) -> None:
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
    data_repo_path: Optional[Path],
    scale: bps.Scale,
    region: Optional[bps.Region] = None,
    start_year: int = 1980,
    extrapolate_rest_of_year: bool = True,
) -> pd.DataFrame:
    """
    Loads the annual data from 1980 to the latest full year available, plus the year-to-date data for the current
    year and possibly the previous year if the previous year's annual data isn't released yet.

    Adds columns "year" and "month" to identify when the data came from.
    ("month" will only be present for the final (incomplete) year.)
    """
    data_path = data_repo_path / BPS_DIR if data_repo_path else None

    dfs = []

    # E.g. in early 2022, this will be 2020.
    # In mid/late-2022 (after the annual 2021 data is released) this will be 2021.
    last_full_year = (
        LATEST_MONTH[0] - 1 if LAST_YEAR_ANNUAL_DATA_RELEASED else LATEST_MONTH[0] - 2
    )

    for year in range(start_year, last_full_year + 1):
        data = bps.load_data(
            scale=scale,
            time_scale="annual",
            year=year,
            month=None,
            region=region,
            data_path=data_path,
        ).assign(year=str(year), month=None)
        dfs.append(data)

    if not LAST_YEAR_ANNUAL_DATA_RELEASED:
        # Use the monthly year to date data for last year since the annual data isn't out yet.
        last_year_data = bps.load_data(
            scale=scale,
            time_scale="monthly_year_to_date",
            year=last_full_year + 1,
            month=12,
            region=region,
            data_path=data_path,
        ).assign(year=str(last_full_year + 1))
        dfs.append(last_year_data)

    current_year_data = bps.load_data(
        scale=scale,
        time_scale="monthly_year_to_date",
        year=LATEST_MONTH[0],
        month=LATEST_MONTH[1],
        region=region,
        data_path=data_path,
    ).assign(year=str(LATEST_MONTH[0]), month=LATEST_MONTH[1])

    if extrapolate_rest_of_year:
        current_year_data = add_current_year_projections(current_year_data)

    dfs.append(current_year_data)

    return pd.concat(dfs)


def add_current_year_projections(year_to_date_df: pd.DataFrame) -> pd.DataFrame:
    """
    Given a DataFrame with "monthly_year_to_date" data and a "month" column,
    adds columns for projected_{bldgs,units,value} for the remainder of the year
    (assuming a constant rate across all months).

    The projected units for the remainder of the year will be stacked on top of
    the already observed units in the bar chart, with a different shading pattern.
    """
    for value_type in ["bldgs", "units", "value"]:
        # number of remaining months in the year / number of observed months
        projected_units_ratio = (12 - year_to_date_df["month"]) / year_to_date_df[
            "month"
        ]
        year_to_date_df[f"projected_{value_type}"] = (
            projected_units_ratio * year_to_date_df[f"total_{value_type}"]
        ).astype(int)

    return year_to_date_df


def impute_2020s_population(df_2010s: pd.DataFrame) -> pd.DataFrame:
    """
    Impute 2021 and 2022 with the 2020 population; that's the best I think we can do
    until the intercensals start coming out...
    (I guess we could use the overall US population growth rate, but that's a little sketchy for
    slow-growing metros...)
    """
    return pd.concat(
        [
            df_2010s[df_2010s["year"] == "2020"].assign(year="2021"),
            df_2010s[df_2010s["year"] == "2020"].assign(year="2022"),
        ]
    )
