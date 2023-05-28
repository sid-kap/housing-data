#! /usr/bin/env bash

# amazon-linux-extras install python3.10
# python3.10

wget https://www.python.org/ftp/python/3.10.11/Python-3.10.11.tgz
tar xzf Python-3.10.11.tgz
cd Python-3.10.11
sudo ./configure --enable-optimizations
sudo make altinstall
rm -rf Python-3.10.11.tgz

pip3 install --user poetry
cd python || exit
export PATH=$PATH:$HOME/.local/bin
poetry install --no-dev

git clone https://github.com/sid-kap/housing-data-data ../housing-data-data
poetry run build_data --data-repo-path ../housing-data-data
