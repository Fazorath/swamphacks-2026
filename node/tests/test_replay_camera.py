import json
import time
from collections.abc import Callable
from pathlib import Path

import httpx
from fastapi.testclient import TestClient

from storm_shield.main import create_app
from storm_shield.mesh import InMemoryNetwork
from storm_shield.replay import load_timeline
from storm_shield.settings import Role, Settings

VIDEO = bytes(range(256)) * 4
POSTER = b"\xff\xd8\xff fake poster"
MANIFEST = {
    "clips": {
        "clip-1-calm-then-surge": {
            "file": "story.mp4",
            "poster": "story.jpg",
            "length_s": 300.0,
            "flood_onset_s": 193.0,
            "illustrative": "Illustrative footage, not filmed at this site.",
            "pieces": [{"source": "river"}, {"source": "creek"}, {"source": "river"}],
            "sources": {
                "river": {"credit": "River Credit"},
                "creek": {"credit": "Creek Credit"},
            },
        }
    }
}


def _clips_folder(folder: Path) -> Path:
    folder.mkdir()
    (folder / "story.mp4").write_bytes(VIDEO)
    (folder / "story.jpg").write_bytes(POSTER)
    (folder / "manifest.json").write_text(json.dumps(MANIFEST))
    return folder


class Internet:
    def __init__(self) -> None:
        self.up = True

    def source(self) -> httpx.Client:
        return httpx.Client(transport=httpx.MockTransport(self._answer))

    def _answer(self, request: httpx.Request) -> httpx.Response:
        if not self.up:
            raise httpx.ConnectError("no internet")
        return httpx.Response(204)


def _node(clips: Path, internet: Internet, role: Role = "hub") -> TestClient:
    settings = Settings(
        name="hub-1", role=role, internet_check_seconds=0.01, camera_clips_dir=clips
    )
    app = create_app(
        settings, InMemoryNetwork().join("hub-1", "hub"), internet_source=internet.source()
    )
    return TestClient(app)


def _wait_until(condition: Callable[[], bool], what: str) -> None:
    deadline = time.monotonic() + 3
    while time.monotonic() < deadline:
        if condition():
            return
        time.sleep(0.005)
    raise AssertionError(f"never saw: {what}")


def _state_of_the_tile(client: TestClient) -> str:
    [tile] = client.get("/api/cameras").json()
    return str(tile["state"])


def test_the_hub_camera_is_a_replay_with_its_credit_and_onset(tmp_path: Path) -> None:
    with _node(_clips_folder(tmp_path / "clips"), Internet()) as client:
        _wait_until(lambda: _state_of_the_tile(client) == "live", "the camera to be live")
        [tile] = client.get("/api/cameras").json()
        assert tile == {
            "id": "hub-betrawati",
            "label": "Betrawati",
            "kind": "replay",
            "state": "live",
            "credit": "Creek Credit; River Credit",
            "illustrative": "Illustrative footage, not filmed at this site.",
            "flood_onset_s": 193.0,
            "length_s": 300.0,
            "event_start_t": load_timeline().start_unix,
        }


def test_the_committed_clips_are_what_a_hub_serves_by_default() -> None:
    internet = Internet()
    settings = Settings(name="hub-1", role="hub", internet_check_seconds=0.01)
    app = create_app(
        settings, InMemoryNetwork().join("hub-1", "hub"), internet_source=internet.source()
    )
    with TestClient(app) as client:
        _wait_until(lambda: _state_of_the_tile(client) == "live", "the camera to be live")
        [tile] = client.get("/api/cameras").json()
        assert tile["flood_onset_s"] == 193.0
        assert client.get("/api/cameras/hub-betrawati/clip").headers["content-type"] == "video/mp4"


def test_the_hub_serves_the_clip_in_ranges_so_a_phone_can_seek(tmp_path: Path) -> None:
    with _node(_clips_folder(tmp_path / "clips"), Internet()) as client:
        _wait_until(lambda: _state_of_the_tile(client) == "live", "the camera to be live")
        whole = client.get("/api/cameras/hub-betrawati/clip")
        assert whole.status_code == 200
        assert whole.headers["content-type"] == "video/mp4"
        assert whole.content == VIDEO
        part = client.get("/api/cameras/hub-betrawati/clip", headers={"Range": "bytes=10-19"})
        assert part.status_code == 206
        assert part.content == VIDEO[10:20]
        poster = client.get("/api/cameras/hub-betrawati/poster")
        assert poster.content == POSTER


def test_a_mesh_only_hub_camera_is_offline_and_serves_no_clip(tmp_path: Path) -> None:
    internet = Internet()
    with _node(_clips_folder(tmp_path / "clips"), internet) as client:
        _wait_until(lambda: _state_of_the_tile(client) == "live", "the camera to be live")
        internet.up = False
        _wait_until(lambda: _state_of_the_tile(client) == "offline", "the camera to be offline")
        [tile] = client.get("/api/cameras").json()
        assert tile["credit"] is None
        assert client.get("/api/cameras/hub-betrawati/clip").status_code == 404
        assert client.get("/api/cameras/hub-betrawati/poster").status_code == 404
        internet.up = True
        _wait_until(lambda: _state_of_the_tile(client) == "live", "the camera to be live again")


def test_a_camera_with_a_missing_clip_is_unavailable_not_offline(tmp_path: Path) -> None:
    empty = tmp_path / "empty"
    empty.mkdir()
    with _node(empty, Internet()) as client:
        time.sleep(0.1)
        assert _state_of_the_tile(client) == "unavailable"
        assert client.get("/api/cameras/hub-betrawati/clip").status_code == 404


def test_a_sensor_node_has_no_clip_so_its_viewer_sees_unavailable(tmp_path: Path) -> None:
    with _node(_clips_folder(tmp_path / "clips"), Internet(), role="sensor") as client:
        time.sleep(0.1)
        assert _state_of_the_tile(client) == "unavailable"
        assert client.get("/api/cameras/hub-betrawati/clip").status_code == 404


def test_an_unknown_camera_is_not_found(tmp_path: Path) -> None:
    with _node(_clips_folder(tmp_path / "clips"), Internet()) as client:
        assert client.get("/api/cameras/nowhere/clip").status_code == 404
        assert client.get("/api/cameras/nowhere/poster").status_code == 404


def test_a_viewer_cannot_change_the_cameras(tmp_path: Path) -> None:
    with _node(_clips_folder(tmp_path / "clips"), Internet()) as client:
        for path in ("/api/cameras", "/api/cameras/hub-betrawati/clip"):
            for send in (client.post, client.put, client.delete):
                assert send(path).status_code == 405


def test_a_manifest_entry_missing_a_field_makes_the_camera_unavailable(tmp_path: Path) -> None:
    clips = _clips_folder(tmp_path / "clips")
    broken = json.loads((clips / "manifest.json").read_text())
    del broken["clips"]["clip-1-calm-then-surge"]["illustrative"]
    (clips / "manifest.json").write_text(json.dumps(broken))
    with _node(clips, Internet()) as client:
        time.sleep(0.1)
        assert _state_of_the_tile(client) == "unavailable"
