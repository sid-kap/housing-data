"""
Loads California Housing and Community Development's dataset of housing
permits by place from 2018-2022.

This is probably more accurate than BPS. In particular, most cities don't
seem to be reporting ADUs to the Census, but they do to HCD.

Because of SB 35 triggers based on the amount of housing permitted, cities have
a greater incentive to report this data correctly.
"""
import numpy as np
import pandas as pd
from housing_data.fips_crosswalk import load_fips_crosswalk

BUILDING_PERMIT_COLUMNS = [
    "BP_VLOW_INCOME_DR",
    "BP_VLOW_INCOME_NDR",
    "BP_LOW_INCOME_DR",
    "BP_LOW_INCOME_NDR",
    "BP_MOD_INCOME_DR",
    "BP_MOD_INCOME_NDR",
    "BP_ABOVE_MOD_INCOME",
]

def load_california_apr(data_path: Optional[str]) -> pd.DataFrame:
    df = pd.read_csv(data_path / "data/apr/table-a2-2018-2022.csv.gz")

    # BPS doesn't include mobile homes, so we shouldn't include them here either
    df = df[df['UNIT_CAT_DESC'] != "Mobile Home Unit"].copy()

    df['units'] = df[BUILDING_PERMIT_COLUMNS].sum(axis='columns')
    df = df[df['units'] > 0].copy()

    df['building_type'] = (
        np.select(
            [
                df['UNIT_CAT_DESC'] == 'Accessory Dwelling Unit',
                df['UNIT_CAT_DESC'].isin(
                    ['Single-Family Detached Unit', 'Single-Family Attached Unit']
                ),
                (df['UNIT_CAT_DESC'] == '2-, 3-, and 4-Plex Units per Structure')
                & df['units'].isin([1, 2]),
                # If there are 3, 4, or more units in the project, assume it's 3 or 4.
                # TBH my prior is that 2-plexes are way more common than 3- or 4-plexes.
                # But for simplicity let's just put them in 3-to-4.
                # From 2018 to 2022, there are only ~2400 units worth of 2/3/4 unit projects
                # with >4 units in the project. So misclassifying these is not a big deal.
                df['UNIT_CAT_DESC'] == '2-, 3-, and 4-Plex Units per Structure',
                df['UNIT_CAT_DESC'] == '5 or More Units Per Structure',
            ],
            [
                'adu',
                '1_unit',
                '2_units',
                '3_to_4_units',
                '5_plus_units',
            ],
            None
        )
    )
    assert df['building_type'].isnull().sum() == 0

    df['buildings'] = 1

    wide_df = df.pivot_table(
        index=['JURS_NAME', 'CNTY_NAME', 'YEAR'],
        columns='building_type',
        values=['units', 'buildings'],
        fill_value=0,
        aggfunc='sum',
    ).reset_index()

    wide_df.columns = [f"{level_1}_{level_0}_apr" if level_1 else level_0 for level_0, level_1 in wide_df.columns]

    wide_df = wide_df.merge(
        _load_fips_crosswalk(data_path),

    return wide_df

def _load_fips_crosswalk(data_path: Optional[Path]) -> pd.DataFrame:
    crosswalk_df = load_fips_crosswalk(data_path)
    crosswalk_df = crosswalk_df[
        (crosswalk_df['State Code (FIPS)'] == 6)  # California rows
        & (
            (crosswalk_df['Place Code (FIPS)'] != 0)
            | (crosswalk_df['County Code (FIPS)'] != 0)
        )
    ].copy()

    crosswalk['JURS_NAME'] = (
        crosswalk_df['Area Name (including legal/statistical area description)']
        .str.removesuffix(" city")
        .str.removesuffix(" town")
        .replace({
            'San Buenaventura (Ventura)': "VENTURA",
            'El Paso de Robles (Paso Robles)': "PASO ROBLES",
            'St. Helena': "SAINT HELENA",
            'Cathedral City': 'CATHEDRAL',
            'Carmel-by-the-Sea': 'CARMEL',
            'La Cañada Flintridge': 'LA CANADA FLINTRIDGE',
            'Angels': 'ANGELS CAMP',
        })
        .str.upper()
    )

    crosswalk_df['place_or_county_code'] = np.where(
        crosswalk_df['County Code (FIPS)'] != 0,
        crosswalk_df['County Code (FIPS)'].astype(str) + '_county',
        crosswalk_df['Place Code (FIPS)']
    )
    return crosswalk_df[['JURS_NAME', 'place_or_county_code']]
