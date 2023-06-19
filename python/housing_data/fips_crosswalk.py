from pathlib import Path

import pandas as pd


def load_fips_crosswalk(data_repo_path: Path) -> pd.DataFrame:
    return pd.read_excel(
        data_repo_path / "data/crosswalk/all-geocodes-v2021.xlsx", skiprows=4
    )
