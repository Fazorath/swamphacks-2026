from typing import Literal

import httpx

# Google's connectivity-check URL answers 204 with no body. A captive portal answers 200 or
# redirects instead, so only an exact 204 proves the real internet is reachable.
CONNECTIVITY_URL = "https://www.gstatic.com/generate_204"
CONNECTIVITY_TIMEOUT_SECONDS = 2
# One dropped packet must not flip the badge, so a change needs this many probes in a row.
PROBES_IN_A_ROW_TO_FLIP = 2

Status = Literal["online", "mesh_only"]


class InternetConnection:
    """Whether this Node can reach the internet, judged only from this Node's own probes."""

    def __init__(self, source: httpx.Client) -> None:
        self._source = source
        self._status: Status | None = None
        self._disagreeing_probes = 0

    @property
    def status(self) -> Status:
        # Until a probe has answered, claim nothing: a Node is Mesh-only until shown otherwise.
        return self._status or "mesh_only"

    def probe(self) -> None:
        seen: Status = "online" if self._reachable() else "mesh_only"
        if self._status is None:
            self._status = seen
        elif seen == self._status:
            self._disagreeing_probes = 0
        else:
            self._disagreeing_probes += 1
            if self._disagreeing_probes >= PROBES_IN_A_ROW_TO_FLIP:
                self._status = seen
                self._disagreeing_probes = 0

    def _reachable(self) -> bool:
        try:
            return self._source.get(CONNECTIVITY_URL).status_code == 204
        except httpx.HTTPError:
            return False
