import json
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from storm_shield.main import create_app
from storm_shield.mesh import InMemoryNetwork
from storm_shield.replay import load_timeline
from storm_shield.settings import Role, Settings

VIDEO = bytes(range(256)) * 4
POSTER = b"\xff\xd8\xff fake poster"
CLIP_ENTRY = {
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
CLIP_KEYS = (
    "clip-1-calm-then-surge",
    "clip-2-extreme-debris-over-road",
    "clip-3-rise-below-flooding",
)
MANIFEST = {"clips": {key: CLIP_ENTRY for key in CLIP_KEYS}}


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


def _tile(client: TestClient, camera_id: str = "hub-betrawati") -> dict[str, Any]:
    [tile] = [tile for tile in client.get("/api/cameras").json() if tile["id"] == camera_id]
    return dict(tile)


def _state_of_the_tile(client: TestClient, camera_id: str = "hub-betrawati") -> str:
    return str(_tile(client, camera_id)["state"])


def test_the_hub_camera_is_a_replay_with_its_credit_and_onset(tmp_path: Path) -> None:
    with _node(_clips_folder(tmp_path / "clips"), Internet()) as client:
        _wait_until(lambda: _state_of_the_tile(client) == "live", "the camera to be live")
        tile = _tile(client)
        assert tile == {
            "id": "hub-betrawati",
            "label": "Betrawati",
            "site": "hub",
            "lat": 27.9731,
            "lon": 85.186,
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
        tile = _tile(client)
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
        tile = _tile(client)
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
        assert all(tile["state"] == "unavailable" for tile in client.get("/api/cameras").json())
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


def test_the_hub_lists_a_camera_at_each_site_with_its_clip(tmp_path: Path) -> None:
    with _node(_clips_folder(tmp_path / "clips"), Internet()) as client:
        _wait_until(lambda: _state_of_the_tile(client) == "live", "the camera to be live")
        sites = {tile["id"]: tile["site"] for tile in client.get("/api/cameras").json()}
        assert sites == {
            "hub-betrawati": "hub",
            "s1-timure": "s1",
            "s2-syabrubesi": "s2",
            "s3-trishuli": "s3",
        }
        assert all(_state_of_the_tile(client, camera_id) == "live" for camera_id in sites)
        part = client.get("/api/cameras/s2-syabrubesi/clip", headers={"Range": "bytes=10-19"})
        assert part.status_code == 206
        assert part.content == VIDEO[10:20]


def test_a_camera_with_no_clip_or_an_unknown_clip_warns_and_the_hub_still_starts(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    cameras = tmp_path / "cameras.json"
    cameras.write_text(
        json.dumps(
            [
                {
                    "id": "good",
                    "label": "Good",
                    "site": "hub",
                    "lat": 1,
                    "lon": 2,
                    "clip": CLIP_KEYS[0],
                },
                {"id": "no-clip", "label": "No clip", "site": "s1", "lat": 1, "lon": 2},
                {
                    "id": "unknown",
                    "label": "Unknown",
                    "site": "s2",
                    "lat": 1,
                    "lon": 2,
                    "clip": "nope",
                },
            ]
        )
    )
    monkeypatch.setattr("storm_shield.cameras.CAMERAS_FILE", cameras)
    with caplog.at_level("WARNING"), _node(_clips_folder(tmp_path / "clips"), Internet()) as client:
        _wait_until(lambda: _state_of_the_tile(client, "good") == "live", "the good camera")
        assert _state_of_the_tile(client, "no-clip") == "unavailable"
        assert _state_of_the_tile(client, "unknown") == "unavailable"
    warned = " ".join(record.getMessage() for record in caplog.records)
    assert "no-clip" in warned and "unknown" in warned and "good" not in warned


def test_an_unreadable_camera_list_leaves_the_hub_with_no_cameras(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    cameras = tmp_path / "cameras.json"
    cameras.write_text("not json")
    monkeypatch.setattr("storm_shield.cameras.CAMERAS_FILE", cameras)
    with _node(_clips_folder(tmp_path / "clips"), Internet()) as client:
        assert client.get("/api/cameras").json() == []


def test_a_malformed_camera_entry_is_skipped_and_the_others_still_work(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    cameras = tmp_path / "cameras.json"
    good = {"id": "good", "label": "Good", "site": "hub", "lat": 1, "lon": 2, "clip": CLIP_KEYS[0]}
    cameras.write_text(json.dumps([{"id": "no-position"}, good]))
    monkeypatch.setattr("storm_shield.cameras.CAMERAS_FILE", cameras)
    with _node(_clips_folder(tmp_path / "clips"), Internet()) as client:
        _wait_until(lambda: _state_of_the_tile(client, "good") == "live", "the good camera")
        assert [tile["id"] for tile in client.get("/api/cameras").json()] == ["good"]


def test_a_clip_file_missing_beside_a_manifest_makes_only_that_camera_unavailable(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    clips = _clips_folder(tmp_path / "clips")
    manifest = json.loads((clips / "manifest.json").read_text())
    manifest["clips"][CLIP_KEYS[2]] = {**CLIP_ENTRY, "file": "gone.mp4"}
    (clips / "manifest.json").write_text(json.dumps(manifest))
    with caplog.at_level("WARNING"), _node(clips, Internet()) as client:
        _wait_until(lambda: _state_of_the_tile(client) == "live", "the camera to be live")
        assert _state_of_the_tile(client, "s1-timure") == "unavailable"
        assert _state_of_the_tile(client, "s2-syabrubesi") == "live"
    assert "s1-timure" in caplog.text


def test_every_camera_goes_offline_on_a_mesh_only_hub_and_a_sensor_serves_none(
    tmp_path: Path,
) -> None:
    internet = Internet()
    clips = _clips_folder(tmp_path / "clips")
    with _node(clips, internet) as hub:
        _wait_until(lambda: _state_of_the_tile(hub) == "live", "the camera to be live")
        internet.up = False
        _wait_until(lambda: _state_of_the_tile(hub) == "offline", "the camera to be offline")
        assert {tile["state"] for tile in hub.get("/api/cameras").json()} == {"offline"}
    with _node(_clips_folder(tmp_path / "sensor-clips"), Internet(), role="sensor") as sensor:
        time.sleep(0.1)
        for tile in sensor.get("/api/cameras").json():
            assert tile["state"] == "unavailable"
            assert sensor.get(f"/api/cameras/{tile['id']}/clip").status_code == 404
