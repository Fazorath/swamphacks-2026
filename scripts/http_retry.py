"""One retrying GET/POST for every data build that talks to a flaky public source."""

import time
from collections.abc import Callable

import httpx

ATTEMPTS = 5
RETRY_PAUSE_SECONDS = 10


class RequestFailed(Exception):
    """A request that stayed failed; its message names the source and the error, never the URL."""


def describe_error(error: httpx.HTTPError) -> str:
    # Not str(error): an httpx message holds the request URL, and a URL can carry a key.
    if isinstance(error, httpx.HTTPStatusError):
        return f"HTTP {error.response.status_code}"
    return type(error).__name__


def get_with_retries(request: Callable[[], httpx.Response], what: str) -> httpx.Response:
    """The response of `request()`, tried up to `ATTEMPTS` times on a network or status error."""
    for attempt in range(1, ATTEMPTS + 1):
        try:
            response = request()
            response.raise_for_status()
            return response
        except httpx.HTTPError as error:
            problem = describe_error(error)
            if attempt == ATTEMPTS:
                raise RequestFailed(f"{what} failed {ATTEMPTS} times, last {problem}") from None
            print(f"{what} attempt {attempt} failed ({problem}); retrying", flush=True)
            time.sleep(RETRY_PAUSE_SECONDS)
    raise AssertionError("unreachable")
