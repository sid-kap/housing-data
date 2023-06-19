from __future__ import annotations

from io import StringIO
from pathlib import Path
from typing import Any, Literal, Optional
from urllib.parse import quote

import pandas as pd
from housing_data.data_loading_helpers import get_url_text

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

VALUE_TYPES = ["bldgs", "units", "value"]
BUILDING_UNIT_SIZES = ["1_unit", "2_units", "3_to_4_units", "5_plus_units"]


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


def slugify(s: str) -> str:
    # Technically slugify adds hyphens... maybe this should be called "unslugify"
    return s.lower().replace("-", "_").strip()


def _merge_column_names(header_row_0: list[str], header_row_1: list[str]) -> pd.Series:
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
    header_row_0: list[str], header_row_1: list[str], fix_row_lengths: bool = True
) -> pd.Series:
    if fix_row_lengths:
        assert len(header_row_1) == len(header_row_0) + 1
        header_row_0.append("")

    return _merge_column_names(header_row_0, header_row_1)


def _fix_column_names_old_county_level(
    header_row_0: list[str], header_row_1: list[str]
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


def get_data_path(
    scale: Scale,
    time_scale: TimeScale,
    year: int,
    month: Optional[int] = None,
    region: Optional[Region] = None,
) -> str:
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

    return path


def read_bps_formatted_csv(
    csv_contents: str, scale: Scale, year: int, region: Optional[Region] = None
) -> pd.DataFrame:
    """
    Given the contents of a CSV file from the BPS dataset, parses it as a DataFrame.
    Takes into account several quirks in the way they format their files.
    """
    result = (
        csv_contents
        # OMG so dumb that they didn't wrap with quotations
        .replace("Bristol, VA", '"Bristol, VA"').replace("Bristol, TN", '"Bristol, TN"')
    )

    csv_handle = StringIO(result)

    header_row_1 = csv_handle.readline().rstrip().split(",")
    header_row_2 = csv_handle.readline().rstrip().split(",")

    # Skip blank line after header
    line = csv_handle.readline()
    assert line.strip() == ""

    df = pd.read_csv(csv_handle, header=None, index_col=False)

    if scale == "county" and year >= 1990 and year <= 1998:
        df.columns = _fix_column_names_old_county_level(header_row_1, header_row_2)
    else:
        fix_row_lengths = not (year == 1984 and region == "west")
        df.columns = _fix_column_names(
            header_row_1, header_row_2, fix_row_lengths=fix_row_lengths
        )

    return df


def load_data(
    scale: Scale,
    time_scale: TimeScale,
    year: int,
    month: Optional[int] = None,
    region: Optional[Region] = None,
    data_path: Optional[Path] = None,
    drop_useless_fields: bool = True,
) -> pd.DataFrame:
    """
    :param region: Only required if scale is 'place'
    :param month: Only required if time_scale is 'monthly_current' or 'monthly_year_to_date'
    """
    path = get_data_path(scale, time_scale, year, month, region)
    if data_path is None:
        path = quote(path)

    text = get_url_text((CENSUS_DATA_PATH, path), data_path)

    if ERROR_STRING in text:
        raise ValueError(f"Path {path} is not valid")

    df = read_bps_formatted_csv(text, scale, year, region)

    if scale == "state":
        state_cleanup(df)

    if scale == "place":
        df = place_cleanup(df, year)

    if scale == "county":
        df = county_cleanup(df)

    if drop_useless_fields:
        cols_to_drop = set(df.columns) & {
            "survey_date",
            "msa/cmsa",
            "pmsa_code",
            "region_code",
            "division_code",
            "central_city",
            "zip_code",
            "csa_csa",
            "cbsa_code",
            "csa_code",
            "footnote_code",
            "fips mcd_code",
            "census place_code",
            # We don't use these
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
            # different spellings in the county data for some reason
            "5+units rep_bldgs",
            "5+units rep_units",
            "5+units rep_value",
            "34_unit rep_bldgs",
            "34_unit rep_value",
            "34_unit rep_units",
            "5_unit rep_bldgs",
            "5_unit rep_units",
        }
        df = df.drop(columns=list(cols_to_drop))

    return df


def fix_state(s: Any) -> Any:
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


def add_totals_columns(df: pd.DataFrame) -> None:
    for value_type in VALUE_TYPES:
        df[f"total_{value_type}"] = sum(
            [df[f"{size}_{value_type}"] for size in BUILDING_UNIT_SIZES]
        )


def state_cleanup(df: pd.DataFrame) -> None:
    df["state_name"] = df["state_name"].str.title()
    df["state_name"] = df["state_name"].apply(fix_state)
    df["type"] = df["state_name"].map(TYPE_MAPPING).fillna("state")
    add_totals_columns(df)
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
    "ALLEN TOWN": "Allen town",
}


PLACES_TO_REMOVE = ["Houston (Dummy)", "Houston Part 2"]


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


def place_cleanup(df: pd.DataFrame, year: int) -> pd.DataFrame:
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
            if col == "zip_code" and df[col].dtype == object:
                # Sometimes there are spaces between the first 5 and next 3-4 digits (e.g. "83650 012")
                df[col] = df[col].str.replace(" ", "")

            df[col] = parse_number_column(df[col])

    # Can take the values '0', '1', and 'C', though some sub-files might only see 0 and 1, which leads to parsing
    # it as an int.
    # TODO: move this dtype-specifying logic to the pd.read_csv call, to make it more consistent.
    if "central_city" in df.columns:
        df["central_city"] = df["central_city"].astype(str)

    df["uncleaned_place_name"] = df["place_name"]
    df["place_name"], df["place_type"] = split_place_type(df["place_name"], year)

    df = df[
        df["place_name"].notnull() & ~df["place_name"].isin(PLACES_TO_REMOVE)
    ].copy()

    add_totals_columns(df)

    # Miami-Dade County was called Dade County until 1997.
    # We need to fix the old rows to use the new name and new FIPS code (change 25 to 86).
    #
    # Also, for some reason, 1999 to 2001 data has the old county name, but the new FIPS code.
    # (So we need to check for both 25 and 86.)
    dade_county_rows = (
        df["county_code"].isin([25, 86])
        & (df["state_code"] == 12)
        & (df["place_name"] == "Dade County")
    )
    df.loc[dade_county_rows, "place_name"] = "Miami-Dade County"
    df.loc[dade_county_rows, "county_code"] = 86

    return df


def split_place_type(place_names: pd.Series, year: int) -> tuple[pd.Series, pd.Series]:
    if year <= 1988:
        # Mostly only an issue from 1980 to 1987, but there are like 11 places that
        # still have the weird trailing dots in 1988 too.
        place_names = place_names.str.title().str.rstrip(".# ")

    place_names = place_names.replace(CORRECTIONS)

    for s, replacement_s in SUBSTRING_CORRECTIONS.items():
        place_names = place_names.str.replace(s, replacement_s, regex=False)

    place_names = place_names.str.strip()

    place_types = [" " + s for s in ["township", "town", "city", "village", "borough"]]
    title_place_types = [s.title() for s in place_types]

    new_place_names = []
    extracted_place_types: list[Optional[str]] = []
    for name in place_names:
        for place_type, title_place_type in zip(place_types, title_place_types):
            if isinstance(name, str):
                if name.endswith(place_type) or name.endswith(title_place_type):
                    new_place_names.append(name[: -len(place_type)])
                    extracted_place_types.append(place_type[1:])
                    break
        else:
            new_place_names.append(name)
            extracted_place_types.append(None)

    return pd.Series(new_place_names, index=place_names.index), pd.Series(
        extracted_place_types, index=place_names.index
    )


def county_cleanup(df: pd.DataFrame) -> pd.DataFrame:
    df["county_name"] = df["county_name"].str.strip()

    # Miami-Dade County was called Dade County until 1997.
    # We need to fix the old rows to use the new name and FIPS code.
    dade_county_rows = (df["fips_county"] == 25) & (df["fips_state"] == 12)
    df.loc[dade_county_rows, "county_name"] = "Miami-Dade County"
    df.loc[dade_county_rows, "fips_county"] = 86

    add_totals_columns(df)

    return df
