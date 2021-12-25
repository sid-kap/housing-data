#! /usr/bin/env bash
pushd python/ || exit
poetry run build_data --use-data-repo
popd || exit
