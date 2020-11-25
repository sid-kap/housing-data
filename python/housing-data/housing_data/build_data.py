import housing_data.building_permits_survey as bps
import pandas as pd


def main():

    dfs = []
    for year in range(1980, 2020):
        data = bps.load_data(
            scale="state", time_scale="annual", year=year, month=None, region=None
        ).assign(year=year)
        dfs.append(data)

    pd.concat(dfs).to_json("state_annual.json", orient="records")


if __name__ == "__main__":
    main()
