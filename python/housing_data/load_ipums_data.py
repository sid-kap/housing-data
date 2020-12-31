import os
import zipfile
from pathlib import Path

import requests


def main():
    if Path("IPUMS_KEY").is_file():
        key = Path("IPUMS_KEY").read_text().strip()
    else:
        key = os.env.get("IPUMS_KEY").strip()

    zip_response = requests.get(
        "https://live.nhgis.datadownload.ipums.org/web/extracts/nhgis/1533119/nhgis0015_csv.zip",
        headers={"Authorization": key},
    )
    print(zip_response.text)

    out_path = Path("../raw_data/")
    out_path.mkdir(parents=True, exist_ok=True)

    zip_path = Path("../raw_data/ipums_data.zip")
    zip_path.write_bytes(zip_response.content)
    with zipfile.ZipFile(zip_path, "r") as zip_file:
        zip_file.extractall(out_path)


if __name__ == "__main__":
    main()
