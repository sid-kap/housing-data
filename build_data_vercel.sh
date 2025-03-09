#! /usr/bin/env bash

echo "$HOME/.local/bin/env"
curl -LsSf https://astral.sh/uv/install.sh | sh
# shellcheck source=$HOME/.local/bin/env
source "$HOME/.local/bin/env"

cd python || exit

git clone https://github.com/sid-kap/housing-data-data ../housing-data-data
uv run python -m housing_data.build_data --data-repo-path ../housing-data-data
