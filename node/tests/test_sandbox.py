import tempfile
import time
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient
from fixture_pack import build_fixture_pack
from meshed_nodes import MeshedNodes

from storm_shield.community_reading import CommunityReading, Measurement, Position
from storm_shield.sandbox import (
    HUB_SITE,
    SENSOR_SITES,
    Sandbox,
    SandboxError,
    download_pack_if_missing,
)


@pytest.fixture
def pack(tmp_path: Path) -> Path:
    path = tmp_path / "cache-pack.zip"
    path.write_bytes(build_fixture_pack())
    return path


@pytest.fixture
def scratch(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Where the Sandbox's temporary folder goes, so a test can see it was removed."""
    scratch = tmp_path / "scratch"
    scratch.mkdir()
    monkeypatch.setattr(tempfile, "tempdir", str(scratch))
    return scratch


def test_every_sensor_is_registered_and_its_reading_is_in_the_hubs_state(
    pack: Path, scratch: Path
) -> None:
    with Sandbox(pack) as sandbox:
        state = TestClient(sandbox.hub).get("/api/state").json()

    assert state["sandbox"] == {"label": "SIMULATED"}
    nodes = {node["id"]: node for node in state["nodes"]}
    for site in SENSOR_SITES:
        assert nodes[site.name]["registered"] is True
        assert nodes[site.name]["simulated"] is True
        assert set(nodes[site.name]["measurements"]) == {
            "water_level",
            "rain_rate",
            "soil_moisture",
            "air_pressure",
        }


def test_the_temporary_folder_is_removed_on_exit_even_after_an_error(
    pack: Path, scratch: Path
) -> None:
    with pytest.raises(KeyboardInterrupt), Sandbox(pack):
        assert list(scratch.iterdir())
        raise KeyboardInterrupt
    assert list(scratch.iterdir()) == []


def test_a_missing_pack_says_how_to_get_it(tmp_path: Path) -> None:
    with pytest.raises(SandboxError, match="no Cache Pack at"):
        Sandbox(tmp_path / "missing.zip")


def test_a_damaged_pack_is_named_and_leaves_no_folder_behind(tmp_path: Path, scratch: Path) -> None:
    damaged = tmp_path / "damaged.zip"
    damaged.write_bytes(b"not a zip")
    with (
        pytest.raises(SandboxError, match="damaged.zip is not a usable Cache Pack"),
        Sandbox(damaged),
    ):
        pass
    assert list(scratch.iterdir()) == []


def test_a_node_outside_the_sandbox_reports_no_sandbox(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("porch")
    assert meshed_nodes["porch"].get("/api/state").json()["sandbox"] is None


def test_a_missing_pack_is_downloaded_once(tmp_path: Path) -> None:
    requests: list[httpx.Request] = []

    def release(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, content=b"the pack")

    pack = tmp_path / "pack" / "cache-pack.zip"
    with httpx.Client(transport=httpx.MockTransport(release)) as client:
        download_pack_if_missing(pack, client)
        download_pack_if_missing(pack, client)

    assert pack.read_bytes() == b"the pack"
    assert len(requests) == 1
    assert not pack.with_name("cache-pack.zip.part").exists()


def test_a_failed_download_says_so_and_keeps_nothing(tmp_path: Path) -> None:
    def offline(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("no network", request=request)

    pack = tmp_path / "cache-pack.zip"
    with (
        httpx.Client(transport=httpx.MockTransport(offline)) as client,
        pytest.raises(SandboxError, match="could not download the Cache Pack"),
    ):
        download_pack_if_missing(pack, client)
    assert not pack.exists()


def _nodes(sandbox: Sandbox) -> dict[str, dict[str, Any]]:
    answer = TestClient(sandbox.hub).get("/api/sandbox/nodes").json()
    return {node["id"]: node for node in answer["nodes"]}


def _set_radio_range(sandbox: Sandbox, metres: float) -> dict[str, Any]:
    response = TestClient(sandbox.hub).post(
        "/api/sandbox/radio-range", json={"radio_range_m": metres}
    )
    assert response.status_code == 200
    return response.json()  # type: ignore[no-any-return]


def _surge_at(sandbox: Sandbox, sender: str, river_km: float) -> None:
    """Have a registered Sensor's reading jump 3.2 m in 8 s, which makes the Hub warn."""
    now = int(time.time())
    for seq, (taken_at, water_m) in enumerate([(now - 8, 0.2), (now, 3.4)], start=1_000_000):
        sandbox.network.deliver(
            sender,
            CommunityReading(
                node=sender,
                seq=seq,
                t=taken_at,
                sim=True,
                pos=Position(27.9, 85.1),
                river_km=river_km,
                m=[Measurement("water_level", water_m, "m")],
            ),
        )


def test_the_node_list_gives_each_nodes_position_links_and_hops_to_the_hub(
    pack: Path, scratch: Path
) -> None:
    with Sandbox(pack) as sandbox:
        # The Hub is 7.0 km from s3 and 25.9 km from s2; s1 (35.8 km) and s0 (49.3 km) are out of
        # its own reach, and both are within 30 km of s2.
        _set_radio_range(sandbox, 30_000)
        nodes = _nodes(sandbox)

    assert nodes["hub"]["role"] == "hub"
    assert nodes["hub"]["position"] == [HUB_SITE.latitude, HUB_SITE.longitude]
    assert {name: node["hops"] for name, node in nodes.items()} == {
        "hub": 0,
        "s3": 1,
        "s2": 1,
        "s1": 2,
        "s0": 2,
    }
    assert set(nodes["s2"]["links"]) == {"hub", "s0", "s1"}


def test_setting_the_radio_range_answers_with_the_new_picture(pack: Path, scratch: Path) -> None:
    with Sandbox(pack) as sandbox:
        answer = _set_radio_range(sandbox, 10_000)

    assert answer["radio_range_m"] == 10_000
    hops = {node["id"]: node["hops"] for node in answer["nodes"]}
    assert hops == {"hub": 0, "s3": 1, "s2": None, "s1": None, "s0": None}


def test_a_range_of_nothing_is_refused(pack: Path, scratch: Path) -> None:
    with Sandbox(pack) as sandbox:
        response = TestClient(sandbox.hub).post(
            "/api/sandbox/radio-range", json={"radio_range_m": 0}
        )

    assert response.status_code == 422


def test_a_node_with_no_path_to_the_hub_has_not_heard_the_warning(
    pack: Path, scratch: Path
) -> None:
    with Sandbox(pack) as sandbox:
        _set_radio_range(sandbox, 10_000)
        assert not any(node["heard_warning"] for node in _nodes(sandbox).values())

        _surge_at(sandbox, "s3", river_km=54.0)
        nodes = _nodes(sandbox)

    assert nodes["hub"]["heard_warning"] is True
    assert nodes["s3"]["heard_warning"] is True
    for cut_off in ("s2", "s1", "s0"):
        assert nodes[cut_off]["hops"] is None
        assert nodes[cut_off]["heard_warning"] is False
