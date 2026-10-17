from typing import Any

from fastapi.testclient import TestClient
from meshed_nodes import MeshedNodes


def _state(client: TestClient) -> dict[str, Any]:
    response = client.get("/api/state")
    assert response.status_code == 200
    return response.json()  # type: ignore[no-any-return]


def _entry(state: dict[str, Any], node: str) -> dict[str, Any]:
    return next(entry for entry in state["nodes"] if entry["id"] == node)


def test_the_state_names_this_node_and_the_scenario_step(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("porch")
    meshed_nodes["porch"].post("/api/scenario/step")
    state = _state(meshed_nodes["porch"])
    assert state["id"] == "porch"
    assert state["name"]
    assert state["role"] == "sensor"
    assert state["status"] in {"online", "mesh_only"}
    assert state["scenario"] == {"step": "pressure_drop"}


def test_the_state_groups_each_nodes_readings_with_its_own_and_its_peers(
    meshed_nodes: MeshedNodes,
) -> None:
    meshed_nodes.start("porch")
    meshed_nodes.hear_from("garage", water_cm=44)
    state = _state(meshed_nodes["porch"])

    assert [entry["id"] for entry in state["nodes"]] == ["garage", "porch"]
    garage = _entry(state, "garage")
    assert garage["simulated"] is True
    assert garage["stale"] is False
    assert garage["age_s"] == 0
    assert len(garage["position"]) == 2
    assert garage["measurements"]["water_level"] == {"value": 44, "unit": "cm"}
    assert set(garage["measurements"]) == {"pressure", "rain_rate", "water_level", "soil_moisture"}
    assert _entry(state, "porch")["measurements"]["pressure"]["unit"] == "hPa"


def test_a_node_that_stops_publishing_turns_stale_after_15_seconds(
    meshed_nodes: MeshedNodes,
) -> None:
    meshed_nodes.start("porch")
    meshed_nodes.hear_from("garage")

    meshed_nodes.advance(15)
    assert _entry(_state(meshed_nodes["porch"]), "garage")["stale"] is False

    meshed_nodes.advance(5)
    garage = _entry(_state(meshed_nodes["porch"]), "garage")
    assert garage["stale"] is True
    assert garage["age_s"] == 20

    meshed_nodes.advance(10)
    assert _entry(_state(meshed_nodes["porch"]), "garage")["age_s"] == 30


def test_a_new_reading_makes_a_stale_node_fresh_again(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("porch")
    meshed_nodes.hear_from("garage")
    meshed_nodes.advance(30)
    meshed_nodes.hear_from("garage")
    garage = _entry(_state(meshed_nodes["porch"]), "garage")
    assert garage["stale"] is False
    assert garage["age_s"] == 0


def test_flood_risk_in_the_state_agrees_with_the_readings_beside_it(
    meshed_nodes: MeshedNodes,
) -> None:
    meshed_nodes.start("porch")
    for _ in range(2):
        meshed_nodes["porch"].post("/api/scenario/step")
    state = _state(meshed_nodes["porch"])

    assert _entry(state, "porch")["measurements"]["water_level"]["value"] > 30
    assert state["flood_risk"]["level"] == "elevated"
    assert state["flood_risk"]["nodes"] == {"porch": "elevated"}


def test_flood_risk_and_the_node_entries_list_the_same_nodes(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("porch")
    meshed_nodes.hear_from("garage", rain_mmh=30, water_cm=90)
    state = _state(meshed_nodes["porch"])

    assert _entry(state, "garage")["measurements"]["water_level"]["value"] == 90
    assert set(state["flood_risk"]["nodes"]) == {entry["id"] for entry in state["nodes"]}
    assert state["flood_risk"]["nodes"]["garage"] == "high"


def test_a_node_is_stale_only_after_more_than_15_seconds(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("porch")
    meshed_nodes.hear_from("garage")
    meshed_nodes.advance(15.5)
    assert _entry(_state(meshed_nodes["porch"]), "garage")["stale"] is True


def test_only_nodes_that_have_spoken_are_listed_and_none_is_flagged_as_this_node(
    meshed_nodes: MeshedNodes,
) -> None:
    meshed_nodes.start("porch")
    state = _state(meshed_nodes["porch"])
    assert [entry["id"] for entry in state["nodes"]] == ["porch"]
    assert set(state["nodes"][0]) == {
        "id",
        "position",
        "simulated",
        "age_s",
        "stale",
        "measurements",
    }


def test_the_endpoints_the_state_replaced_are_gone(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("porch")
    for path in (
        "/api/node",
        "/api/readings",
        "/api/readings/stream",
        "/api/flood-risk",
        "/api/scenario",
    ):
        assert meshed_nodes["porch"].get(path).status_code == 404, path
