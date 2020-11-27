from __future__ import annotations

from io import StringIO
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


def _validate_load_data_inputs(
    scale: Scale,
    time_scale: TimeScale,
    year: int,
    month: Optional[int],
    region: Optional[Region],
) -> None:
    if scale not in ["country", "metro", "place", "state"]:
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


def _fix_column_names(header_row_0, header_row_1) -> List[str]:
    assert len(header_row_1) == len(header_row_0) + 1
    header_row_0.append("")

    for i, col in enumerate(header_row_0.copy()):
        if "unit" in col:
            header_row_0[i - 1] = col
            header_row_0[i + 1] = col

    # last_units_group = ""
    # suffix = ""

    # fixed_columns = []
    # for val_0, val_1 in columns:
    #     if val_0.startswith("Unnamed:"):
    #         val_0 = ""
    #     if val_1.startswith("Unnamed:"):
    #         val_1 = ""

    #     val_0 = val_0.strip()

    #     if val_0 in COLUMN_NAMES_MAPPING:
    #         last_units_group, suffix = COLUMN_NAMES_MAPPING[val_0]

    #     # Don't add a space for 'MSA/CMSA'
    #     join_str = "" if val_0.endswith("/") else "_"

    #     if val_1.strip() in ["Value", "Bldgs", "Units"]:
    #         col_pieces = [last_units_group, val_1, suffix]
    #     else:
    #         col_pieces = [val_0, val_1, suffix]

    #     col_pieces = [slugify(p) for p in col_pieces if p.strip()]

    #     fixed_columns.append(join_str.join(col_pieces))
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


def load_data(
    scale: Scale,
    time_scale: TimeScale,
    year: int,
    month: Optional[int] = None,
    region: Optional[Region] = None,
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
        filename_part_1 = {
            "south": "so",
            "northeast": "ne",
            "west": "we",
            "midwest": "mw",
        }[region]
        extra_path = quote(region.capitalize() + " Region")
    elif scale == "county":
        filename_part_1 = "co"
        extra_path = None
    elif scale == "metro":
        filename_part_1 = "ma"
        extra_path = None
    elif scale == "state":
        if region is not None:
            raise ValueError("region must be None in since scale = 'state'")
        filename_part_1 = "st"
        extra_path = None

    scale_path = scale.capitalize()

    if extra_path is not None:
        path = f"https://www2.census.gov/econ/bps/{scale_path}/{extra_path}/{filename_part_1}{filename_part_2}.txt"
    else:
        path = f"https://www2.census.gov/econ/bps/{scale_path}/{filename_part_1}{filename_part_2}.txt"

    print(f"Dowloading data from {path}")

    result = (
        requests.get(path, stream=True)
        .text
        # OMG so dumb that they didn't wrap with quotations
        .replace("Bristol, VA", '"Bristol, VA"')
        .replace("Bristol, TN", '"Bristol, TN"')
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
    df.columns = _fix_column_names(header_row_1, header_row_2)

    if scale == "state":
        state_cleanup(df)

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
    return df
