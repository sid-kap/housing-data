#! /usr/bin/env bash
yum install -y python3
curl -sSL https://raw.githubusercontent.com/python-poetry/poetry/master/get-poetry.py | python3 -
cd python/housing-data || exit
export PATH=$PATH:$HOME/.poetry/bin
poetry install --no-dev
poetry run build_data
ls
