yum install -y python3
curl -sSL https://raw.githubusercontent.com/python-poetry/poetry/master/get-poetry.py | python -
cd python/housing-data
PATH=PATH:$HOME/.poetry/bin
which python
poetry install
poetry run python -m building_data.build_data
