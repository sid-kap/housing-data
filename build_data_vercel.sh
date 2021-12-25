#! /usr/bin/env bash
yum install -y python3
pip3 install --user poetry
cd python || exit
export PATH=$PATH:$HOME/.local/bin
poetry install --no-dev
poetry run build_data --use-data-repo
