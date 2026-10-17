import logging
import threading
from collections.abc import Mapping
from typing import TYPE_CHECKING, Literal

from pydantic import BaseModel

if TYPE_CHECKING:
    from storm_shield.replay import ReplayClockMessage

WarningReason = Literal[
    "water_surge", "water_high", "water_rising", "rain_heavy", "pressure_falling"
]


logger = logging.getLogger(__name__)


class CommunityWarning(BaseModel):
    """A Community Warning in the mesh format of docs/specs/wire-formats.md; only the Hub sends one.

    There is no text field on purpose: the "not official" label and the pointer to official
    sources are fixed dashboard text that no message can drop or reword.
    """

    v: Literal[1] = 1
    kind: Literal["warning"] = "warning"
    # Counts up on the Hub; a Node tells a repeat from a new warning by it.
    id: int
    t: int
    nodes: list[str]
    reasons: list[WarningReason]
    origin: str
    origin_km: float
    surge_t: int


class HubWarnings:
    """The Hub's side of Community Warnings: decides when one is due and remembers what it sent."""

    def __init__(self, first_id: int) -> None:
        # The Reticulum receive thread issues while request threads read the log.
        self._lock = threading.Lock()
        self._next_id = first_id
        self._warned: set[str] = set()
        self._unplaced: set[str] = set()
        self._sent: list[CommunityWarning] = []

    def issue_for_new_surges(
        self, surging_km: Mapping[str, float | None], surge_t: int, now: int
    ) -> list[CommunityWarning]:
        """One warning for each Node in `surging_km` (id to River km) not already warned about.

        A Node is forgotten once it stops surging, so a second Surge from it warns again. A Node
        with no River km cannot be placed on the river, so it gets no warning, and a log line once.
        """
        with self._lock:
            self._warned &= surging_km.keys()
            self._unplaced &= surging_km.keys()
            issued: list[CommunityWarning] = []
            for node, river_km in sorted(surging_km.items()):
                if river_km is None:
                    if node not in self._unplaced:
                        logger.warning("Node %s is surging but has no NODE_RIVER_KM", node)
                        self._unplaced.add(node)
                    continue
                if node in self._warned:
                    continue
                issued.append(
                    CommunityWarning(
                        id=self._next_id,
                        t=now,
                        nodes=[node],
                        reasons=["water_surge"],
                        origin=node,
                        origin_km=river_km,
                        surge_t=surge_t,
                    )
                )
                self._next_id += 1
                self._warned.add(node)
            self._sent.extend(issued)
            return issued

    def sent(self) -> list[CommunityWarning]:
        """Every warning sent since this Hub started, newest first."""
        with self._lock:
            return self._sent[::-1]


def _id(warning: CommunityWarning) -> int:
    return warning.id


class HeardCommunityWarnings:
    """Every Community Warning this Node has heard from the Hub, by id."""

    def __init__(self) -> None:
        # The Reticulum receive thread writes while request threads read.
        self._lock = threading.Lock()
        self._by_id: dict[int, CommunityWarning] = {}

    def hear(self, warning: CommunityWarning) -> None:
        with self._lock:
            self._by_id[warning.id] = warning

    def shown_at(self, event: "ReplayClockMessage") -> list[CommunityWarning]:
        """The warnings to show, oldest first.

        While a replay runs, a warning shows only once the Event clock has reached its Surge, so a
        reset or a jump back hides it without the Hub taking it back; with no replay all show.
        """
        with self._lock:
            warnings = list(self._by_id.values())
        if event.state != "stopped":
            warnings = [warning for warning in warnings if warning.surge_t <= event.event_t]
        # A replay run again warns about the same Node under a new id; only the newest shows.
        newest_per_origin = {warning.origin: warning for warning in sorted(warnings, key=_id)}
        return sorted(newest_per_origin.values(), key=_id)
