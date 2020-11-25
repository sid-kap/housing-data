from __future__ import annotations
from typing import TYPE_CHECKING

import pandas as pd
import itertools
import requests
from typing_extensions import Literal
from urllib.parse import quote
from io import StringIO

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


def _fix_column_names(columns: pd.Index) -> List[str]:
    last_units_group = ""

    fixed_columns = []
    for val_0, val_1 in columns:
        if val_0.startswith("Unnamed:"):
            val_0 = ""
        if val_1.startswith("Unnamed:"):
            val_1 = ""
        if val_0 in [
            "1-unit",
            "2-units",
            "3-4 units",
            "5+ units",
            "1-unit rep",
            "2-units rep",
            "3-4 units rep",
            "5+ units rep",
        ]:
            last_units_group = val_0

        # Don't add a space for 'MSA/CMSA'
        join_str = "" if val_0.endswith("/") else " "

        if val_1 in ["Value", "Bldgs"]:
            fixed_columns.append(last_units_group + join_str + val_1)
        else:
            fixed_columns.append(val_0 + join_str + val_1)

    return fixed_columns


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
        filename_part_1 = "st"
        extra_path = None

    if extra_path is not None:
        path = f"https://www2.census.gov/econ/bps/Place/{extra_path}/{filename_part_1}{filename_part_2}.txt"
    else:
        path = f"https://www2.census.gov/econ/bps/Place/{filename_part_1}{filename_part_2}.txt"

    csv_handle = StringIO(
        requests.get(path, stream=True)
        .text
        # OMG so dumb that they didn't wrap with quotations
        .replace("Bristol, VA", '"Bristol, VA"')
        .replace("Bristol, TN", '"Bristol, TN"')
    )

    header_rows = [
        csv_handle.readline().rstrip().split(","),
        csv_handle.readline().rstrip().split(","),
    ]

    # Skip blank line after header
    csv_handle.readline()

    df = pd.read_csv(csv_handle, header=None, index_col=False)
    df.columns = _fix_column_names(itertools.zip_longest(*header_rows, fillvalue=""))

    return df
