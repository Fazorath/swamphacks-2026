from fastapi.testclient import TestClient
from meshed_nodes import MeshedNodes


def _step(client: TestClient, times: int) -> None:
    for _ in range(times):
        client.post("/api/scenario/step")


def _reason_texts(client: TestClient) -> list[str]:
    return [reason["text"] for reason in client.get("/api/flood-risk").json()["reasons"]]


def test_a_normal_day_is_low_flood_risk_with_no_reasons(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("porch", "garage")
    flood_risk = meshed_nodes["porch"].get("/api/flood-risk").json()
    assert flood_risk["level"] == "low"
    assert flood_risk["reasons"] == []
    assert flood_risk["storm_signal"]["falling"] is False


def test_rain_with_water_rising_is_high_and_says_why(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("porch", "garage", "creek")
    _step(meshed_nodes["porch"], 3)
    _step(meshed_nodes["garage"], 3)
    assert meshed_nodes["creek"].get("/api/flood-risk").json()["level"] == "high"
    texts = _reason_texts(meshed_nodes["creek"])
    assert "water level rising at 2 Nodes" in texts
    assert "heavy rain at 2 Nodes" in texts


def test_flood_risk_climbs_from_low_to_high_as_the_scenario_advances(
    meshed_nodes: MeshedNodes,
) -> None:
    meshed_nodes.start("porch")
    levels = [meshed_nodes["porch"].get("/api/flood-risk").json()["level"]]
    for _ in range(3):
        meshed_nodes["porch"].post("/api/scenario/step")
        levels.append(meshed_nodes["porch"].get("/api/flood-risk").json()["level"])
    assert levels == ["low", "low", "elevated", "high"]


def test_a_pressure_drop_across_nodes_raises_the_storm_signal(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("porch", "garage")
    _step(meshed_nodes["porch"], 1)
    _step(meshed_nodes["garage"], 1)
    flood_risk = meshed_nodes["porch"].get("/api/flood-risk").json()
    assert flood_risk["storm_signal"] == {"falling": True, "text": "pressure falling at 2 Nodes"}
    assert flood_risk["level"] == "low"


def test_one_node_with_falling_pressure_among_many_is_not_a_storm_signal(
    meshed_nodes: MeshedNodes,
) -> None:
    meshed_nodes.start("porch", "garage", "creek")
    _step(meshed_nodes["porch"], 1)
    assert meshed_nodes["creek"].get("/api/flood-risk").json()["storm_signal"]["falling"] is False


def test_resetting_the_scenario_clears_the_storm_signal(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("porch")
    _step(meshed_nodes["porch"], 3)
    meshed_nodes["porch"].post("/api/scenario/reset")
    flood_risk = meshed_nodes["porch"].get("/api/flood-risk").json()
    assert flood_risk["storm_signal"]["falling"] is False
    assert flood_risk["level"] == "low"
