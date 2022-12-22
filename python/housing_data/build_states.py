from pathlib import Path
from typing import Optional

import pandas as pd
from housing_data import state_population
from housing_data.build_data_utils import (
    PUBLIC_DIR,
    STATE_POPULATION_DIR,
    add_per_capita_columns,
    load_bps_all_years_plus_monthly,
)


def load_states(data_repo_path: Optional[str]) -> pd.DataFrame:
    states_df = load_bps_all_years_plus_monthly(data_repo_path, "state")
    # states_df = states_df.astype({"survey_date": str})

    population_df = state_population.get_state_population_estimates(
        Path(data_repo_path, STATE_POPULATION_DIR) if data_repo_path else None
    )

    states_df = states_df.merge(
        population_df,
        how="left",
        left_on=["state_name", "year"],
        right_on=["state", "year"],
    )

    add_per_capita_columns(states_df)

    states_df["name"] = states_df["state_name"]
    states_df["path_1"] = None
    states_df["path_2"] = states_df["state_name"]
    states_df = states_df.drop(columns=["state_name", "state"])

    states_df.to_parquet(PUBLIC_DIR / "states_annual.parquet")

    # Old format (all states in one file) - might get rid of this at some point
    states_df.to_json(PUBLIC_DIR / "state_annual.json", orient="records")

    return states_df
