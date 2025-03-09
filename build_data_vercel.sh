#! /usr/bin/env bash

curl -LsSf https://astral.sh/uv/install.sh | sh
# shellcheck source=.local/bin/env
source .local/bin/env

cd python || exit

git clone https://github.com/sid-kap/housing-data-data ../housing-data-data
uv run python -m housing_data.build_data --data-repo-path ../housing-data-data
