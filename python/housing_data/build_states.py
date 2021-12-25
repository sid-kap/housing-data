from pathlib import Path

import pandas as pd
from housing_data import building_permits_survey as bps
from housing_data import state_population
from housing_data.build_data_utils import (
    BPS_DIR,
    PUBLIC_DIR,
    STATE_POPULATION_DIR,
    add_per_capita_columns,
    write_to_json_directory,
)


def load_states(use_data_repo: bool):
    dfs = []
    for year in range(1980, 2021):
        data = bps.load_data(
            scale="state",
            time_scale="annual",
            year=year,
            month=None,
            region=None,
            data_path=BPS_DIR if use_data_repo else None,
        ).assign(year=str(year))
        dfs.append(data)

    states_df = pd.concat(dfs)
    states_df = states_df.astype({"survey_date": str})

    population_df = state_population.get_state_population_estimates(
        STATE_POPULATION_DIR if use_data_repo else None
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
    (
        states_df[["state_name", "name"]]
        .drop_duplicates()
        .sort_values("state_name")
        .to_json(PUBLIC_DIR / "states_list.json", orient="records")
    )

    write_to_json_directory(states_df, Path(PUBLIC_DIR, "states_data"), ["state_name"])
