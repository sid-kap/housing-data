from io import StringIO
from pathlib import Path
from typing import Optional

import pandas as pd
import us
from housing_data.build_data_utils import impute_2023_population
from housing_data.data_loading_helpers import get_path, get_url_text

DIVISIONS = {
    "New England": [
        "Connecticut",
        "Maine",
        "Massachusetts",
        "New Hampshire",
        "Rhode Island",
        "Vermont",
    ],
    "Middle Atlantic": ["New Jersey", "New York", "Pennsylvania"],
    "East North Central": ["Illinois", "Indiana", "Michigan", "Ohio", "Wisconsin"],
    "West North Central": [
        "Iowa",
        "Kansas",
        "Minnesota",
        "Missouri",
        "Nebraska",
        "North Dakota",
        "South Dakota",
    ],
    "South Atlantic": [
        "Delaware",
        "Florida",
        "Georgia",
        "Maryland",
        "North Carolina",
        "South Carolina",
        "Virginia",
        "District of Columbia",
        "West Virginia",
    ],
    "East South Central": ["Alabama", "Kentucky", "Mississippi", "Tennessee"],
    "West South Central": ["Arkansas", "Louisiana", "Oklahoma", "Texas"],
    "Mountain": [
        "Arizona",
        "Colorado",
        "Idaho",
        "Montana",
        "Nevada",
        "New Mexico",
        "Utah",
        "Wyoming",
    ],
    "Pacific": ["Alaska", "California", "Hawaii", "Oregon", "Washington"],
}

REGIONS = {
    "Northeast": ["New England", "Middle Atlantic"],
    "Midwest": ["East North Central", "West North Central"],
    "South": ["South Atlantic", "East South Central", "West South Central"],
    "West": ["Mountain", "Pacific"],
}

STATE_TO_DIVISION = {
    state: division for division, states in DIVISIONS.items() for state in states
}
DIVISION_TO_REGION = {
    division: region for region, divisions in REGIONS.items() for division in divisions
}
STATE_TO_REGION = {
    state: DIVISION_TO_REGION[division] for state, division in STATE_TO_DIVISION.items()
}


def _line_to_cols(row: str) -> list[str]:
    return [s.strip() for s in row.split()]


def get_state_populations_1980s(data_path: Optional[Path]) -> pd.DataFrame:
    states_80s_text = get_url_text(
        "https://www2.census.gov/programs-surveys/popest/tables/1980-1990/state/asrh/st8090ts.txt",
        data_path,
    )
    handle = StringIO(states_80s_text)

    for _ in range(10):
        handle.readline()

    table_rows_1 = [handle.readline() for _ in range(51)]

    for _ in range(8):
        handle.readline()

    table_rows_2 = [handle.readline() for _ in range(51)]

    df_1 = pd.DataFrame(
        [_line_to_cols(row) for row in table_rows_1],
        columns=["state", "1980", "1981", "1982", "1983", "1984"],
    )

    df_2 = pd.DataFrame(
        [_line_to_cols(row) for row in table_rows_2],
        columns=["state", "1985", "1986", "1987", "1988", "1989", "1990"],
    )

    df = df_1.merge(df_2, on="state")
    df = df.astype({col: int for col in df.columns if col != "state"})

    df["state"] = df["state"].map(us.states.mapping("abbr", "name"))

    # We already have 1990 from the 1990-2000 series, don't need it twice
    df = df.drop(columns=["1990"])

    return df.melt(id_vars="state", var_name="year", value_name="population")


def _get_counties_population_table_1990s(
    year: int, data_path: Optional[Path]
) -> pd.DataFrame:
    assert 1990 <= year <= 1999

    df = pd.read_csv(
        get_path(
            f"https://www2.census.gov/programs-surveys/popest/tables/1990-2000/intercensal/st-co/stch-icen{year}.txt",
            data_path,
        ),
        delim_whitespace=True,
        names=[
            "year",
            "state_county_code",
            "age_group",
            "race_sex",
            "ethnic_origin",
            "population",
        ],
        dtype=int,
    )

    # the county code is formatted as a 5-digit number - first 2 digits are state code, next 3 are county code
    df["state_code"] = df["state_county_code"] // 1000

    df["year"] = "19" + df["year"].astype(str)

    FIPS_NAME_MAPPING = {
        int(k): v for k, v in us.states.mapping("fips", "name").items() if k is not None
    }
    df["state"] = df["state_code"].map(FIPS_NAME_MAPPING)

    return df


def get_state_populations_1990s(data_path: Optional[Path]) -> pd.DataFrame:
    df = pd.concat(
        [
            _get_counties_population_table_1990s(year, data_path)
            for year in range(1990, 2000)
        ]
    )

    return (
        df.drop(
            columns=[
                "age_group",
                "race_sex",
                "ethnic_origin",
                "state_county_code",
                "state_code",
            ]
        )
        .groupby(["year", "state"])
        .sum()
        .reset_index()
    )


def get_state_populations_2000s(data_path: Optional[Path]) -> pd.DataFrame:
    df = pd.read_excel(
        get_path(
            "https://www2.census.gov/programs-surveys/popest/tables/2000-2010/intercensal/state/st-est00int-01.xls",
            data_path,
        ),
        skiprows=3,
        skipfooter=8,
    )
    df = df.rename(
        columns={
            "Unnamed: 0": "state",
            "Unnamed: 1": "2010-04-01",
            "Unnamed: 12": "2020-04-01",
            "Unnamed: 13": "2020-07-01",
        }
    ).dropna(subset=["state"])

    df.columns = df.columns.astype(str)

    df["state"] = df["state"].str.lstrip(".")

    df = df.astype({col: int for col in df.columns if col != "state"})

    # We don't need these
    df = df.drop(columns=["2010-04-01", "2020-04-01", "2020-07-01"])

    return df.melt(id_vars="state", var_name="year", value_name="population")


def _melt_df(df: pd.DataFrame, years: list[int]) -> pd.DataFrame:
    return (
        df[["NAME"] + [f"POPESTIMATE{year}" for year in years]]
        .rename(columns={f"POPESTIMATE{year}": str(year) for year in years})
        .rename(columns={"NAME": "state"})
        .melt(id_vars=["state"], var_name="year", value_name="population")
    )


def get_state_populations_2010s(data_path: Optional[Path]) -> pd.DataFrame:
    df = pd.read_csv(
        get_path(
            "https://www2.census.gov/programs-surveys/popest/datasets/2010-2020/state/totals/nst-est2020-alldata.csv",
            data_path,
        )
    )

    return _melt_df(df, list(range(2010, 2020)))


def get_state_populations_2020s(data_path: Optional[Path]) -> pd.DataFrame:
    df = pd.read_csv(
        get_path(
            "https://www2.census.gov/programs-surveys/popest/datasets/2020-2022/state/totals/NST-EST2022-ALLDATA.csv",
            data_path,
        )
    )

    df = _melt_df(df, list(range(2020, 2023)))
    return impute_2023_population(df)


def get_state_population_estimates(data_path: Optional[Path]) -> pd.DataFrame:
    print("Loading 1980s data...")
    df_1980s = get_state_populations_1980s(data_path)

    print("Loading 1990s data...")
    df_1990s = get_state_populations_1990s(data_path)

    print("Loading 2000s data...")
    df_2000s = get_state_populations_2000s(data_path)

    print("Loading 2010s data...")
    df_2010s = get_state_populations_2010s(data_path)

    print("Loading 2020s data...")
    df_2020s = get_state_populations_2020s(data_path)

    states_df = pd.concat([df_1980s, df_1990s, df_2000s, df_2010s, df_2020s])

    states = us.states.mapping("name", "fips").keys()
    states_df = states_df[states_df["state"].isin(states)]

    missing_states = set(states) - (
        set(STATE_TO_DIVISION.keys()) | set(STATE_TO_REGION.keys())
    )
    print(f"Missing division/region mapping for states: {missing_states}")

    divisions_df = (
        states_df.assign(state=states_df["state"].map(STATE_TO_DIVISION))
        .groupby(["state", "year"])
        .sum()
        .reset_index()
    )
    regions_df = (
        states_df.assign(state=states_df["state"].map(STATE_TO_REGION))
        .groupby(["state", "year"])
        .sum()
        .reset_index()
    )

    return pd.concat([states_df, divisions_df, regions_df])
