from pathlib import Path
from typing import Optional

import pandas as pd
from housing_data import state_population
from housing_data.build_data_utils import (
    STATE_POPULATION_DIR,
    load_bps_all_years_plus_monthly,
)

NON_STATE_FIPS = {
    "US",
    "R1",
    "R2",
    "R3",
    "R4",
    "D1",
    "D2",
    "D3",
    "D4",
    "D5",
    "D6",
    "D7",
    "D8",
    "D9",
}


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

    states_df["name"] = states_df["state_name"]
    states_df["path_1"] = None
    states_df["path_2"] = states_df["state_name"]

    states_df = states_df.drop(columns=["state_name", "state"])

    states_df["fips_state"] = (
        states_df["fips_state"]
        .map({code: None for code in NON_STATE_FIPS})
        .astype("Int64")
    )
    states_df = states_df.rename(columns={"fips_state": "state_code"})

    return states_df
