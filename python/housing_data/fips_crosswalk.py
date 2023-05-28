from pathlib import Path
from typing import Optional

import pandas as pd
from housing_data.data_loading_helpers import get_path


def load_fips_crosswalk(data_path: Optional[Path]) -> pd.DataFrame:
    return pd.read_excel(
        get_path(
            "https://www2.census.gov/programs-surveys/popest/geographies/2021/all-geocodes-v2021.xlsx",
            data_path,
        ),
        skiprows=4,
    )
