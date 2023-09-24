#! /usr/bin/env bash

# Python 3.9, last time I checked
yum install -y python3

# Fixes this error: https://urllib3.readthedocs.io/en/latest/v2-migration-guide.html#ssl-module-is-compiled-with-openssl-1-0-2-k-fips
# TODO: remove when Vercel upgrades to Amazon Linux 2023
yum remove openssl-devel-1.0.2k-24.amzn2.0.9.x86_64
yum remove openssl openssl-devel
yum update openssl11 openssl11-devel
yum install -y openssl11 openssl11-devel

pip3 install --user poetry
cd python || exit
export PATH=$PATH:$HOME/.local/bin
poetry install --no-dev

git clone https://github.com/sid-kap/housing-data-data ../housing-data-data
poetry run build_data --data-repo-path ../housing-data-data
