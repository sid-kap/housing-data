#! /usr/bin/env bash
yum install -y wget
wget https://www2.census.gov/econ/bps/State/st1980a.txt
cat st1980a.txt
# yum install -y python3
# pip3 install --user poetry
# cd python || exit
# export PATH=$PATH:$HOME/.local/bin
# poetry install --no-dev
# poetry run build_data
