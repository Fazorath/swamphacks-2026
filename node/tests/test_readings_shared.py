import time

import pytest
from fastapi.testclient import TestClient
from meshed_nodes import MeshedNodes


def _values_by_node_and_kind(client: TestClient) -> dict[tuple[str, str], float]:
    return {
        (reading["node"], reading["kind"]): reading["value"]
        for reading in client.get("/api/readings").json()
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


def test_readings_from_other_nodes_are_timestamped_and_labeled_simulated(
    meshed_nodes: MeshedNodes,
) -> None:
    meshed_nodes.start("porch", "garage")
    meshed_nodes["porch"].post("/api/scenario/step")
    readings = meshed_nodes["garage"].get("/api/readings").json()
    from_porch = [reading for reading in readings if reading["node"] == "porch"]
    assert from_porch
    assert all(reading["simulated"] and reading["timestamp"] for reading in from_porch)


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
    from_porch = [
        reading
        for reading in meshed_nodes["garage"].get("/api/readings").json()
        if reading["node"] == "porch"
    ]
    assert {tuple(reading["position"]) for reading in from_porch} == {(27.974, 85.186)}


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
