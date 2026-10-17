import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

import httpx
from pydantic import BaseModel

from storm_shield.internet_connection import Status

logger = logging.getLogger(__name__)

# FL511's own website feed, not a documented API: no key, one JPEG per camera, cached upstream
# for 60 s. docs/tickets/0011-online-status-and-camera-tiles.md records how it was chosen.
PICTURE_URL = "https://fl511.com/map/Cctv/{camera_id}"
FETCH_TIMEOUT_SECONDS = 5
# Matches the upstream cache, so we never ask a feed we do not own more often than it changes.
REFRESH_EVERY_SECONDS = 60
# Three missed refreshes in a row and the picture is too old to call live.
LIVE_FOR_SECONDS = 3 * REFRESH_EVERY_SECONDS


@dataclass(frozen=True)
class Camera:
    id: int
    label: str


CAMERAS = (
    Camera(1655, "I-75 southbound at SR-24 / Archer Rd"),
    Camera(1647, "I-75 southbound at SR-26 / Newberry Rd"),
    Camera(1536, "I-75 northbound at SR-121 / Williston Rd"),
    Camera(1463, "I-75 northbound at Paynes Prairie"),
)


class CameraTile(BaseModel):
    id: int
    label: str
    state: Literal["live", "offline", "unavailable"]
    # Only a live tile has a picture to date.
    taken_at: datetime | None = None
    age_s: float | None = None


class Cameras:
    """The latest picture of each camera, fetched once and shared with every Viewer."""

    def __init__(self, source: httpx.Client) -> None:
        self._source = source
        self._pictures: dict[int, tuple[bytes, datetime]] = {}
        self._last_tried: dict[int, datetime] = {}

    def knows(self, camera_id: int) -> bool:
        return any(camera.id == camera_id for camera in CAMERAS)

    def refresh_due(self, now: datetime) -> None:
        for camera in CAMERAS:
            last_tried = self._last_tried.get(camera.id)
            if last_tried and (now - last_tried).total_seconds() < REFRESH_EVERY_SECONDS:
                continue
            # A failing camera waits out the same minute as a working one.
            self._last_tried[camera.id] = now
            self._fetch(camera, now)

    def picture(self, camera_id: int, status: Status, now: datetime) -> bytes | None:
        if status == "mesh_only":
            return None
        live = self._live_picture(camera_id, now)
        return live[0] if live else None

    def tiles(self, status: Status, now: datetime) -> list[CameraTile]:
        return [self._tile(camera, status, now) for camera in CAMERAS]

    def _tile(self, camera: Camera, status: Status, now: datetime) -> CameraTile:
        if status == "mesh_only":
            return CameraTile(id=camera.id, label=camera.label, state="offline")
        live = self._live_picture(camera.id, now)
        if live is None:
            return CameraTile(id=camera.id, label=camera.label, state="unavailable")
        taken_at = live[1]
        return CameraTile(
            id=camera.id,
            label=camera.label,
            state="live",
            taken_at=taken_at,
            age_s=(now - taken_at).total_seconds(),
        )

    def _live_picture(self, camera_id: int, now: datetime) -> tuple[bytes, datetime] | None:
        picture = self._pictures.get(camera_id)
        if picture is None or (now - picture[1]).total_seconds() > LIVE_FOR_SECONDS:
            return None
        return picture

    def _fetch(self, camera: Camera, now: datetime) -> None:
        try:
            upstream = self._source.get(PICTURE_URL.format(camera_id=camera.id))
        except httpx.HTTPError as error:
            logger.warning("camera %s request failed: %s", camera.id, type(error).__name__)
            return
        is_picture = upstream.headers.get("content-type", "").startswith("image/jpeg")
        if upstream.status_code != 200 or not is_picture or not upstream.content:
            logger.warning("camera %s gave no picture (HTTP %s)", camera.id, upstream.status_code)
            return
        self._pictures[camera.id] = (upstream.content, now)
