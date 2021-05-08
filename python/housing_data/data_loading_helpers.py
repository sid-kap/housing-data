from pathlib import Path


def get_url_text(url: str, data_path: Optional[str]) -> str:
    """
    If data_path is not None, returns the file from that path
    (assuming it's stored there with the same filename as in the URL).

    Otherwise, downloads it from the web.
    """
    if data_path is not None:
        path = Path(data_path, Path(url).name)
        return Path.read_text()
    else:
        return requests.get(url).text


def get_path(url: str, data_path: Optional[str]) -> str:
    if data_path is not None:
        return str(Path(data_path, Path(url).name))
    else:
        return url
