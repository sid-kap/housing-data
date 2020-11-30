import shutil
from pathlib import Path

import housing_data.building_permits_survey as bps
import pandas as pd
from tqdm import tqdm


def main():
    dfs = []
    for year in range(1980, 2020):
        data = bps.load_data(
            scale="state", time_scale="annual", year=year, month=None, region=None
        ).assign(year=str(year))
        dfs.append(data)

    pd.concat(dfs).to_json("../../public/state_annual.json", orient="records")

    dfs = []
    for year in range(1980, 2020):
        for region in ["west", "midwest", "south", "northeast"]:
            data = bps.load_data(
                scale="place", time_scale="annual", year=year, month=None, region=region
            ).assign(year=str(year))
            dfs.append(data)

    places_df = pd.concat(dfs)

    # breakpoint()
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

    places_root = Path("../../public/places_data")
    places_root.mkdir(exist_ok=True)
    shutil.rmtree(places_root)
    for name, group in tqdm(places_df.groupby(["place_name", "state_code"])):
        place_name, state_code = name
        path = Path(places_root, f"{state_code}")
        path.mkdir(parents=True, exist_ok=True)
        group.reset_index(drop=True).to_json(
            Path(path, f"{place_name}.json"), orient="records"
        )


if __name__ == "__main__":
    main()
