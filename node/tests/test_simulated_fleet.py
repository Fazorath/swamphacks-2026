from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient
from fixture_pack import build_fixture_pack
from meshed_nodes import MeshedNodes

# 08:30 NPT on 26 Aug 2026, the first moment of the replay timeline.
REPLAY_START = 1787712300
STEP = 30
RATE = 30
UNITS = {"water_level": "cm", "rain_rate": "mm/h", "soil_moisture": "%", "pressure": "hPa"}


def _track(water: list[float]) -> dict[str, list[float]]:
    return {
        "water_level": water,
        "rain_rate": [0.5] * len(water),
        "soil_moisture": [40.0] * len(water),
        "pressure": [1012.0] * len(water),
    }


FLEET = {
    "source": "fixture",
    "credit": "fixture credit",
    "water_model": "fixture",
    "start_t": REPLAY_START,
    "step_s": STEP,
    "units": UNITS,
    "entries": [
        {
            "id": "fleet-zeta",
            "name": "Zeta",
            "river": "Karnali",
            "site": "headwater",
            "pos": [29.5, 82.1],
            "silent_at": None,
            "track": _track([80, 80, 80, 80, 80]),
        },
        {
            "id": "fleet-alpha",
            "name": "Alpha",
            "river": "Koshi",
            "site": "town",
            "pos": [26.8, 87.3],
            # A rise of 400 cm in a minute: a Surge, if anything counted it.
            "silent_at": REPLAY_START + 2 * STEP,
            "track": _track([100, 300, 500]),
        },
    ],
}


def _state(client: TestClient) -> dict[str, Any]:
    state: dict[str, Any] = client.get("/api/state").json()
    return state


def _start_hub_with_fleet(meshed_nodes: MeshedNodes, tmp_path: Path) -> None:
    meshed_nodes.start_hub(cache_pack=(tmp_path / "packs", build_fixture_pack(fleet=FLEET)))


def test_the_fleet_is_listed_by_id_at_its_calm_start_when_no_replay_is_heard(
    meshed_nodes: MeshedNodes, tmp_path: Path
) -> None:
    _start_hub_with_fleet(meshed_nodes, tmp_path)

    fleet = _state(meshed_nodes["hub"])["fleet"]

    assert [entry["id"] for entry in fleet] == ["fleet-alpha", "fleet-zeta"]
    alpha = fleet[0]
    assert alpha["name"] == "Alpha"
    assert alpha["river"] == "Koshi"
    assert alpha["site"] == "town"
    assert alpha["position"] == [26.8, 87.3]
    assert alpha["age_s"] == 0
    assert alpha["stale"] is False
    assert alpha["measurements"] == {
        "water_level": {"value": 100, "unit": "cm"},
        "rain_rate": {"value": 0.5, "unit": "mm/h"},
        "soil_moisture": {"value": 40, "unit": "%"},
        "pressure": {"value": 1012, "unit": "hPa"},
    }


def test_every_node_that_holds_the_pack_serves_the_fleet_at_its_event_clock(
    meshed_nodes: MeshedNodes, tmp_path: Path
) -> None:
    pack = (tmp_path / "packs", build_fixture_pack(fleet=FLEET))
    meshed_nodes.start("porch", cache_pack=pack)
    meshed_nodes.announce_replay("playing", REPLAY_START + STEP + 10)

    alpha = _state(meshed_nodes["porch"])["fleet"][0]

    assert alpha["measurements"]["water_level"]["value"] == 300
    assert alpha["age_s"] == 10 / RATE


def test_the_silent_site_keeps_its_last_point_and_turns_stale_15_seconds_after_it_went_quiet(
    meshed_nodes: MeshedNodes, tmp_path: Path
) -> None:
    meshed_nodes.start("porch", cache_pack=(tmp_path / "packs", build_fixture_pack(fleet=FLEET)))
    silent_at = REPLAY_START + 2 * STEP

    meshed_nodes.announce_replay("playing", silent_at + 15 * RATE)
    alpha = _state(meshed_nodes["porch"])["fleet"][0]
    assert alpha["stale"] is False
    assert alpha["age_s"] == 15

    meshed_nodes.announce_replay("playing", silent_at + 16 * RATE)
    alpha = _state(meshed_nodes["porch"])["fleet"][0]
    assert alpha["stale"] is True
    assert alpha["measurements"]["water_level"]["value"] == 500


def test_a_paused_event_clock_freezes_the_fleets_age(
    meshed_nodes: MeshedNodes, tmp_path: Path
) -> None:
    meshed_nodes.start("porch", cache_pack=(tmp_path / "packs", build_fixture_pack(fleet=FLEET)))
    meshed_nodes.announce_replay("paused", REPLAY_START + 20 * RATE)
    first = _state(meshed_nodes["porch"])["fleet"][0]["age_s"]

    meshed_nodes.advance(60)

    assert _state(meshed_nodes["porch"])["fleet"][0]["age_s"] == first


def test_a_pack_without_a_fleet_file_gives_an_empty_fleet(
    meshed_nodes: MeshedNodes, tmp_path: Path
) -> None:
    meshed_nodes.start("porch", cache_pack=(tmp_path / "packs", build_fixture_pack()))

    assert _state(meshed_nodes["porch"])["fleet"] == []


def test_a_node_with_no_pack_at_all_gives_an_empty_fleet(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("porch")

    assert _state(meshed_nodes["porch"])["fleet"] == []


def test_a_surging_fleet_site_changes_nothing_in_flood_risk_warnings_or_the_registry(
    meshed_nodes: MeshedNodes, tmp_path: Path
) -> None:
    _start_hub_with_fleet(meshed_nodes, tmp_path)
    meshed_nodes.start("porch")
    registry_before = meshed_nodes["hub"].get("/api/registry").json()

    assert meshed_nodes["hub"].post("/api/replay/start").status_code == 200
    assert meshed_nodes["hub"].post("/api/replay/jump", json={"phase": "end"}).status_code == 200
    hub = _state(meshed_nodes["hub"])

    assert hub["fleet"][0]["measurements"]["water_level"]["value"] == 500
    assert hub["flood_risk"]["surged"] == []
    assert "water_surge" not in [reason["code"] for reason in hub["flood_risk"]["reasons"]]
    # Strict counting: a fleet site is no registered Node, so Flood Risk never lists it.
    assert "fleet-alpha" not in hub["flood_risk"]["nodes"]
    assert hub["community_warnings"] == []
    assert meshed_nodes["hub"].get("/api/warnings").json() == {"warnings": []}
    # Nothing reached the Mesh: a peer lists neither the fleet nor a Node for it.
    peer = _state(meshed_nodes["porch"])
    assert "fleet-alpha" not in [node["id"] for node in peer["nodes"]]
    assert "fleet-alpha" not in [node["id"] for node in hub["nodes"]]

    accepted = meshed_nodes["hub"].post("/api/registry/accept", json={"id": "fleet-alpha"})
    assert accepted.status_code == 404
    assert meshed_nodes["hub"].get("/api/registry").json() == registry_before
