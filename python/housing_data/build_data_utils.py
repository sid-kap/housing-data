import shutil
from enum import Enum, auto
from pathlib import Path
from typing import Optional

import pandas as pd
import us
from housing_data import building_permits_survey as bps
from tqdm import tqdm

_COMMON_PREFIXES = ["1_unit", "2_units", "3_to_4_units", "5_plus_units"]


class DataSource(Enum):
    BPS = auto()
    CA_HCD = auto()
    CANADA = auto()


# There are also two "derived" prefixes: "total" and "projected"
PREFIXES = {
    DataSource.BPS: _COMMON_PREFIXES,
    # We have ADU data only in the CA HCD dataset
    DataSource.CA_HCD: _COMMON_PREFIXES + ["adu"],
    DataSource.CANADA: _COMMON_PREFIXES,
}


SUFFIXES = {
    DataSource.BPS: ["_bldgs", "_units", "_value"],
    # We don't have value data in the CA HCD dataset
    # (In the UI, for value we fallback to BPS data)
    DataSource.CA_HCD: ["_units_apr", "_bldgs_apr"],
    # We only have units, not bldgs or value for Canada
    DataSource.CANADA: ["_units"],
}


def get_numerical_columns(
    data_source: DataSource,
    totals: bool = False,
    projected: bool = False,
    per_capitas: bool = False,
) -> list[str]:
    """
    Args:
        post_processing: Whether to include the "{}_per_capita" and "total_{}" columns
    """
    cols = [
        prefix + suffix
        for prefix in PREFIXES[data_source]
        for suffix in SUFFIXES[data_source]
    ]

    if totals:
        cols += [f"total{suffix}" for suffix in SUFFIXES[data_source]]

    if projected and data_source == DataSource.BPS:
        # We only call add_current_year_projections (which adds the "projected_*" columns)
        # on BPS data, since BPS is the only data source released monthly.
        cols += [f"projected{suffix}" for suffix in SUFFIXES[data_source]]

    if per_capitas:
        # This must happen after totals
        cols += [col + "_per_capita" for col in cols]

    return cols


PUBLIC_DIR = Path("../public")

# Paths relative to the housing-data-data repo
BPS_DIR = Path("data", "bps")
STATE_POPULATION_DIR = Path("data", "population", "state")
COUNTY_POPULATION_DIR = Path("data", "population", "county")
PLACE_POPULATION_DIR = Path("data", "population", "place")

CANADA_BPER_DIR = Path("manual_data", "canada-bper")
CANADA_CROSSWALK_DIR = Path("data", "canada-crosswalk")
CANADA_POPULATION_DIR = Path("data", "canada-population")

# Last year and month for which monthly BPS data is available (and is cloned to housing-data-data).
LATEST_MONTH = (2023, 4)
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

        # Don't bloat non-California JSON files with columns that are all null
        ca_only_columns = {
            col
            for col, is_all_null in group[
                # doesn't matter if we pass projected=True here, since projected columns
                # aren't present in CA HCD data. But just passing for consistency.
                get_numerical_columns(
                    DataSource.CA_HCD, totals=True, projected=True, per_capitas=True
                )
            ]
            .isnull()
            .all()
            .items()
            if is_all_null
        }
        if ca_only_columns:
            group = group.drop(columns=ca_only_columns)

        group.reset_index(drop=True).to_json(
            sub_path / f"{json_name}.json", orient="records"
        )


# Columns to write to the "{geography}_list.json" file.
# We also add "population" and "has_ca_hcd_data", but those require more
# complicated aggregations because they have different values for different years.
LIST_COLUMNS = ["name", "path_1", "path_2", "alt_name"]


def write_list_json(
    df: pd.DataFrame,
    output_path: Path,
    unhashable_columns: Optional[list[str]] = None,
    extra_columns: Optional[list[str]] = None,
) -> None:
    """
    Writes the /public/{geography}_list.json file, which is a list of places
    at that level. This is used by the select search.

    :param unhashable_columns: Columns to not include in calls to drop_duplicates, merge, etc. because
        they would cause "[type] is not hashable" errors.
    """
    columns = LIST_COLUMNS + (extra_columns or [])
    keys = list(set(columns) - set(unhashable_columns or []))
    subset_df = df[columns].copy().drop_duplicates(subset=keys)

    # Refers to both the path of the json file (https://housingdata.app/places_data/{path}.json)
    # and the URL path (https://housingdata.app/places/{path})
    subset_df["path"] = (subset_df["path_1"] + "/").fillna("") + subset_df["path_2"]

    # Add population column
    latest_populations = (
        df[keys + ["year", "population"]]
        .sort_values("year")
        .drop_duplicates(subset=keys, keep="last")
    )
    latest_populations["population"] = (
        latest_populations["population"].fillna(0).astype(int)
    )
    subset_df = subset_df.merge(latest_populations, on=keys, how="left")

    # Add column indicating whether the place has CA HCD data
    has_ca_hcd_data = df.groupby("name")["has_ca_hcd_data"].any().reset_index()
    subset_df = subset_df.merge(has_ca_hcd_data, on="name", how="left")

    subset_df = subset_df.sort_values(keys)
    subset_df = subset_df.drop(columns=["path_1", "path_2"])
    subset_df.to_json(output_path, orient="records")


def add_per_capita_columns(df: pd.DataFrame, data_sources: list[DataSource]) -> None:
    # There are three cities (Sitka, Weeki Wachee, and Carlton Landing) that had population 0 in some years
    population = df["population"].where(df["population"] != 0, 1)

    cols = {
        col
        for data_source in data_sources
        for col in get_numerical_columns(data_source, totals=True, projected=True)
    }
    for col in cols:
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
        add_total_columns(data, DataSource.BPS)
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
        add_total_columns(last_year_data, DataSource.BPS)
        dfs.append(last_year_data)

    current_year_data = bps.load_data(
        scale=scale,
        time_scale="monthly_year_to_date",
        year=LATEST_MONTH[0],
        month=LATEST_MONTH[1],
        region=region,
        data_path=data_path,
    ).assign(year=str(LATEST_MONTH[0]), month=LATEST_MONTH[1])
    add_total_columns(current_year_data, DataSource.BPS)

    if extrapolate_rest_of_year:
        current_year_data = add_current_year_projections(current_year_data)

    dfs.append(current_year_data)

    return pd.concat(dfs)


def add_total_columns(df: pd.DataFrame, data_source: DataSource) -> None:
    for suffix in SUFFIXES[data_source]:
        cols = [
            col for col in get_numerical_columns(data_source) if col.endswith(suffix)
        ]
        df[f"total{suffix}"] = df[cols].sum(axis=1)


def add_current_year_projections(year_to_date_df: pd.DataFrame) -> pd.DataFrame:
    """
    Given a DataFrame with "monthly_year_to_date" data and a "month" column,
    adds columns for projected_{bldgs,units,value} for the remainder of the year
    (assuming a constant rate across all months).

    The projected units for the remainder of the year will be stacked on top of
    the already observed units in the bar chart, with a different shading pattern.
    """
    for suffix in SUFFIXES[DataSource.BPS]:
        # number of remaining months in the year / number of observed months
        projected_units_ratio = (12 - year_to_date_df["month"]) / year_to_date_df[
            "month"
        ]
        year_to_date_df[f"projected{suffix}"] = (
            projected_units_ratio * year_to_date_df[f"total{suffix}"]
        ).astype(int)

    return year_to_date_df


def impute_2023_population(df_2020s: pd.DataFrame) -> pd.DataFrame:
    """
    Impute 2023 with the 2022 population
    """
    return pd.concat(
        [
            df_2020s,
            df_2020s[df_2020s["year"] == "2022"].assign(year="2023"),
        ]
    )
