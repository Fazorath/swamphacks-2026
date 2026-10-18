from typing import Any

from fastapi.testclient import TestClient
from meshed_nodes import MeshedNodes


def _state(client: TestClient) -> dict[str, Any]:
    response = client.get("/api/state")
    assert response.status_code == 200
    return response.json()  # type: ignore[no-any-return]


def _flood_risk(client: TestClient) -> dict[str, Any]:
    return _state(client)["flood_risk"]  # type: ignore[no-any-return]


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
    meshed_nodes.register("porch")
    for _ in range(2):
        meshed_nodes["porch"].post("/api/scenario/step")
    state = _state(meshed_nodes["porch"])

    assert _entry(state, "porch")["measurements"]["water_level"]["value"] > 30
    assert state["flood_risk"]["level"] == "elevated"
    assert state["flood_risk"]["nodes"] == {"porch": "elevated"}


def test_flood_risk_and_the_node_entries_list_the_same_nodes(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("porch")
    meshed_nodes.register("porch", "garage")
    meshed_nodes.hear_from("garage", rain_mmh=30, water_cm=650)
    state = _state(meshed_nodes["porch"])

    assert _entry(state, "garage")["measurements"]["water_level"]["value"] == 650
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
        "river_km",
        "simulated",
        "age_s",
        "stale",
        "counts",
        "measurements",
        "registered",
        "name",
    }


def test_the_state_lists_the_simulated_fleet_apart_from_the_nodes(
    meshed_nodes: MeshedNodes,
) -> None:
    meshed_nodes.start("porch")
    state = _state(meshed_nodes["porch"])
    assert state["fleet"] == []
    assert set(state) == {
        "id",
        "name",
        "role",
        "status",
        "registration",
        "scenario",
        "flood_risk",
        "nodes",
        "official_alerts",
        "community_warnings",
        "fleet",
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


def test_a_node_silent_for_a_minute_stops_counting_then_drops_off_after_ten(
    meshed_nodes: MeshedNodes,
) -> None:
    meshed_nodes.start("porch")
    meshed_nodes.register("creek", "porch")
    meshed_nodes.hear_from("creek", water_cm=700)
    meshed_nodes.hear_from("garage")

    meshed_nodes.advance(60)
    creek = _entry(_state(meshed_nodes["porch"]), "creek")
    assert creek["stale"] is True
    assert creek["counts"] is True
    assert _flood_risk(meshed_nodes["porch"])["nodes"]["creek"] == "high"

    meshed_nodes.advance(1)
    assert _entry(_state(meshed_nodes["porch"]), "creek")["counts"] is False
    assert "creek" not in _flood_risk(meshed_nodes["porch"])["nodes"]
    assert _flood_risk(meshed_nodes["porch"])["level"] is None

    meshed_nodes.advance(539)
    assert _entry(_state(meshed_nodes["porch"]), "creek")["counts"] is False
    meshed_nodes.advance(1)
    assert "creek" not in {n["id"] for n in _state(meshed_nodes["porch"])["nodes"]}


def test_a_dropped_node_that_speaks_again_is_listed_and_counts(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("porch")
    meshed_nodes.hear_from("garage")
    meshed_nodes.advance(601)
    meshed_nodes.hear_from("garage")
    garage = _entry(_state(meshed_nodes["porch"]), "garage")
    assert garage["counts"] is True
    assert garage["age_s"] == 0


def test_a_node_that_left_goes_stale_then_stops_counting_while_the_others_keep_working(
    meshed_nodes: MeshedNodes,
) -> None:
    meshed_nodes.start("porch", "garage")
    meshed_nodes.remove("garage")
    meshed_nodes.advance(20)
    meshed_nodes.hear_from("shed")
    assert _entry(_state(meshed_nodes["porch"]), "garage")["stale"] is True
    meshed_nodes.advance(45)
    meshed_nodes.hear_from("shed")
    state = _state(meshed_nodes["porch"])
    assert _entry(state, "garage")["counts"] is False
    assert _entry(state, "shed")["counts"] is True
