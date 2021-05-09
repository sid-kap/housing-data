from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING
from urllib.parse import quote

import requests

if TYPE_CHECKING:
    from typing import Optional


def get_url_text(
    url: str,
    data_path: Optional[str],
    encoding: Optional[str] = None,
    encode_url: bool = False,
) -> str:
    """
    If data_path is not None, returns the file from that path
    (assuming it's stored there with the same filename as in the URL).

    Otherwise, downloads it from the web.
    """
    if data_path is not None:
        path = Path(data_path, Path(url).name)
        return path.read_text(encoding=encoding)
    else:
        if encode_url:
            url = quote(url)
        return requests.get(url).text


def get_path(url: str, data_path: Optional[str]) -> str:
    if data_path is not None:
        return str(Path(data_path, Path(url).name))
    else:
        return url
