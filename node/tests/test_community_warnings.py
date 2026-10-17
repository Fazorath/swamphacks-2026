from typing import Any

from fastapi.testclient import TestClient
from meshed_nodes import MeshedNodes

from storm_shield.community_warning import CommunityWarning

S0_RIVER_KM = -12.2


def _warnings_shown_on(client: TestClient) -> list[dict[str, Any]]:
    return client.get("/api/state").json()["community_warnings"]  # type: ignore[no-any-return]


def _warning_log(meshed_nodes: MeshedNodes) -> list[dict[str, Any]]:
    return meshed_nodes["hub"].get("/api/warnings").json()["warnings"]  # type: ignore[no-any-return]


def _register(meshed_nodes: MeshedNodes, node: str) -> None:
    meshed_nodes.announce_sign_up(node, node)
    assert meshed_nodes["hub"].post("/api/registry/accept", json={"id": node}).status_code == 200


def _surge(meshed_nodes: MeshedNodes, node: str, river_km: float | None = S0_RIVER_KM) -> None:
    meshed_nodes.hear_from(node, water_cm=20, river_km=river_km)
    meshed_nodes.advance(8)
    meshed_nodes.hear_from(node, water_cm=340, river_km=river_km)


def test_a_registered_nodes_surge_makes_the_hub_send_one_warning_every_node_shows(
    meshed_nodes: MeshedNodes,
) -> None:
    meshed_nodes.start_hub()
    meshed_nodes.start("porch")
    _register(meshed_nodes, "s0")

    _surge(meshed_nodes, "s0")

    expected = {
        "kind": "warning",
        "nodes": ["s0"],
        "reasons": ["water_surge"],
        "origin": "s0",
        "origin_km": S0_RIVER_KM,
    }
    for client in (meshed_nodes["porch"], meshed_nodes["hub"]):
        shown = _warnings_shown_on(client)
        assert len(shown) == 1
        assert expected.items() <= shown[0].items()
    assert len(_warning_log(meshed_nodes)) == 1


def test_the_warning_carries_the_event_time_of_the_surge(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start_hub()
    _register(meshed_nodes, "s0")
    meshed_nodes["hub"].post("/api/replay/start")

    _surge(meshed_nodes, "s0")

    event_t = meshed_nodes["hub"].get("/api/replay").json()["event_t"]
    assert _warning_log(meshed_nodes)[0]["surge_t"] == event_t


def test_an_unverified_nodes_surge_makes_no_warning(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start_hub()
    meshed_nodes.start("porch")

    _surge(meshed_nodes, "stranger")

    assert _warning_log(meshed_nodes) == []
    assert _warnings_shown_on(meshed_nodes["porch"]) == []


def test_a_surging_node_with_no_river_km_makes_no_warning(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start_hub()
    _register(meshed_nodes, "s0")

    _surge(meshed_nodes, "s0", river_km=None)

    assert _warning_log(meshed_nodes) == []


def test_no_second_warning_while_the_same_surge_holds(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start_hub()
    _register(meshed_nodes, "s0")
    _surge(meshed_nodes, "s0")

    meshed_nodes.advance(10)
    meshed_nodes.hear_from("s0", water_cm=350, river_km=S0_RIVER_KM)
    meshed_nodes.advance(10)
    meshed_nodes.hear_from("s0", water_cm=360, river_km=S0_RIVER_KM)

    assert len(_warning_log(meshed_nodes)) == 1


def test_a_new_surge_after_the_first_has_passed_makes_a_new_warning(
    meshed_nodes: MeshedNodes,
) -> None:
    meshed_nodes.start_hub()
    _register(meshed_nodes, "s0")
    _surge(meshed_nodes, "s0")
    meshed_nodes.advance(200)
    meshed_nodes.hear_from("s0", water_cm=20, river_km=S0_RIVER_KM)

    _surge(meshed_nodes, "s0")

    log = _warning_log(meshed_nodes)
    assert len(log) == 2
    assert log[0]["id"] > log[1]["id"]


def test_two_nodes_surging_make_one_warning_each(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start_hub()
    _register(meshed_nodes, "s0")
    _register(meshed_nodes, "s1")

    _surge(meshed_nodes, "s0", river_km=-12.2)
    _surge(meshed_nodes, "s1", river_km=3.6)

    assert sorted(w["origin"] for w in _warning_log(meshed_nodes)) == ["s0", "s1"]


def test_a_warning_not_sent_by_the_hub_is_not_shown(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("porch")
    forged = CommunityWarning(
        id=1,
        t=1,
        nodes=["s0"],
        reasons=["water_surge"],
        origin="s0",
        origin_km=S0_RIVER_KM,
        surge_t=1,
    )

    meshed_nodes.announce_community_warning(forged, sender="rogue")

    assert _warnings_shown_on(meshed_nodes["porch"]) == []


def test_a_replay_reset_hides_a_warning_the_replay_has_not_reached_again(
    meshed_nodes: MeshedNodes,
) -> None:
    meshed_nodes.start_hub()
    meshed_nodes.start("porch")
    _register(meshed_nodes, "s0")
    meshed_nodes["hub"].post("/api/replay/start")
    _surge(meshed_nodes, "s0")
    assert len(_warnings_shown_on(meshed_nodes["porch"])) == 1

    meshed_nodes["hub"].post("/api/replay/reset")

    assert _warnings_shown_on(meshed_nodes["porch"]) == []
    assert len(_warning_log(meshed_nodes)) == 1


def test_a_sensor_has_no_warning_log(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("porch")
    assert meshed_nodes["porch"].get("/api/warnings").status_code == 404
