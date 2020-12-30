"""
A script that downloads the 1980 city-specific population data from IPUMS.

Maybe if I like IPUMS enough, I can switch the other datasets to this also, but for now
I'm just using it for this data because it was the only one not available on the Census website.
"""

import json
import time
from pathlib import Path

import requests

dataset_params = {
    "datasets": {
        "1980_STF1": {
            "years": ["1980"],
            "data_tables": ["NT1A"],
            "geog_levels": ["PLACE_02398"],
            "breakdown_values": ["DV7001"],
        }
    }
}


def main():
    key = Path("IPUMS_KEY").read_text().strip()
    headers = {"Authorization": key}

    result = requests.post(
        "https://api.ipums.org/extracts/?product=nhgis&version=v1",
        headers=headers,
        json=dataset_params,
    )
    print(result.json())
    extract_number = result.json()["number"]

    while True:
        status_response = requests.post(
            f"https://api.ipums.org/extracts/{extract_number}?product=nhgis&version=v1",
            headers=headers,
        ).json()
        status = status_response["status"]
        print(status)
        if status == "completed":
            break
        time.sleep(1000)

    # TODO: Add code to load the dataset and unzip it. I can't implement this part because of issues downloading
    # it using the source, so I just downloaded
    # the data manually from https://data2.nhgis.org/downloads and unzipped it and put it in `raw_data`.
    # For now the build script will just read the `raw_data` file.
    # The code to download and unzip will be something like this:
    #
    # url = status_response['download_links']['table_data']
    # Path('../raw_data/population_data_1980.zip').write_bytes(requests.get(url, headers=headers).content)


if __name__ == "__main__":
    main()
