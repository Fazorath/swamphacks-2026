import json
import threading
from collections.abc import Callable
from pathlib import Path
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
    """The Hub's own record of which Shelters are open, and the `ver` it announces them under.

    Kept in `state_file` so a restart neither reopens a closed Shelter nor lets `ver` go backwards.
    """

    def __init__(
        self,
        pack_shelter_ids: Callable[[], list[str]],
        unix_seconds: Callable[[], int],
        state_file: Path,
    ) -> None:
        # Read on every call, because the Cache Pack may arrive after the Hub starts.
        self._pack_shelter_ids = pack_shelter_ids
        self._unix_seconds = unix_seconds
        # Request threads change a Shelter while the repeat loop reads the snapshot.
        self._lock = threading.Lock()
        self._state_file = state_file
        self._ver = 0
        self._open: set[str] = set()
        if state_file.exists():
            saved = json.loads(state_file.read_text())
            self._open = set(saved["open"])
            # Nodes already hold the saved `ver`, and only a higher one replaces it.
            self._ver = saved["ver"] + 1
            self._save()

    def snapshot(self) -> ShelterStatus | None:
        """The current status; the first call with a pack opens every Shelter at `ver` 1.

        None while the pack has no Shelters, because there is nothing to announce.
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
            self._save()
            return self._status()

    def _seeded_status(self) -> ShelterStatus | None:
        shelter_ids = self._pack_shelter_ids()
        if not shelter_ids:
            return None
        if self._ver == 0:
            self._open = set(shelter_ids)
            self._ver = 1
            self._save()
        return self._status()

    def _save(self) -> None:
        # Replace the file in one step, so losing power mid-write cannot leave half a file.
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        pending = self._state_file.with_suffix(".tmp")
        pending.write_text(json.dumps({"ver": self._ver, "open": sorted(self._open)}))
        pending.replace(self._state_file)

    def _status(self) -> ShelterStatus:
        # Pack order keeps the list stable between announcements.
        shelter_ids = self._pack_shelter_ids()
        return ShelterStatus(
            ver=self._ver,
            t=self._unix_seconds(),
            open=[sid for sid in shelter_ids if sid in self._open],
        )
