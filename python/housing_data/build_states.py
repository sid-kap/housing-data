from pathlib import Path
from typing import Optional

from housing_data import state_population
from housing_data.build_data_utils import (
    PUBLIC_DIR,
    STATE_POPULATION_DIR,
    add_per_capita_columns,
    load_bps_all_years_plus_monthly,
    write_list_to_json,
    write_to_json_directory,
)


def load_states(data_repo_path: Optional[str]):
    states_df = load_bps_all_years_plus_monthly(data_repo_path, "state")
    states_df = states_df.astype({"survey_date": str})

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

    states_df.to_parquet(PUBLIC_DIR / "states_annual.parquet")

    # Old format (all states in one file) - might get rid of this at some point
    states_df.to_json(PUBLIC_DIR / "state_annual.json", orient="records")

    # New format for data
    write_list_to_json(
        states_df,
        PUBLIC_DIR / "states_list.json",
        ["state_name", "name"],
        add_latest_population_column=True,
    )

    write_to_json_directory(states_df, Path(PUBLIC_DIR, "states_data"), ["state_name"])
