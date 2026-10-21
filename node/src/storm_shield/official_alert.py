import threading
from datetime import datetime
from typing import TYPE_CHECKING, Literal

from pydantic import BaseModel, Field

from storm_shield.region import ALERT_TAG_MAX_LENGTH

if TYPE_CHECKING:
    # The replay timeline builds alerts, so a runtime import here would be circular.
    from storm_shield.replay import ReplayClockMessage

HEADLINE_MAX_LENGTH = 120

# Tags the Evacuation Plan matches against a household; empty means everyone in the zone.
AppliesTo = Literal["mobile_home", "rv", "flood_prone_area"]


class OfficialAlert(BaseModel):
    """An Official Alert in the mesh format of docs/specs/wire-formats.md; only the Hub sends one."""

    v: Literal[1] = 1
    kind: Literal["alert"] = "alert"
    id: str
    # A tag from the Region's `official_alert_sources`; the dashboard shows the source's name.
    source: str = Field(max_length=ALERT_TAG_MAX_LENGTH)
    # `replay` is what the dashboard turns into the OFFICIAL · REPLAY label.
    mode: Literal["live", "replay"]
    # The source's own timestamp, shown as given; for a replay it is also the Event time it is due.
    issued: str
    headline: str = Field(max_length=HEADLINE_MAX_LENGTH)
    applies_to: list[AppliesTo]
    url: str

    def issued_unix(self) -> int:
        return int(datetime.fromisoformat(self.issued).timestamp())


class HeardOfficialAlerts:
    """Every Official Alert this Node has heard from the Hub, by id."""

    def __init__(self) -> None:
        # The Reticulum receive thread writes while request threads read.
        self._lock = threading.Lock()
        self._by_id: dict[str, OfficialAlert] = {}

    def hear(self, alert: OfficialAlert) -> None:
        with self._lock:
            self._by_id[alert.id] = alert

    def shown_at(self, event: "ReplayClockMessage") -> list[OfficialAlert]:
        """The alerts to show, oldest first; a replayed one only once the Event clock has reached it.

        Checking against this Node's own Event clock means a reset or a jump back hides alerts the
        replay has not reached again, without the Hub having to take them back.
        """
        with self._lock:
            alerts = list(self._by_id.values())
        if event.state == "stopped":
            return []
        shown = [alert for alert in alerts if alert.issued_unix() <= event.event_t]
        return sorted(shown, key=OfficialAlert.issued_unix)
