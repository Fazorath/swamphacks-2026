"""Reading a Region's sources: an address on the internet or a file under the Region's folder."""

from functools import partial
from pathlib import Path

import httpx
from http_retry import RequestFailed, get_with_retries


class SourceFailed(Exception):
    """A source the build could not read; the message says which one and why."""


def is_address(location: str) -> bool:
    return location.startswith(("http://", "https://"))


def read_source(
    client: httpx.Client,
    region_dir: Path,
    location: str,
    what: str,
    form: dict[str, str] | None = None,
) -> bytes:
    """The bytes at `location`: fetched when it is an address (posting `form` if given), else
    read from the file it names, relative to `region_dir`."""
    if is_address(location):
        request = partial(client.post, location, data=form) if form else partial(client.get, location)
        try:
            return get_with_retries(request, what).content
        except RequestFailed as error:
            raise SourceFailed(str(error)) from None
    path = region_dir / location
    try:
        return path.read_bytes()
    except OSError as error:
        raise SourceFailed(f"{what}: cannot read {path}: {error.strerror}") from None
