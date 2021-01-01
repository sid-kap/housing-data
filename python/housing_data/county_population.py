from io import StringIO

import pandas as pd
import requests
import us


def get_county_populations_2010s():
    df = pd.read_csv(
        "https://www2.census.gov/programs-surveys/popest/datasets/2010-2019/counties/totals/co-est2019-alldata.csv",
        encoding="latin_1",
    )

    rename_cols = {"POPESTIMATE" + str(year): str(year) for year in range(2010, 2020)}
    rename_cols.update({"STATE": "state_code", "COUNTY": "county_code"})

    df = df[rename_cols.keys()].rename(columns=rename_cols)

    df = df.melt(
        id_vars=["county_code", "state_code"], var_name="year", value_name="population"
    )

    return df


def get_county_populations_2000s() -> pd.DataFrame:
    urls = [
        (
            state.fips,
            f"https://www2.census.gov/programs-surveys/popest/tables/2000-2010/"
            f"intercensal/county/co-est00int-01-{state.fips}.csv",
        )
        for state in us.STATES_AND_TERRITORIES
        if state.fips not in ["60", "66", "69", "72", "78"]  # exclude territories
    ]

    col_names = [
        "County Name",
        "2000-04-01",
        "2000",
        "2001",
        "2002",
        "2003",
        "2004",
        "2005",
        "2006",
        "2007",
        "2008",
        "2009",
        "2010-04-01",
        "2010",
    ]

    dfs = []
    for state_code, url in urls:
        df = pd.read_csv(
            url, names=col_names, skiprows=4, skipfooter=8, encoding="latin_1"
        )
        df["state_code"] = state_code
        df["County Name"] = df["County Name"].str.lstrip(".")

        dfs.append(df)

    df = pd.concat(dfs)
    df = df.rename(columns={"County Name": "county_name"})
    df = df.drop(columns=["2000-04-01", "2010-04-01"])
    df["state_code"] = df["state_code"].astype(int)

    df = df.melt(
        id_vars=["county_name", "state_code"], var_name="year", value_name="population"
    )

    df = df.merge(
        get_county_fips_crosswalk(), how="left", on=["county_name", "state_code"]
    )
    df = df.drop(columns=["county_name"])
    df = df[df["county_code"].notnull()].copy()

    df["population"] = (
        df["population"].str.replace(",", "").astype("float").astype("Int64")
    )
    df["county_code"] = df["county_code"].astype("Int64")

    # Use 2010 from the 2010s dataset
    # (I would like to do some smoothing later but let's not worry about that for now)
    df = df[df["year"] != "2010"].copy()

    return df


def get_county_fips_crosswalk() -> pd.DataFrame:
    df = pd.read_excel(
        "https://www2.census.gov/programs-surveys/popest/geographies/2019/all-geocodes-v2019.xlsx",
        skiprows=4,
    )
    df = df[df["County Code (FIPS)"] != 0]

    rename_cols = {
        "State Code (FIPS)": "state_code",
        "County Code (FIPS)": "county_code",
        "Area Name (including legal/statistical area description)": "county_name",
    }
    df = df[rename_cols.keys()].rename(columns=rename_cols)

    return df


def get_county_populations_1990s() -> pd.DataFrame:
    table_text = requests.get(
        "https://www2.census.gov/programs-surveys/popest/tables/1990-2000/counties/totals/99c8_00.txt"
    ).text

    table_text = table_text[: table_text.index("Block 2")].strip()

    df = pd.read_fwf(
        StringIO(table_text),
        skiprows=10,
        skipfooter=2,
        encoding="latin_1",
        names=[
            "idk",
            "full_county_code",
            "1999",
            "1998",
            "1997",
            "1996",
            "1995",
            "1994",
            "1993",
            "1992",
            "1991",
            "1990",
            "1990-04-01",
            "county_name",
        ],
    )

    df["state_code"] = df["full_county_code"].astype("Int64") // 1000
    df["county_code"] = df["full_county_code"].astype("Int64") % 1000
    df = df.dropna(subset=["state_code", "county_code"])
    df = df.drop(columns=["idk", "full_county_code", "1990-04-01", "county_name"])

    df = df.melt(
        id_vars=["county_code", "state_code"], var_name="year", value_name="population"
    )

    # df['population'] = df['population'].str.replace(',', '').str.strip('\x00\xa0\x9e\x850').astype(float).astype('Int64')
    df["population"] = (
        df["population"]
        .str.replace(",", "")
        .str.replace("\x00\xa0\x9e\x85", "")
        .str.replace("\x00\xa0\x9e", "")
        .astype(float)
        .astype("Int64")
    )

    return df


def get_county_populations_1980s() -> pd.DataFrame:
    dfs = []
    for year in range(1980, 1990):
        df = pd.read_excel(
            f"https://www2.census.gov/programs-surveys/popest/tables/1980-1990/counties/asrh/pe-02-{year}.xls",
            skiprows=5,
        )
        df = df.rename(
            columns={
                "Year of Estimate": "year",
                "FIPS State and County Codes": "combined_fips",
            }
        )

        df = (
            df.dropna(subset=["year"])
            .groupby(["year", "combined_fips"])
            .sum()
            .sum(axis=1)
            .rename("population")
            .reset_index()
        )

        dfs.append(df)

    combined_df = pd.concat(dfs)

    combined_df["combined_fips"] = combined_df["combined_fips"].astype("Int64")
    combined_df["year"] = combined_df["year"].astype("Int64").astype(str)
    combined_df["state_code"] = combined_df["combined_fips"] // 1000
    combined_df["county_code"] = combined_df["combined_fips"] % 1000

    combined_df = combined_df.drop(columns=["combined_fips"])

    return combined_df


def get_county_population_estimates():
    print("Loading 1980 populations...")
    df_1980s = get_county_populations_1980s()
    print("Loading 1990s populations...")
    df_1990s = get_county_populations_1990s()
    print("Loading 2000s populations...")
    df_2000s = get_county_populations_2000s()
    print("Loading 2010s populations...")
    df_2010s = get_county_populations_2010s()

    df = pd.concat([df_1980s, df_1990s, df_2000s, df_2010s])

    # Check for dupes
    assert (df.groupby(["county_code", "state_code", "year"]).size() == 1).all()

    return df
