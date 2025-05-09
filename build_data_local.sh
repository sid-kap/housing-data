#! /usr/bin/env bash
pushd python/ || exit

# Assumes that https://github.com/sid-kap/housing-data-data has been cloned at the same level as the
# housing-data repo.
uv run python -m housing_data.build_data --data-repo-path ../../housing-data-data

popd || exit
