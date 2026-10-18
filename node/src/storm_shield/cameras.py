import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from storm_shield.internet_connection import Status
from storm_shield.settings import Role

logger = logging.getLogger(__name__)

MANIFEST_FILE = "manifest.json"


CAMERAS_FILE = Path(__file__).with_name("cameras.json")


class Camera(BaseModel):
    id: str
    label: str
    # The Node this camera is placed at, by name, and where that is.
    site: str
    lat: float
    lon: float
    # The clip's key in the manifest beside the clip files (scripts/make_camera_clips.py). A camera
    # without one is kept and shown Unavailable, so one bad entry never stops the Hub.
    clip: str | None = None


def load_cameras() -> tuple[Camera, ...]:
    """The camera list. No live Nepal camera qualified (docs/research/nepal-cameras.md), so every
    camera plays a clip."""
    try:
        entries = json.loads(CAMERAS_FILE.read_text())
    except (OSError, ValueError):
        logger.exception("could not read the camera list %s; the Hub has no cameras", CAMERAS_FILE)
        return ()
    cameras = []
    for entry in entries:
        try:
            cameras.append(Camera(**entry))
        except (TypeError, ValueError):
            logger.exception("skipping a malformed camera entry in %s: %r", CAMERAS_FILE, entry)
    return tuple(cameras)


class CameraTile(BaseModel):
    id: str
    label: str
    site: str
    lat: float
    lon: float
    # Every camera is a recording; a live source waits for a feed that qualifies.
    kind: Literal["replay"]
    # "live" means the camera is working, whatever its kind. Offline is the Node being Mesh-only;
    # Unavailable is anything else that stops this Viewer getting the clip.
    state: Literal["live", "offline", "unavailable"]
    # The rest is only known for a working tile.
    credit: str | None = None
    illustrative: str | None = None
    flood_onset_s: float | None = None
    length_s: float | None = None
    # Event time (Unix seconds) at which the clip's first frame plays.
    event_start_t: int | None = None


@dataclass(frozen=True)
class ClipFiles:
    video: Path
    poster: Path


class ClipEntry(BaseModel):
    """What this Node needs of one clip's entry in the manifest beside the clip files."""

    file: str
    poster: str
    length_s: float
    flood_onset_s: float | None = None
    illustrative: str
    credit: str


class Cameras:
    """The Hub's recorded cameras. Only the Hub holds the clips; a Sensor Node has none to serve."""

    def __init__(self, clips_dir: Path, role: Role, event_start_t: int) -> None:
        self._cameras = load_cameras()
        self._clips_dir = clips_dir
        self._role = role
        self._event_start_t = event_start_t
        if role == "hub":
            for camera in self._cameras:
                if self._playable(camera) is None:
                    logger.warning(
                        "camera %s has no usable clip (%s) in %s", camera.id, camera.clip, clips_dir
                    )

    def tiles(self, status: Status) -> list[CameraTile]:
        return [self._tile(camera, status) for camera in self._cameras]

    def knows(self, camera_id: str) -> bool:
        return any(camera.id == camera_id for camera in self._cameras)

    def clip_files(self, camera_id: str, status: Status) -> ClipFiles | None:
        """None when there is nothing to serve: a Sensor, a Mesh-only Node or a missing clip."""
        camera = next((camera for camera in self._cameras if camera.id == camera_id), None)
        if camera is None or status == "mesh_only":
            return None
        playable = self._playable(camera)
        return playable[0] if playable else None

    def _tile(self, camera: Camera, status: Status) -> CameraTile:
        if status == "mesh_only":
            return self._tile_without_clip(camera, "offline")
        playable = self._playable(camera)
        if playable is None:
            return self._tile_without_clip(camera, "unavailable")
        _, entry = playable
        return CameraTile(
            id=camera.id,
            label=camera.label,
            site=camera.site,
            lat=camera.lat,
            lon=camera.lon,
            kind="replay",
            state="live",
            credit=entry.credit,
            illustrative=entry.illustrative,
            flood_onset_s=entry.flood_onset_s,
            length_s=entry.length_s,
            event_start_t=self._event_start_t,
        )

    @staticmethod
    def _tile_without_clip(camera: Camera, state: Literal["offline", "unavailable"]) -> CameraTile:
        return CameraTile(
            id=camera.id,
            label=camera.label,
            site=camera.site,
            lat=camera.lat,
            lon=camera.lon,
            kind="replay",
            state=state,
        )

    def _playable(self, camera: Camera) -> tuple[ClipFiles, ClipEntry] | None:
        """The clip's files and manifest entry, or None if this Node cannot play it."""
        if self._role != "hub":
            return None
        entry = self._clip_entry(camera)
        if entry is None:
            return None
        files = ClipFiles(self._clips_dir / entry.file, self._clips_dir / entry.poster)
        return (files, entry) if files.video.is_file() and files.poster.is_file() else None

    def _clip_entry(self, camera: Camera) -> ClipEntry | None:
        if camera.clip is None:
            return None
        try:
            manifest = json.loads((self._clips_dir / MANIFEST_FILE).read_text())
            clip = manifest["clips"][camera.clip]
            credits = sorted(
                {clip["sources"][piece["source"]]["credit"] for piece in clip["pieces"]}
            )
            return ClipEntry(**clip, credit="; ".join(credits))
        except (OSError, KeyError, TypeError, ValueError):
            return None
