import time

import pytest
from fastapi.testclient import TestClient
from meshed_nodes import MeshedNodes


def _values_by_node_and_kind(client: TestClient) -> dict[tuple[str, str], float]:
    return {
        (entry["id"], kind): measurement["value"]
        for entry in client.get("/api/state").json()["nodes"]
        for kind, measurement in entry["measurements"].items()
    }


def test_each_node_lists_its_own_readings_and_the_others(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("porch", "garage", "creek")
    for name in ["porch", "garage", "creek"]:
        meshed_nodes[name].post("/api/scenario/reset")
    seen = {node for node, _ in _values_by_node_and_kind(meshed_nodes["porch"])}
    assert seen == {"porch", "garage", "creek"}


def test_a_reading_stepped_on_one_node_shows_up_on_another(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("porch", "garage")
    meshed_nodes["porch"].post("/api/scenario/reset")
    normal_day = _values_by_node_and_kind(meshed_nodes["garage"])[("porch", "pressure")]
    meshed_nodes["porch"].post("/api/scenario/step")
    assert _values_by_node_and_kind(meshed_nodes["garage"])[("porch", "pressure")] < normal_day - 5


def test_readings_from_other_nodes_are_aged_and_labeled_simulated(
    meshed_nodes: MeshedNodes,
) -> None:
    meshed_nodes.start("porch", "garage")
    meshed_nodes["porch"].post("/api/scenario/step")
    nodes = meshed_nodes["garage"].get("/api/state").json()["nodes"]
    [from_porch] = [entry for entry in nodes if entry["id"] == "porch"]
    assert from_porch["simulated"]
    assert from_porch["age_s"] >= 0


def test_removing_a_node_leaves_the_others_working(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("porch", "garage", "creek")
    meshed_nodes.remove("garage")
    meshed_nodes["porch"].post("/api/scenario/step")
    meshed_nodes["creek"].post("/api/scenario/step")
    meshed_nodes["creek"].post("/api/scenario/step")
    creek_as_seen_by_porch = _values_by_node_and_kind(meshed_nodes["porch"])
    porch_as_seen_by_creek = _values_by_node_and_kind(meshed_nodes["creek"])
    assert creek_as_seen_by_porch[("creek", "rain_rate")] > 5
    assert porch_as_seen_by_creek[("porch", "pressure")] < 1010


def test_positions_shared_between_nodes_are_fuzzed_to_about_200_metres(
    meshed_nodes: MeshedNodes,
) -> None:
    meshed_nodes.start("porch", "garage")
    meshed_nodes["porch"].post("/api/scenario/reset")
    nodes = meshed_nodes["garage"].get("/api/state").json()["nodes"]
    [from_porch] = [entry for entry in nodes if entry["id"] == "porch"]
    assert tuple(from_porch["position"]) == (29.652, -82.324)


def test_a_restarted_node_is_heard_again(
    meshed_nodes: MeshedNodes, monkeypatch: pytest.MonkeyPatch
) -> None:
    meshed_nodes.start("porch", "garage")
    meshed_nodes["porch"].post("/api/scenario/step")
    meshed_nodes.remove("porch")
    restarted_at = time.time() + 60
    monkeypatch.setattr(time, "time", lambda: restarted_at)
    meshed_nodes.start("porch")
    meshed_nodes["porch"].post("/api/scenario/reset")
    pressure = _values_by_node_and_kind(meshed_nodes["garage"])[("porch", "pressure")]
    assert pressure > 1010
