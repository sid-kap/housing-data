from __future__ import annotations

from io import StringIO
from pathlib import Path
from typing import TYPE_CHECKING
from urllib.parse import quote

import pandas as pd
import requests
from typing_extensions import Literal

if TYPE_CHECKING:
    from typing import List, Optional

Region = Literal["west", "midwest", "south", "northeast"]

"""
Monthly data is provided in three forms:
- current:
    For each month in the year up to the given month, gives the number of
    permits in that month.
- year_to_date:
    Gives the total number of permits in that year up to the given month.
- annual:
    Gives just the total for the end of the year
"""
TimeScale = Literal["monthly_current", "monthly_year_to_date", "annual"]

Scale = Literal["county", "metro", "place", "state"]

ERROR_STRING = "Sorry, the page you requested has either been moved or is no longer available on this server."

CENSUS_DATA_PATH = "https://www2.census.gov/econ/bps"


def _validate_load_data_inputs(
    scale: Scale,
    time_scale: TimeScale,
    year: int,
    month: Optional[int],
    region: Optional[Region],
) -> None:
    if scale not in ["county", "metro", "place", "state"]:
        raise ValueError("Unknown scale: {}".format(scale))
    if time_scale not in ["monthly_current", "monthly_year_to_date", "annual"]:
        raise ValueError("Unknown time_scale: {}".format(time_scale))
    if scale == "place":
        if region is None:
            raise ValueError("If scale is 'place', region must be provided.")
    if time_scale == "monthly_current" or time_scale == "monthly_year_to_date":
        if month is None:
            raise ValueError("If time_scale is month, month must be provided.")
    if time_scale == "annual" and month is not None:
        raise ValueError("If time_scale is 'annual', month must be None.")


COLUMN_NAMES_MAPPING = {
    "1-unit": ("1_unit", ""),
    "2-units": ("2_units", ""),
    "3-4 units": ("3_to_4_units", ""),
    "5+ units": ("5_plus_units", ""),
    "1-unit rep": ("1_unit", "reported"),
    "2-units rep": ("2_units", "reported"),
    "3-4 units rep": ("3_to_4_units", "reported"),
    "5+ units rep": ("5_plus_units", "reported"),
}


def slugify(str):
    # Technically slugify adds hyphens... maybe this should be called "unslugify"
    return str.lower().replace("-", "_").strip()


def _merge_column_names(header_row_0: List[str], header_row_1: List[str]) -> pd.Series:
    for i, col in enumerate(header_row_0.copy()):
        if "unit" in col:
            header_row_0[i - 1] = col
            header_row_0[i + 1] = col

    fixed_columns = []

    for val_0, val_1 in zip(header_row_0, header_row_1):
        if val_0.startswith("Unnamed:"):
            val_0 = ""
        if val_1.startswith("Unnamed:"):
            val_1 = ""

        val_0 = val_0.strip()
        val_1 = val_1.strip()

        if val_0 in COLUMN_NAMES_MAPPING:
            val_0, suffix = COLUMN_NAMES_MAPPING[val_0]
        else:
            suffix = ""

        # Don't add a space for 'MSA/CMSA'
        join_str = "" if val_0.endswith("/") else "_"

        col_pieces = [val_0, val_1, suffix]
        col_pieces = [slugify(p) for p in col_pieces if p.strip()]
        fixed_columns.append(join_str.join(col_pieces))

    columns = pd.Series(fixed_columns)
    columns = columns.str.strip()

    return columns


def _fix_column_names(
    header_row_0: List[str], header_row_1: List[str], fix_row_lengths: bool = True
) -> pd.Series:
    if fix_row_lengths:
        assert len(header_row_1) == len(header_row_0) + 1
        header_row_0.append("")

    return _merge_column_names(header_row_0, header_row_1)


def _fix_column_names_old_county_level(
    header_row_0: List[str], header_row_1: List[str]
) -> pd.Series:
    """
    For the very early county-level data between 1990 and 1998 (county doesn't exist before 1990),
    the number of columns in the first two rows is inconsistent and needs to be fixed.

    Also, the string representation of the unit count is a little different
    ("34unit" instead of "3_to_4_units", for example).
    """
    assert len(header_row_1) == len(header_row_0) - 1
    header_row_0.pop()

    columns = _merge_column_names(header_row_0, header_row_1)

    # TODO this doesn't handle the reported columns, will fix that later (because I don't care about them anyways)
    replace_strs = {
        "2_unit_": "2_units_",
        "34unit_": "3_to_4_units_",
        "5_unit_": "5_plus_units_",
    }
    for s1, s2 in replace_strs.items():
        columns = columns.str.replace(s1, s2, regex=False)

    return columns


def load_data(
    scale: Scale,
    time_scale: TimeScale,
    year: int,
    month: Optional[int] = None,
    region: Optional[Region] = None,
    data_path: Optional[str] = None,
) -> pd.DataFrame:
    """
    :param region: Only required if scale is 'place'
    :param month: Only required if time_scale is 'monthly_current' or 'monthly_year_to_date'
    """
    _validate_load_data_inputs(scale, time_scale, year, month, region)

    if month is not None:
        year_last_digits = year % 100
        time_scale_letter = {
            "monthly_current": "c",
            "monthly_year_to_date": "y",
            "annual": "a",
        }[time_scale]

        filename_part_2 = f"{year_last_digits:02d}{month:02d}{time_scale_letter}"
    else:
        filename_part_2 = f"{year:04d}a"

    if scale == "place":
        region_mapping = {
            "south": "so",
            "northeast": "ne",
            "west": "we",
            "midwest": "mw",
        }  # type: ignore
        filename_part_1 = region_mapping[region]  # type: ignore
        extra_path: Optional[str] = region.capitalize() + " Region"  # type: ignore
        if data_path is not None:
            # Hacky but w/e. When downloaded, the path should be (e.g.) 'West Region', not 'West%20Region'.
            extra_path = quote(extra_path)
    elif scale == "county":
        if region is not None:
            raise ValueError("region must be None in since scale = 'county'")
        filename_part_1 = "co"
        extra_path = None
    elif scale == "metro":
        if region is not None:
            raise ValueError("region must be None in since scale = 'metro'")
        # "ma" stands for "metro area"
        filename_part_1 = "ma"
        extra_path = None
    elif scale == "state":
        if region is not None:
            raise ValueError("region must be None in since scale = 'state'")
        filename_part_1 = "st"
        extra_path = None

    scale_path = scale.capitalize()

    if extra_path is not None:
        path = f"{scale_path}/{extra_path}/{filename_part_1}{filename_part_2}.txt"
    else:
        path = f"{scale_path}/{filename_part_1}{filename_part_2}.txt"

    if data_path is not None:
        full_path = f"{data_path}/{path}"
        print(f"Reading data from {full_path}")
        text = Path(full_path).read_text()
    else:
        full_path = f"{CENSUS_DATA_PATH}/{path}"
        print(f"Downloading data from {full_path}")
        text = requests.get(full_path, stream=True).text

    result = (
        text
        # OMG so dumb that they didn't wrap with quotations
        .replace("Bristol, VA", '"Bristol, VA"').replace("Bristol, TN", '"Bristol, TN"')
    )
    if ERROR_STRING in result:
        raise ValueError(f"Path {path} is not valid")

    csv_handle = StringIO(result)

    header_row_1 = csv_handle.readline().rstrip().split(",")
    header_row_2 = csv_handle.readline().rstrip().split(",")

    # Skip blank line after header
    line = csv_handle.readline()
    assert line.strip() == ""

    df = pd.read_csv(csv_handle, header=None, index_col=False)
    fix_row_lengths = not (year == 1984 and region == "west")

    if scale == "county" and year >= 1990 and year <= 1998:
        df.columns = _fix_column_names_old_county_level(header_row_1, header_row_2)
    else:
        df.columns = _fix_column_names(
            header_row_1, header_row_2, fix_row_lengths=fix_row_lengths
        )

    if scale == "state":
        state_cleanup(df)

    if scale == "place":
        df = place_cleanup(df, year)

    if scale == "county":
        df = county_cleanup(df)

    return df


def fix_state(s):
    if isinstance(s, str):
        return (
            s.replace("Division", "")
            .replace("Divisi", "")
            .replace("Region", "")
            .strip()
        )
    else:
        return s


TYPE_MAPPING = {
    "United States": "country",
    "Northeast": "region",
    "Midwest": "region",
    "South": "region",
    "West": "region",
    "South Atlantic": "division",
    "West South Central": "division",
    "East North Central": "division",
    "East South Central": "division",
    "West North Central": "division",
    "Middle Atlantic": "division",
    "New England": "division",
    "Pacific": "division",
    "Mountain": "division",
}


def state_cleanup(df):
    df["state_name"] = df["state_name"].str.title()
    df["state_name"] = df["state_name"].apply(fix_state)
    df["type"] = df["state_name"].map(TYPE_MAPPING).fillna("state")
    df["total_units"] = (
        df["1_unit_units"]
        + df["2_units_units"]
        + df["3_to_4_units_units"]
        + df["5_plus_units_units"]
    )
    df["region_code"] = df["region_code"].astype(str)
    df["division_code"] = df["division_code"].astype(str)


CORRECTIONS = {
    "0Tsego Co. Pt. Uninc. Area": "Otsego Co. Pt. Uninc. Area",
    "Otsego Co. Pt Uninc. Area": "Otsego Co. Pt. Uninc. Area",
    "Washington Dc": "Washington",
    "Washington D.C": "Washington",
    "Washington D.C.": "Washington",
    ".Pike County": "Pike County",
}


# TODO: make sure that we're not overwriting Gulf County, FL
SUBSTRING_CORRECTIONS = {
    " *": "",
    " #": "",
    " (N)#": "",
    " (N)": "",
    "@1": "",
    "@2": "",
    "@4": "",
    "@5": "",
    "Unincorporated Area": "",
    "Unincoporated Area": "",
    "Unincorporared Area": "",
    "Unincorported Area": "",
    "Unincorporate Area": "",
    "Balance Of County": "County",
    "Bal. Of Co": "County",
    "Bal. Of C0": "County",
    "0Tsego Co": "Otsego Co",
    "Co. Uninc. Area": "County",
    "Co. Uninc Area": "County",
    "Co. Pt Uninc. Area": "County Part",
    "Co. Pt. Uninc. Area": "County Part",
    "Co. Pt Uninc": "County Part",
    "'S": "s",  # for Prince George'S County, St Mary'S County, etc.
    "County Part": "County",
    "Parish Uninc. Area": "Parish",
    "Parish Pt. Uninc. Area": "Parish",
    "Parish Pt Uninc. Area": "Parish",
    "County Uninc Area": "County",
}


def parse_number_column(col: pd.Series) -> pd.Series:
    """
    Converts a column that includes numeric data (integers or blank spaces, as either an int or a string type)
    to Int64.
    """
    col = col.copy()

    if col.dtype == object:
        # in 'survey_date' in some files
        col = col.str.rstrip("\x1a")

        space_or_empty = col.str.isspace() | (col.str.len() == 0)
        col.loc[space_or_empty] = None

        # For some malformed zipcodes, like '49098____  '
        col = col.str.rstrip("_ ")

    # pd.Series(['1', None]).astype('Int64') fails with the error:
    #   TypeError: object cannot be converted to an IntegerDtype.
    # So I need to convert via float
    return col.astype(float).astype("Int64")


def place_cleanup(df, year):
    """
    Any cleanup that can be done on an individual file basis goes here.
    Stuff that can only be done after combining all the dfs together is done in build_data.load_places
    """
    if "" in df.columns:
        df = df.drop(columns=[""])

    NUMBER_COLS_TO_PARSE = [
        "6_digit_id",
        "census place_code",
        "county_code",
        "division_code",
        "fips mcd_code",
        "fips place_code",
        "footnote_code",
        "msa/cmsa",
        "number of_months rep",
        "place_code",
        "pmsa_code",
        "pop",
        "region_code",
        "state_code",
        "survey_date",
        "zip_code",
    ]
    for col in NUMBER_COLS_TO_PARSE:
        if col in df.columns:
            df[col] = parse_number_column(df[col])

    # Can take the values '0', '1', and 'C', though some sub-files might only see 0 and 1, which leads to parsing
    # it as an int.
    # TODO: move this dtype-specifying logic to the pd.read_csv call, to make it more consistent.
    if "central_city" in df.columns:
        df["central_city"] = df["central_city"].astype(str)

    df["uncleaned_place_name"] = df["place_name"]
    place_names = df["place_name"]

    if year < 1988:
        place_names = place_names.str.title().str.rstrip(".# ")

    place_names = place_names.replace(CORRECTIONS)

    for s, replacement_s in SUBSTRING_CORRECTIONS.items():
        place_names = place_names.str.replace(s, replacement_s, regex=False)

    place_names = place_names.str.rstrip()

    place_types = ["township", "town", "city", "village", "borough"]
    for place_type in place_types:
        place_names = place_names.str.replace(f" {place_type.title()}$", "")
        place_names = place_names.str.replace(f" {place_type}$", "")

    df["place_name"] = place_names

    df = df[df["place_name"].notnull()].copy()

    df["total_units"] = (
        df["1_unit_units"]
        + df["2_units_units"]
        + df["3_to_4_units_units"]
        + df["5_plus_units_units"]
    )

    return df


def county_cleanup(df):
    df["county_name"] = df["county_name"].str.strip()

    df["total_units"] = (
        df["1_unit_units"]
        + df["2_units_units"]
        + df["3_to_4_units_units"]
        + df["5_plus_units_units"]
    )

    df = df.rename(
        columns={
            "5+units rep_bldgs": "5_plus_units_bldgs_reported",
            "5+units rep_units": "5_plus_units_units_reported",
            "5+units rep_value": "5_plus_units_value_reported",
            "34_unit rep_bldgs": "3_to_4_units_bldgs_reported",
            "34_unit rep_value": "3_to_4_units_value_reported",
            "34_unit rep_units": "3_to_4_units_units_reported",
            "5_unit rep_bldgs": "5_plus_units_bldgs_reported",
            "5_unit rep_units": "5_plus_units_units_reported",
        }
    )

    return df
