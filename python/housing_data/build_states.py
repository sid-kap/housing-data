import pandas as pd
from housing_data import building_permits_survey as bps
from housing_data import state_population
from housing_data.build_data_utils import (
    BPS_DIR,
    NUMERICAL_COLUMNS,
    PUBLIC_DIR,
    STATE_POPULATION_DIR,
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
    population_df.to_parquet(PUBLIC_DIR / "population_df.parquet")

    states_df = states_df.merge(
        population_df,
        how="left",
        left_on=["state_name", "year"],
        right_on=["state", "year"],
    )

    for col in NUMERICAL_COLUMNS:
        states_df[col + "_per_capita"] = states_df[col] / states_df["population"]

    states_df.to_parquet(PUBLIC_DIR / "states_annual.parquet")

    states_df.to_json(PUBLIC_DIR / "state_annual.json", orient="records")
