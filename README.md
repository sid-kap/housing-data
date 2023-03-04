# housing-data

[housingdata](https://housingdata.app) is a webapp that displays trends in housing contruction in US and Canada cities, counties, metro areas and states/provinces from 1980 to present.

The data comes from the US Census's monthly [Building Permits Survey](https://www.census.gov/construction/bps/index.html) (data publicly available) and Statistics Canada's [Building Permits](https://www23.statcan.gc.ca/imdb/p2SV.pl?Function=getSurvey&SDDS=2802) survey (not publicly available at the city level, I had to purchase it).

## Code structure

The raw data is stored as a combination of fixed-width, CSV, and Excel files at [https://github.com/sid-kap/housing-data-data](https://github.com/sid-kap/housing-data-data). I try to update the raw data files in that repo when BPS releases new data every month.

The raw data is converted to JSON files usable by the web front-end by python/pandas code that lives in `python/`. That code runs in every Vercel deploy, which runs after new commits in `main`. The JSON files are hosted as static assets by Vercel.

The front-end is written in React/Next.js and hosted by Vercel.

## Getting Started

You should have `yarn` and `poetry` installed on your machine.

```sh
# Clone the raw data repo to ../housing-data-data
pushd ..
git clone https://github.com/sid-kap/housing-data-data
popd

# Set up the python venv
pushd python
poetry install
popd

# Run python code to build the static JSON files in ./public
./build_data_local.sh

# Run the local Next.js development server at http://localhost:3000
yarn dev
```
