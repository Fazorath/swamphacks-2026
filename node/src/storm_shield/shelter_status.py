import threading
from typing import Literal

from pydantic import BaseModel


class ShelterStatus(BaseModel):
    """The Hub's full list of open Shelters, in the mesh format of docs/specs/wire-formats.md."""

    v: Literal[1] = 1
    kind: Literal["shelters"] = "shelters"
    ver: int
    t: int
    open: list[str]


class HeardShelterStatus:
    """The newest Shelter status this Node has heard from the Hub, and nothing else."""

    def __init__(self) -> None:
        # The Reticulum receive thread writes while request threads read.
        self._lock = threading.Lock()
        self._newest: ShelterStatus | None = None

    def hear(self, status: ShelterStatus) -> None:
        """Keep the status only if its `ver` is higher, so a repeated old copy can't undo a closure."""
        with self._lock:
            if self._newest is None or status.ver > self._newest.ver:
                self._newest = status

    def open_among(self, shelter_ids: list[str]) -> list[str]:
        """The given ids the Hub has announced as open, in the given order; other ids drop out."""
        with self._lock:
            announced_open = set(self._newest.open) if self._newest else set()
        return [shelter_id for shelter_id in shelter_ids if shelter_id in announced_open]
