from pathlib import Path

import pandas as pd
from housing_data.build_data_utils import CANADA_POPULATION_DIR


def load_populations(data_root_path: Path) -> pd.DataFrame:
    df = pd.read_csv(data_root_path / CANADA_POPULATION_DIR / "17100142.csv")

    df = (
        df[["REF_DATE", "DGUID", "VALUE"]]
        .dropna()
        .rename(
            columns={
                "REF_DATE": "year",
                "DGUID": "SGC",
                "VALUE": "population",
            }
        )
    )

    df["SGC"] = df["SGC"].str.removeprefix("2016A0005")

    # We don't have 2000 data, let's just use 2001 data for 2000
    df = pd.concat([df, df[df["year"] == 2001].assign(year=2000)])

    return df
