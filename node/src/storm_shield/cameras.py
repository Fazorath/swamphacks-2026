import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel

from storm_shield.internet_connection import Status
from storm_shield.settings import Role

logger = logging.getLogger(__name__)

MANIFEST_FILE = "manifest.json"


@dataclass(frozen=True)
class Camera:
    id: str
    label: str
    # The clip's key in the manifest beside the clip files (scripts/make_camera_clips.py).
    clip: str


# No live Nepal camera or free API turned up (docs/research/nepal-cameras.md), so the Hub's camera
# plays a recording. Tickets 0075 and 0077 grow this into a list.
CAMERAS = (Camera("hub-betrawati", "Betrawati", "clip-1-calm-then-surge"),)


class CameraTile(BaseModel):
    id: str
    label: str
    # Every camera is a recording for now; a live source arrives with 0075.
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


class Cameras:
    """The Hub's recorded cameras. Only the Hub holds the clips; a Sensor Node has none to serve."""

    def __init__(self, clips_dir: Path, role: Role, event_start_t: int) -> None:
        self._clips_dir = clips_dir
        self._role = role
        self._event_start_t = event_start_t
        if role == "hub":
            for camera in CAMERAS:
                if self.clip_files(camera.id, "online") is None:
                    logger.warning("camera %s has no clip in %s", camera.id, clips_dir)

    def tiles(self, status: Status) -> list[CameraTile]:
        return [self._tile(camera, status) for camera in CAMERAS]

    def knows(self, camera_id: str) -> bool:
        return any(camera.id == camera_id for camera in CAMERAS)

    def clip_files(self, camera_id: str, status: Status) -> ClipFiles | None:
        """None when there is nothing to serve: a Sensor, a Mesh-only Node or a missing clip."""
        camera = next((camera for camera in CAMERAS if camera.id == camera_id), None)
        if camera is None or self._role != "hub" or status == "mesh_only":
            return None
        entry = self._manifest_entry(camera)
        if entry is None:
            return None
        files = ClipFiles(self._clips_dir / entry["file"], self._clips_dir / entry["poster"])
        return files if files.video.is_file() and files.poster.is_file() else None

    def _tile(self, camera: Camera, status: Status) -> CameraTile:
        if status == "mesh_only":
            return CameraTile(id=camera.id, label=camera.label, kind="replay", state="offline")
        entry = self._manifest_entry(camera)
        if self.clip_files(camera.id, status) is None or entry is None:
            return CameraTile(id=camera.id, label=camera.label, kind="replay", state="unavailable")
        sources = entry["sources"]
        credits = sorted({sources[piece["source"]]["credit"] for piece in entry["pieces"]})
        return CameraTile(
            id=camera.id,
            label=camera.label,
            kind="replay",
            state="live",
            credit="; ".join(credits),
            illustrative=entry["illustrative"],
            flood_onset_s=entry["flood_onset_s"],
            length_s=entry["length_s"],
            event_start_t=self._event_start_t,
        )

    def _manifest_entry(self, camera: Camera) -> dict[str, Any] | None:
        try:
            manifest = json.loads((self._clips_dir / MANIFEST_FILE).read_text())
            entry: dict[str, Any] = manifest["clips"][camera.clip]
            return entry
        except (OSError, KeyError, ValueError):
            return None
