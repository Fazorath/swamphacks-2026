import threading
from collections.abc import Callable
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


class UnknownShelter(ValueError):
    """The id is not a Shelter in this Hub's Cache Pack."""


class ShelterRegistry:
    """The Hub's own record of which Shelters are open, and the `ver` it announces them under."""

    def __init__(
        self, pack_shelter_ids: Callable[[], list[str]], unix_seconds: Callable[[], int]
    ) -> None:
        # Read on every call, because the Cache Pack may arrive after the Hub starts.
        self._pack_shelter_ids = pack_shelter_ids
        self._unix_seconds = unix_seconds
        # Request threads change a Shelter while the repeat loop reads the snapshot.
        self._lock = threading.Lock()
        self._ver = 0
        self._open: set[str] = set()

    def snapshot(self) -> ShelterStatus | None:
        """The current status; the first call with a pack opens every Shelter at `ver` 1.

        None while the Hub has no Shelters yet, because it has nothing to announce.
        """
        with self._lock:
            return self._seeded_status()

    def set_open(self, shelter_id: str, is_open: bool) -> ShelterStatus:
        """Open or close one Shelter under a higher `ver`, so every Node takes the change."""
        if shelter_id not in self._pack_shelter_ids():
            raise UnknownShelter(shelter_id)
        with self._lock:
            self._seeded_status()
            if is_open:
                self._open.add(shelter_id)
            else:
                self._open.discard(shelter_id)
            self._ver += 1
            return self._status()

    def _seeded_status(self) -> ShelterStatus | None:
        if self._ver == 0:
            shelter_ids = self._pack_shelter_ids()
            if not shelter_ids:
                return None
            self._open = set(shelter_ids)
            self._ver = 1
        return self._status()

    def _status(self) -> ShelterStatus:
        # Pack order keeps the list stable between announcements.
        shelter_ids = self._pack_shelter_ids()
        return ShelterStatus(
            ver=self._ver,
            t=self._unix_seconds(),
            open=[sid for sid in shelter_ids if sid in self._open],
        )
