import shutil
from pathlib import Path
from subprocess import Popen

import numpy as np
import pandas as pd
from housing_data import building_permits_survey as bps
from housing_data import county_population, place_population, population
from tqdm import tqdm

PUBLIC_DIR = Path("../public")
GITHUB_DATA_REPO_DIR = Path("../housing-data-data")
GITHUB_DATA_DIR = str(Path(GITHUB_DATA_REPO_DIR, "data"))

UNITS_COLUMNS = [
    "1_unit_units",
    "2_units_units",
    "3_to_4_units_units",
    "5_plus_units_units",
]

NUMERICAL_COLUMNS = [
    "1_unit_bldgs",
    "1_unit_units",
    "1_unit_value",
    "2_units_bldgs",
    "2_units_units",
    "2_units_value",
    "3_to_4_units_bldgs",
    "3_to_4_units_units",
    "3_to_4_units_value",
    "5_plus_units_bldgs",
    "5_plus_units_units",
    "5_plus_units_value",
    "1_unit_bldgs_reported",
    "1_unit_units_reported",
    "1_unit_value_reported",
    "2_units_bldgs_reported",
    "2_units_units_reported",
    "2_units_value_reported",
    "3_to_4_units_bldgs_reported",
    "3_to_4_units_units_reported",
    "3_to_4_units_value_reported",
    "5_plus_units_bldgs_reported",
    "5_plus_units_units_reported",
    "5_plus_units_value_reported",
    "total_units",
]

NUMERICAL_NON_REPORTED_COLUMNS = [
    col for col in NUMERICAL_COLUMNS if "reported" not in col
]


def main():
    # Make sure the public/ directory exists
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    # Download the source data repo
    Popen(
        [
            "git",
            "clone",
            " https://github.com/sid-kap/housing-data-data",
            "-o",
            str(GITHUB_DATA_REPO_DIR),
        ]
    ).wait()

    load_states()

    print("Loading county population data...")
    county_population_df = county_population.get_county_population_estimates()
    county_population_df.to_parquet(PUBLIC_DIR / "county_populations.parquet")

    raw_places_df = load_places(county_population_df)
    counties_df = load_counties(raw_places_df, county_population_df)
    load_metros(counties_df)


def load_states():
    dfs = []
    for year in range(1980, 2020):
        data = bps.load_data(
            scale="state",
            time_scale="annual",
            year=year,
            month=None,
            region=None,
            data_path=GITHUB_DATA_DIR,
        ).assign(year=str(year))
        dfs.append(data)

    states_df = pd.concat(dfs)
    states_df = states_df.astype({"survey_date": str})

    population_df = population.get_state_population_estimates()
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


def make_bps_fips_mapping(
    places_df: pd.DataFrame, place_population_df: pd.DataFrame
) -> pd.DataFrame:
    """
    Returns a DataFrame with columns: 6_digit_id, state_code, place_or_county_code
    """
    # The most recent years have fips code in BPS, so we'll use those to join.
    # Some years will have the same BPS 6-digit ID, so we can join roughly 1992 to present using that.
    # From 1980-1991 BPS has different FIPS codes, so it becomes a little trickier.
    mapping = places_df[(places_df["year"] == "2019")][
        ["place_name", "fips place_code", "county_code", "state_code", "6_digit_id"]
    ].copy()

    # For it to be a mapping, each BPS ID should appear only once per state...
    assert (mapping.groupby(["6_digit_id", "state_code"]).size() == 1).all()

    fips_place_code_str = mapping["fips place_code"].astype(str).replace("<NA>", "")
    county_code_str = mapping["county_code"].astype(str).replace("<NA>", "")

    mapping["place_or_county_code"] = fips_place_code_str.where(
        ~mapping["fips place_code"].isin([0, 99990]), county_code_str + "_county"
    )

    # Fix NYC boroughs: we don't want to use the whole city population as the denominator in per-capite calculations
    # for the borough plots.
    # The boroughs all have place_or_county_code = 51000, state_code = 36, and place_name = the borough name.
    # The third condition below is needed because there is also a "New York City" total row which has the same state and
    # place code, but which we don't want to change.
    nyc_borough_rows = (
        (mapping["place_or_county_code"] == "51000")
        & (mapping["state_code"] == 36)
        & (mapping["place_name"] != "New York City")
    )

    mapping["place_or_county_code"] = mapping["place_or_county_code"].where(
        ~nyc_borough_rows,
        mapping["place_name"].map(
            {
                "Manhattan": "61_county",
                "Brooklyn": "47_county",
                "Bronx": "5_county",
                "Queens": "81_county",
                "Staten Island": "85_county",
            }
        ),
    )

    mapping = mapping[["6_digit_id", "state_code", "place_or_county_code"]]
    mapping["6_digit_id"] = mapping["6_digit_id"].astype(str)

    return mapping


def make_place_name_fips_mapping(merged_rows):
    mapping = merged_rows[
        ["place_name", "state_code", "place_or_county_code"]
    ].drop_duplicates()

    # Remove dupes ( (place_name, state_code) tuples for which there are multiple fips codes)
    dupes = mapping.groupby(["place_name", "state_code"]).size().loc[lambda x: x > 1]
    mapping = (
        mapping.merge(
            dupes.rename("dupe_count").reset_index().drop(columns=["dupe_count"]),
            on=["place_name", "state_code"],
            how="left",
            indicator=True,
        )
        .loc[lambda df: df["_merge"] == "left_only"]
        .drop(columns=["_merge"])
    )

    # For this to be used as a mapping, it must also satisfy this property
    assert (mapping.groupby(["place_name", "state_code"]).size() == 1).all()

    return mapping


def add_place_population_data(
    places_df: pd.DataFrame, place_population_df: pd.DataFrame
) -> pd.DataFrame:
    bps_fips_mapping = make_bps_fips_mapping(places_df, place_population_df)

    places_df = places_df.drop(columns=["fips place_code", "county_code"])

    # BPS changed their 6-digit IDs starting in 1992. So for rows from before 1992, we add '_pre_1992'
    # to the ID to distinguish them.
    places_df["6_digit_id"] = (
        places_df["6_digit_id"]
        .astype(str)
        .where(
            places_df["year"] >= "1992",
            places_df["6_digit_id"].astype(str) + "_pre_1992",
        )
    )

    merged_df = places_df.merge(
        bps_fips_mapping, how="left", on=["6_digit_id", "state_code"], indicator=True
    )
    assert len(merged_df) == len(places_df)
    print(
        "First mapping handled {:.1%} of rows!".format(
            (merged_df["_merge"] == "both").mean()
        )
    )
    merged_rows = merged_df[merged_df["_merge"] == "both"].drop(columns=["_merge"])
    unmerged_rows = merged_df[merged_df["_merge"] == "left_only"].drop(
        columns=["_merge", "place_or_county_code"]
    )
    assert len(merged_rows) + len(unmerged_rows) == len(places_df)

    # For earlier rows, we'll have to figure out the IDs by matching place name and state code.
    # Let's use 2019 names assuming that those are similar.
    place_name_fips_mapping = make_place_name_fips_mapping(merged_rows)

    unmerged_rows_2 = unmerged_rows.merge(
        place_name_fips_mapping,
        how="left",
        on=["place_name", "state_code"],
        indicator=True,
    )

    print(
        "Second mapping handled {:.1%} of the remaining rows!".format(
            (unmerged_rows_2["_merge"] == "both").mean()
        )
    )
    unmerged_rows_2 = unmerged_rows_2.drop(columns=["_merge"])
    places_with_fips_df = pd.concat([merged_rows, unmerged_rows_2])

    # Finally, let's merge in population!
    final_places_df = places_with_fips_df.merge(
        place_population_df.drop(columns=["place_name"]),
        left_on=["place_or_county_code", "state_code", "year"],
        right_on=["place_or_county_code", "state_code", "year"],
        how="left",
    )

    print(
        "Final fraction of rows with population: {:.1%}".format(
            final_places_df["population"].notnull().mean()
        )
    )

    add_per_capita_columns(final_places_df)

    return final_places_df


def add_per_capita_columns(df):
    # There are three cities (Sitka, Weeki Wachee, and Carlton Landing) that had population 0 in some years
    population = df["population"].where(df["population"] != 0, pd.NA)

    for col in NUMERICAL_NON_REPORTED_COLUMNS:
        df[col + "_per_capita"] = df[col] / population


def _make_nyc_rows(raw_places_df):
    nyc_df = raw_places_df[
        raw_places_df["place_name"].isin(
            ["Manhattan", "Bronx", "Brooklyn", "Queens", "Staten Island"]
        )
        & (raw_places_df["state_code"] == 36)
    ]
    nyc_rows = nyc_df.groupby("year")[NUMERICAL_COLUMNS].sum().reset_index()

    nyc_rows["fips place_code"] = 51000
    nyc_rows["state_code"] = 36
    nyc_rows["place_name"] = "New York City"

    # Fabricate a new 6-digit-id
    nyc_rows["6_digit_id"] = -1000

    return nyc_rows


def add_alt_names(raw_places_df):
    """
    Add extra names to help with searching
    """
    raw_places_df["alt_name"] = None

    nyc_borough_rows = raw_places_df["place_name"].isin(
        ["Manhattan", "Bronx", "Brooklyn", "Queens", "Staten Island"]
    ) & (raw_places_df["state_code"] == 36)
    raw_places_df.loc[nyc_borough_rows, "alt_name"] = "New York City"

    nyc_rows = (raw_places_df["place_name"] == "New York City") & (
        raw_places_df["state_code"] == 36
    )
    raw_places_df.loc[
        nyc_rows, "alt_name"
    ] = "Manhattan Bronx Brooklyn Queens Staten Island"


def load_places(counties_population_df: pd.DataFrame = None) -> pd.DataFrame:
    dfs = []
    for year in range(1980, 2020):
        for region in ["west", "midwest", "south", "northeast"]:
            data = bps.load_data(
                scale="place",
                time_scale="annual",
                year=year,
                month=None,
                region=region,  # type: ignore
                data_path=GITHUB_DATA_DIR,
            ).assign(year=str(year))
            dfs.append(data)

    raw_places_df = pd.concat(dfs)
    nyc_rows = _make_nyc_rows(raw_places_df)
    raw_places_df = pd.concat([raw_places_df, nyc_rows])

    add_alt_names(raw_places_df)

    # raw_places_df.to_parquet(PUBLIC_DIR / "places_annual_without_population.parquet")

    place_populations_df = place_population.get_place_population_estimates()

    if counties_population_df is not None:
        nyc_counties = [61, 47, 5, 81, 85]

        nyc_counties_df = counties_population_df[
            counties_population_df["county_code"].isin(nyc_counties)
            & (counties_population_df["state_code"] == 36)  # NY
        ].copy()
        nyc_counties_df["place_or_county_code"] = (
            nyc_counties_df["county_code"].astype(str) + "_county"
        )

        place_populations_df = pd.concat([place_populations_df, nyc_counties_df])

    places_df = add_place_population_data(raw_places_df, place_populations_df)
    places_df.to_parquet(PUBLIC_DIR / "places_annual.parquet")

    (
        places_df[["place_name", "state_code", "alt_name"]]
        .drop_duplicates()
        .sort_values("place_name")
        .to_json(PUBLIC_DIR / "places_list.json", orient="records")
    )

    write_to_json_directory(
        places_df, Path(PUBLIC_DIR, "places_data"), ["place_name", "state_code"]
    )

    return raw_places_df


def load_counties(
    places_df: pd.DataFrame = None, population_df: pd.DataFrame = None
) -> pd.DataFrame:
    """
    :param population_df: (Optional) pass in a pre-loaded population df, so that we don't have to load it twice.
        Useful since county population data is used twice (here, and also in `load_places` for NYC boroughs,
        which show up in places also).
    """
    dfs = []

    # The county data only goes back to 1990 :(
    # TODO: maybe try to reconstruct the data by summing up the cities?
    # Can verify to see if this is reasonably by comparing on the [1990, 2020] period
    # Note: most cities do have a county code, which seems to stay consistent! So maybe I can just sum up over that.
    for year in range(1990, 2020):
        df = bps.load_data(
            scale="county",
            time_scale="annual",
            year=year,
            month=None,
            region=None,
            data_path=GITHUB_DATA_DIR,
        ).assign(year=str(year))
        dfs.append(df)

    counties_df = pd.concat(dfs)

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

    if population_df is None:
        population_df = county_population.get_county_population_estimates()

    counties_df = counties_df.merge(
        population_df,
        how="left",
        left_on=["fips_county", "fips_state", "year"],
        right_on=["county_code", "state_code", "year"],
    )
    add_per_capita_columns(counties_df)

    counties_df.to_parquet(PUBLIC_DIR / "counties_annual.parquet")

    (
        counties_df[["county_name", "fips_state"]]
        .rename(columns={"fips_state": "state_code"})
        .drop_duplicates()
        .sort_values("county_name")
        .to_json(PUBLIC_DIR / "counties_list.json", orient="records")
    )

    write_to_json_directory(
        counties_df, Path(PUBLIC_DIR / "counties_data"), ["county_name", "fips_state"]
    )

    return counties_df


def impute_pre_1990_counties(counties_df, places_df):
    summed_places_df = (
        places_df.groupby(["county_code", "state_code", "year"])[NUMERICAL_COLUMNS]
        .sum()
        .reset_index()
    )

    imputed_counties_df = summed_places_df[summed_places_df["year"] < "1990"].copy()
    imputed_counties_df["imputed"] = True
    imputed_counties_df = imputed_counties_df.rename(
        columns={"county_code": "fips_county", "state_code": "fips_state"}
    )

    return imputed_counties_df


def load_metros(counties_df):
    counties_df = counties_df.drop(
        columns=[col for col in counties_df.columns if "_per_capita" in col]
    )

    crosswalk_df = pd.read_csv(
        "http://data.nber.org/cbsa-csa-fips-county-crosswalk/cbsa2fipsxw.csv"
    )

    # Could also get county name from 'countycountyequivalent' in crosswalk_df... I'm indifferent, just using the
    # one from counties_df for now.
    crosswalk_df = (
        crosswalk_df[["fipsstatecode", "fipscountycode", "csatitle", "cbsatitle"]]
        .rename(
            columns={
                "fipsstatecode": "fips_state",
                "fipscountycode": "fips_county",
                "csatitle": "csa_name",
                "cbsatitle": "cbsa_name",
            }
        )
        .dropna(subset=["cbsa_name"])[
            ["fips_state", "fips_county", "csa_name", "cbsa_name"]
        ]
    )

    merged_df = crosswalk_df.merge(
        counties_df, on=["fips_state", "fips_county"], how="left"
    )

    columns_to_drop = [
        "fips_state",
        "fips_county",
        "region_code",
        "division_code",
        "survey_date",
    ]

    aggregate_functions = {
        col: pd.NamedAgg(column=col, aggfunc="sum") for col in NUMERICAL_COLUMNS
    }
    aggregate_functions["county_names"] = pd.NamedAgg(
        column="county_name", aggfunc=lambda counties: counties.tolist()
    )
    aggregate_functions["population"] = pd.NamedAgg(column="population", aggfunc="sum")

    cbsas_df = (
        merged_df.drop(columns=["csa_name"] + columns_to_drop)
        .groupby(["cbsa_name", "year"])
        .agg(**aggregate_functions)
        .reset_index()
        .rename(columns={"cbsa_name": "metro_name"})
        .assign(metro_type="cbsa")
    )

    csas_df = (
        merged_df.drop(columns=["cbsa_name"] + columns_to_drop)
        .groupby(["csa_name", "year"])
        .agg(**aggregate_functions)
        .reset_index()
        .rename(columns={"csa_name": "metro_name"})
        .assign(metro_type="csa")
    )

    metros_df = pd.concat([cbsas_df, csas_df])

    add_per_capita_columns(metros_df)
    metros_df["path"] = metros_df["metro_name"].str.replace("/", "-")

    metros_df.to_parquet(PUBLIC_DIR / "metros_annual.parquet")

    (
        metros_df[["metro_name", "metro_type", "path", "county_names"]]
        .drop_duplicates(subset=["metro_name", "metro_type", "path"])
        .sort_values("metro_name")
        .to_json(PUBLIC_DIR / "metros_list.json", orient="records")
    )

    write_to_json_directory(
        metros_df.drop(columns=["county_names"]),
        Path(PUBLIC_DIR, "metros_data"),
        ["path"],
    )


if __name__ == "__main__":
    main()
