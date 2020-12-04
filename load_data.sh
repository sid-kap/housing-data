pushd python/housing-data/ || exit
poetry run build_data
popd || exit
