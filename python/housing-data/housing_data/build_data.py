import housing_data.building_permits_survey as bps


def main():
    data = bps.load_data(
        scale="state", time_scale="annual", year=2000, month=None, region="south"
    )

    data.to_json("data.json")


if __name__ == "__main__":
    main()
