import time
from collections import Counter
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta

import httpx
from fastapi.testclient import TestClient

from storm_shield.cameras import CAMERAS
from storm_shield.main import create_app
from storm_shield.mesh import InMemoryNetwork
from storm_shield.settings import Settings

JPEG = b"\xff\xd8\xff fake camera picture"
BROKEN_CAMERA = CAMERAS[-1].id


class Outside:
    """The internet and the camera service, as fakes the tests switch on and off."""

    def __init__(self) -> None:
        self.internet_up = True
        self.failing_checks = 0
        self.broken_cameras: set[int] = set()
        self.picture_requests: Counter[int] = Counter()

    def internet_source(self) -> httpx.Client:
        return httpx.Client(transport=httpx.MockTransport(self._answer_check))

    def camera_source(self) -> httpx.Client:
        return httpx.Client(transport=httpx.MockTransport(self._answer_picture_request))

    def _answer_check(self, request: httpx.Request) -> httpx.Response:
        if self.failing_checks > 0:
            self.failing_checks -= 1
            raise httpx.ConnectError("one dropped packet")
        if not self.internet_up:
            raise httpx.ConnectError("no internet")
        return httpx.Response(204)

    def _answer_picture_request(self, request: httpx.Request) -> httpx.Response:
        camera_id = int(request.url.path.rsplit("/", 1)[1])
        self.picture_requests[camera_id] += 1
        if not self.internet_up:
            raise httpx.ConnectError("no internet")
        if camera_id in self.broken_cameras:
            return httpx.Response(500)
        return httpx.Response(200, content=JPEG, headers={"content-type": "image/jpeg"})


@contextmanager
def _running_node(
    outside: Outside,
    name: str = "porch",
    clock: Callable[[], datetime] = lambda: datetime.now(UTC),
) -> Iterator[TestClient]:
    settings = Settings(name=name, internet_check_seconds=0.01)
    app = create_app(
        settings,
        InMemoryNetwork().join(name),
        clock=clock,
        internet_source=outside.internet_source(),
        camera_source=outside.camera_source(),
    )
    with TestClient(app) as client:
        yield client


def _wait_until(condition: Callable[[], bool], what: str) -> None:
    deadline = time.monotonic() + 3
    while time.monotonic() < deadline:
        if condition():
            return
        time.sleep(0.005)
    raise AssertionError(f"never saw: {what}")


def _status(client: TestClient) -> str:
    return str(client.get("/api/node").json()["status"])


def _tile_states(client: TestClient) -> dict[int, str]:
    return {tile["id"]: tile["state"] for tile in client.get("/api/cameras").json()}


def _all_tiles_are(client: TestClient, state: str) -> bool:
    return set(_tile_states(client).values()) == {state}


def test_a_node_that_can_reach_the_internet_is_online() -> None:
    with _running_node(Outside()) as client:
        _wait_until(lambda: _status(client) == "online", "the Node to report online")


def test_a_node_is_mesh_only_when_the_internet_drops_and_online_when_it_returns() -> None:
    outside = Outside()
    with _running_node(outside) as client:
        _wait_until(lambda: _status(client) == "online", "the Node to report online")
        outside.internet_up = False
        _wait_until(lambda: _status(client) == "mesh_only", "the Node to report mesh_only")
        outside.internet_up = True
        _wait_until(lambda: _status(client) == "online", "the Node to report online again")


def test_one_dropped_check_does_not_make_a_node_mesh_only() -> None:
    outside = Outside()
    with _running_node(outside) as client:
        _wait_until(lambda: _status(client) == "online", "the Node to report online")
        outside.failing_checks = 1
        deadline = time.monotonic() + 0.3
        while time.monotonic() < deadline:
            assert _status(client) == "online"
            time.sleep(0.001)
        assert outside.failing_checks == 0


def test_a_node_does_not_take_its_status_from_another_node() -> None:
    cut_off, connected = Outside(), Outside()
    with _running_node(cut_off, "garage") as garage, _running_node(connected, "porch") as porch:
        _wait_until(lambda: _status(garage) == "online", "garage online")
        _wait_until(lambda: _status(porch) == "online", "porch online")
        cut_off.internet_up = False
        _wait_until(lambda: _status(garage) == "mesh_only", "garage mesh_only")
        assert _status(porch) == "online"


def test_camera_tiles_are_live_and_serve_a_picture_while_online() -> None:
    with _running_node(Outside()) as client:
        _wait_until(lambda: _all_tiles_are(client, "live"), "every camera tile to be live")
        tiles = client.get("/api/cameras").json()
        assert [tile["label"] for tile in tiles] == [camera.label for camera in CAMERAS]
        assert all(0 <= tile["age_s"] < 5 for tile in tiles)
        picture = client.get(f"/api/cameras/{CAMERAS[0].id}.jpg")
        assert picture.status_code == 200
        assert picture.headers["content-type"] == "image/jpeg"
        assert picture.headers["cache-control"] == "no-store"
        assert picture.content == JPEG


def test_camera_tiles_go_offline_with_no_picture_when_the_node_is_mesh_only() -> None:
    outside = Outside()
    with _running_node(outside) as client:
        _wait_until(lambda: _all_tiles_are(client, "live"), "every camera tile to be live")
        outside.internet_up = False
        _wait_until(lambda: _status(client) == "mesh_only", "the Node to report mesh_only")
        assert _all_tiles_are(client, "offline")
        assert all(tile["taken_at"] is None for tile in client.get("/api/cameras").json())
        refused = client.get(f"/api/cameras/{CAMERAS[0].id}.jpg")
        assert refused.status_code == 503
        assert refused.headers["content-type"] != "image/jpeg"


def test_a_camera_that_fails_is_unavailable_and_the_others_stay_live() -> None:
    outside = Outside()
    outside.broken_cameras = {BROKEN_CAMERA}
    with _running_node(outside) as client:
        _wait_until(
            lambda: (
                _tile_states(client)
                == {camera.id: "live" for camera in CAMERAS} | {BROKEN_CAMERA: "unavailable"}
            ),
            "one unavailable tile and the rest live",
        )
        assert client.get(f"/api/cameras/{BROKEN_CAMERA}.jpg").status_code == 503


def test_an_unknown_camera_is_not_found() -> None:
    with _running_node(Outside()) as client:
        assert client.get("/api/cameras/1.jpg").status_code == 404


def test_each_camera_is_asked_for_a_picture_no_more_than_once_a_minute() -> None:
    outside = Outside()
    with _running_node(outside) as client:
        _wait_until(lambda: _all_tiles_are(client, "live"), "every camera tile to be live")
        time.sleep(0.2)
    assert set(outside.picture_requests.values()) == {1}


def test_a_picture_too_old_to_call_live_is_unavailable() -> None:
    outside = Outside()
    now = [datetime.now(UTC)]
    with _running_node(outside, clock=lambda: now[0]) as client:
        _wait_until(lambda: _all_tiles_are(client, "live"), "every camera tile to be live")
        outside.broken_cameras = {camera.id for camera in CAMERAS}
        now[0] += timedelta(minutes=4)
        _wait_until(lambda: _all_tiles_are(client, "unavailable"), "every tile to be unavailable")
        assert client.get(f"/api/cameras/{CAMERAS[0].id}.jpg").status_code == 503


def test_readings_and_flood_risk_keep_updating_while_the_node_is_mesh_only() -> None:
    outside = Outside()
    with _running_node(outside) as client:
        _wait_until(lambda: _status(client) == "online", "the Node to report online")
        outside.internet_up = False
        _wait_until(lambda: _status(client) == "mesh_only", "the Node to report mesh_only")
        before = {r["kind"]: r["value"] for r in client.get("/api/readings").json()}
        assert client.get("/api/flood-risk").json()["level"] is None
        for _ in range(3):
            client.post("/api/scenario/step")
        after = {r["kind"]: r["value"] for r in client.get("/api/readings").json()}
        assert after["pressure"] < before["pressure"] - 5
        assert client.get("/api/flood-risk").json()["level"] is not None


def test_a_viewer_cannot_change_a_nodes_connection_state_or_cameras() -> None:
    with _running_node(Outside()) as client:
        for path in ("/api/node", "/api/cameras", f"/api/cameras/{CAMERAS[0].id}.jpg"):
            for send in (client.post, client.put, client.delete):
                assert send(path).status_code == 405
