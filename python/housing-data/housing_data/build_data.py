from pathlib import Path

import housing_data.building_permits_survey as bps
import pandas as pd
from tqdm import tqdm


def main():
    # dfs = []
    # for year in range(1980, 2020):
    #     data = bps.load_data(
    #         scale="state", time_scale="annual", year=year, month=None, region=None
    #     ).assign(year=str(year))
    #     dfs.append(data)

    # pd.concat(dfs).to_json("../../public/state_annual.json", orient="records")

    dfs = []
    for year in range(1980, 2020):
        for region in ["west", "midwest", "south", "northeast"]:
            data = bps.load_data(
                scale="place", time_scale="annual", year=year, month=None, region=region
            ).assign(year=str(year))
            dfs.append(data)

    places_df = pd.concat(dfs)

    places_df.to_json("../../public/place_annual.json", orient="records")
    (
        places_df[["place_name", "state_code"]]
        .drop_duplicates()
        .sort_values("place_name")
        .to_json("../../public/places_list.json", orient="records")
    )

    Path("../../public/places_data")
    for name, group in tqdm(places_df.groupby(["place_name", "state_code"])):
        place_name, state_code = name
        path = Path(f"../../public/places_data/{state_code}")
        path.mkdir(parents=True, exist_ok=True)
        group.reset_index(drop=True).to_json(
            Path(path, f"{place_name}.json"), orient="records"
        )
    # pd.concat(dfs, ignore_index=True).to_feather("../../public/place_annual.feather")


if __name__ == "__main__":
    main()
