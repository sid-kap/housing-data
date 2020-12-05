import shutil
from pathlib import Path

import housing_data.building_permits_survey as bps
import numpy as np
import pandas as pd
from tqdm import tqdm

UNITS_COLUMNS = [
    "1_unit_units",
    "2_units_units",
    "3_to_4_units_units",
    "5_plus_units_units",
]


def main():
    load_states()
    places_df = load_places()
    load_counties(places_df)
    load_metros()


def load_states():
    dfs = []
    for year in range(1980, 2020):
        data = bps.load_data(
            scale="state", time_scale="annual", year=year, month=None, region=None
        ).assign(year=str(year))
        dfs.append(data)

    pd.concat(dfs).to_json("../../public/state_annual.json", orient="records")


def write_to_json_directory(df, path, group_cols=None):
    assert len(group_cols) in [1, 2]

    path.mkdir(exist_ok=True)
    shutil.rmtree(path)

    for name, group in tqdm(df.groupby(group_cols)):
        # small_name is the place or county name, big_name is the state code
        if isinstance(name, tuple):
            small_name, big_name = name
            assert isinstance(small_name, str)
            assert isinstance(big_name, (str, int, np.int64))
            sub_path = Path(path, f"{big_name}")
        elif isinstance(name, str):
            small_name = name
            sub_path = Path(path)
        else:
            raise ValueError(
                f"Unknown type of grouping columns: {group_cols}. Found: {name}"
            )

        sub_path.mkdir(parents=True, exist_ok=True)
        group.reset_index(drop=True).to_json(
            Path(sub_path, f"{small_name}.json"), orient="records"
        )


def load_places():
    dfs = []
    for year in range(1980, 2020):
        for region in ["west", "midwest", "south", "northeast"]:
            data = bps.load_data(
                scale="place", time_scale="annual", year=year, month=None, region=region
            ).assign(year=str(year))
            dfs.append(data)

    places_df = pd.concat(dfs)

    # TODO maybe some of these could be Int64 rather than str.
    # But I'm not using them right now, so it doesn't matter.
    STR_COLUMNS = [
        "survey_date",
        "zip_code",
        "fips place_code",
        "msa/cmsa",
        "pmsa_code",
        "place_code",
        "fips place_code",
        "fips mcd_code",
        "footnote_code",
        "pop",
    ]

    for col in STR_COLUMNS:
        places_df[col] = places_df[col].astype("str")

    places_df.to_parquet("../../public/places_annual.parquet")

    (
        places_df[["place_name", "state_code"]]
        .drop_duplicates()
        .sort_values("place_name")
        .to_json("../../public/places_list.json", orient="records")
    )

    write_to_json_directory(
        places_df, Path("../../public/places_data"), ["place_name", "state_code"]
    )

    return places_df


def load_counties(places_df=None):
    dfs = []

    # The county data only goes back to 1990 :(
    # TODO: maybe try to reconstruct the data by summing up the cities?
    # Can verify to see if this is reasonably by comparing on the [1990, 2020] period
    # Note: most cities do have a county code, which seems to stay consistent! So maybe I can just sum up over that.
    for year in range(1990, 2020):
        df = bps.load_data(
            scale="county", time_scale="annual", year=year, month=None, region=None
        ).assign(year=str(year))
        dfs.append(df)

    counties_df = pd.concat(dfs)

    counties_df.to_parquet("../../public/counties_annual.parquet")

    if places_df is not None:
        imputed_counties_df = impute_pre_1990_counties(counties_df, places_df)
        counties_df = pd.concat([counties_df, imputed_counties_df])

    # In some cases the county name is fucked up in some subset of years.
    # Let's just make it consistent by choosing the most recent one
    # Get the county_name of the most recent record (this is ok because the
    # imputed ones are all at the beginning of the time range)
    metadata_df = counties_df[["fips_state", "fips_county", "county_name", "year"]]
    metadata_df = (
        metadata_df.sort_values("year")
        .drop_duplicates(subset=["fips_state", "fips_county"], keep="last")
        .drop(columns="year")
    )

    counties_df = counties_df.drop(columns=["county_name"]).merge(
        metadata_df, on=["fips_state", "fips_county"], how="left"
    )

    (
        counties_df[["county_name", "fips_state"]]
        .rename(columns={"fips_state": "state_code"})
        .drop_duplicates()
        .sort_values("county_name")
        .to_json("../../public/counties_list.json", orient="records")
    )

    write_to_json_directory(
        counties_df, Path("../../public/counties_data"), ["county_name", "fips_state"]
    )


def impute_pre_1990_counties(counties_df, places_df):
    summed_places_df = (
        places_df.groupby(["county_code", "state_code", "year"])[UNITS_COLUMNS]
        .sum()
        .reset_index()
    )

    imputed_counties_df = summed_places_df[summed_places_df["year"] < "1990"].copy()
    imputed_counties_df["imputed"] = True
    imputed_counties_df = imputed_counties_df.rename(
        columns={"county_code": "fips_county", "state_code": "fips_state"}
    )

    return imputed_counties_df


if __name__ == "__main__":
    main()
