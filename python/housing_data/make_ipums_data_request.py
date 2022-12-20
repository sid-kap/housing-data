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
            "data_tables": ["NT1A"],
            "geog_levels": ["place_02398", "place_070", "county"],
        }
    },
    "data_format": "csv_header",
}


def main() -> None:
    key = Path("IPUMS_KEY").read_text().strip()
    headers = {"Authorization": key}

    result = requests.post(
        "https://api.ipums.org/extracts/?product=nhgis&version=v1",
        headers=headers,
        json=dataset_params,
        stream=True,
    )
    result_parsed = [json.loads(s) for s in result.iter_lines() if s]
    print(result_parsed)
    extract_numbers = {row.get("number") for row in result_parsed}
    assert len(extract_numbers) == 1
    extract_number = list(extract_numbers)[0]

    if extract_number is None:
        print(
            "Failed, probably because of duplicate requests that are already being processed"
        )
        return

    while True:
        status_response = requests.post(
            f"https://api.ipums.org/extracts/{extract_number}?product=nhgis&version=v1",
            headers=headers,
            stream=True,
        )
        statuses = [json.loads(s) for s in status_response.iter_lines() if s]
        print(statuses)
        if statuses[0] == "completed":
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
