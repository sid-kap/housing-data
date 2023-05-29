from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from housing_data import state_population
from housing_data.build_data_utils import (
    OPTIONAL_PREFIXES,
    OPTIONAL_SUFFIXES,
    PREFIXES,
    PUBLIC_DIR,
    STATE_POPULATION_DIR,
    SUFFIXES,
    add_per_capita_columns,
    load_bps_all_years_plus_monthly,
)


def load_states(data_repo_path: Optional[Path]) -> pd.DataFrame:
    states_df = load_bps_all_years_plus_monthly(data_repo_path, "state")

    population_df = state_population.get_state_population_estimates(
        data_repo_path / STATE_POPULATION_DIR if data_repo_path else None
    )

    states_df = states_df.merge(
        population_df,
        how="left",
        left_on=["state_name", "year"],
        right_on=["state", "year"],
    )

    # TODO actually add the data
    for prefix in OPTIONAL_PREFIXES + PREFIXES:
        for suffix in OPTIONAL_SUFFIXES:
            states_df[prefix + suffix] = np.nan

    add_per_capita_columns(
        states_df, prefixes=PREFIXES, suffixes=SUFFIXES + OPTIONAL_SUFFIXES
    )
    add_per_capita_columns(
        states_df, prefixes=OPTIONAL_PREFIXES, suffixes=OPTIONAL_SUFFIXES
    )

    states_df["name"] = states_df["state_name"]
    states_df["path_1"] = None
    states_df["path_2"] = states_df["state_name"]
    states_df = states_df.drop(columns=["state_name", "state"])

    states_df.to_parquet(PUBLIC_DIR / "states_annual.parquet")

    return states_df
