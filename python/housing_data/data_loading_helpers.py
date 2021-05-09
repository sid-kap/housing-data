from __future__ import annotations

import os
from pathlib import Path
from typing import TYPE_CHECKING
from urllib.parse import quote

import requests

if TYPE_CHECKING:
    from typing import Optional, Tuple, Union


def get_url_text(
    url: Union[str, Tuple[str, str]],
    data_path: Optional[str],
    encoding: Optional[str] = None,
) -> str:
    """
    If data_path is not None, returns the file from that path
    (assuming it's stored there with the same filename as in the URL).

    Otherwise, downloads it from the web.

    :param url: If url is a str, assumes that the path in the local case is
        just data_path + the "basename" of the url.
        If url is a tuple of the form (web_prefix, common_path), then the
        path in the local case is assuemd to be `common_path`
    """
    if isinstance(url, tuple):
        web_prefix, common_path = url
    else:
        web_prefix, common_path = os.path.split(url)

    if data_path is not None:
        path = Path(data_path, common_path)
        return path.read_text(encoding=encoding)
    else:
        web_url = os.path.join(web_prefix, common_path)
        return requests.get(web_url).text


def get_path(url: str, data_path: Optional[str]) -> str:
    if data_path is not None:
        return str(Path(data_path, Path(url).name))
    else:
        return url
