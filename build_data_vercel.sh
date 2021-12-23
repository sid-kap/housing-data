#! /usr/bin/env bash
yum install -y python3
pip3 install --user poetry
cd python || exit
export PATH=$PATH:$HOME/.local/bin
poetry install --no-dev
git clone https://github.com/sid-kap/housing-data-data ../housing-data-data
poetry run build_data --data-repo-path ../housing-data-data
