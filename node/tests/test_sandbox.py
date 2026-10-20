import tempfile
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient
from fixture_pack import build_fixture_pack
from meshed_nodes import MeshedNodes

from storm_shield.sandbox import (
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
