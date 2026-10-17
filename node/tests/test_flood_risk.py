from typing import Any

from fastapi.testclient import TestClient
from meshed_nodes import MeshedNodes


def _step(client: TestClient, times: int = 1) -> None:
    for _ in range(times):
        client.post("/api/scenario/step")


def _flood_risk(client: TestClient) -> dict[str, Any]:
    return client.get("/api/state").json()["flood_risk"]  # type: ignore[no-any-return]


def _reason_codes(client: TestClient) -> set[str]:
    return {reason["code"] for reason in _flood_risk(client)["reasons"]}


def test_a_calm_day_shows_no_flood_risk(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("porch", "garage")
    flood_risk = _flood_risk(meshed_nodes["porch"])
    assert flood_risk["level"] is None
    assert flood_risk["reasons"] == []
    assert flood_risk["storm_signal"]["on"] is False


def test_the_pressure_drop_raises_the_storm_signal_and_shows_low(
    meshed_nodes: MeshedNodes,
) -> None:
    meshed_nodes.start("porch", "garage")
    meshed_nodes.register("garage", "porch")
    _step(meshed_nodes["porch"])
    _step(meshed_nodes["garage"])
    flood_risk = _flood_risk(meshed_nodes["porch"])
    assert flood_risk["level"] == "low"
    assert flood_risk["storm_signal"]["on"] is True
    assert flood_risk["storm_signal"]["nodes"] == 2
    assert flood_risk["storm_signal"]["pressure_hpa"] < 1009
    assert _reason_codes(meshed_nodes["porch"]) == {"pressure_falling"}


def test_the_rain_step_is_elevated_with_rain_and_water_reasons(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("porch")
    meshed_nodes.register("porch")
    _step(meshed_nodes["porch"], 2)
    flood_risk = _flood_risk(meshed_nodes["porch"])
    assert flood_risk["level"] == "elevated"
    assert {"rain_heavy", "water_high", "water_rising"} <= _reason_codes(meshed_nodes["porch"])


def test_rain_with_water_rising_is_high(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("porch")
    meshed_nodes.register("porch")
    _step(meshed_nodes["porch"], 3)
    flood_risk = _flood_risk(meshed_nodes["porch"])
    assert flood_risk["level"] == "high"
    assert {"water_high", "rain_heavy"} <= _reason_codes(meshed_nodes["porch"])


def test_resetting_the_scenario_shows_no_flood_risk_again(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("porch")
    meshed_nodes.register("porch")
    _step(meshed_nodes["porch"], 3)
    meshed_nodes["porch"].post("/api/scenario/reset")
    flood_risk = _flood_risk(meshed_nodes["porch"])
    assert flood_risk["level"] is None
    assert flood_risk["reasons"] == []


def test_reasons_count_the_nodes_that_agree(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("porch", "garage", "creek")
    meshed_nodes.register("creek", "garage", "porch")
    _step(meshed_nodes["porch"], 3)
    _step(meshed_nodes["garage"], 3)
    heavy_rain = next(
        reason
        for reason in _flood_risk(meshed_nodes["creek"])["reasons"]
        if reason["code"] == "rain_heavy"
    )
    assert heavy_rain["nodes"] == 2
    assert heavy_rain["value"] >= 25


def test_soil_moisture_rising_at_two_nodes_shows_low(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("porch")
    meshed_nodes.register("creek", "garage", "porch")
    for sender in ["creek", "garage"]:
        meshed_nodes.hear_from(sender, soil_pct=30)
        meshed_nodes.hear_from(sender, soil_pct=40)
    flood_risk = _flood_risk(meshed_nodes["porch"])
    assert flood_risk["level"] == "low"
    assert _reason_codes(meshed_nodes["porch"]) == {"raining"}


def test_soil_moisture_rising_at_one_of_two_nodes_is_not_raining(
    meshed_nodes: MeshedNodes,
) -> None:
    meshed_nodes.start("porch")
    meshed_nodes.register("creek", "porch")
    meshed_nodes.hear_from("creek", soil_pct=30)
    meshed_nodes.hear_from("creek", soil_pct=40)
    assert _flood_risk(meshed_nodes["porch"])["level"] is None


def test_a_lone_node_seeing_soil_moisture_rise_is_raining(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("porch")
    meshed_nodes.register("porch")
    _step(meshed_nodes["porch"], 2)
    assert "raining" in _reason_codes(meshed_nodes["porch"])


def test_one_low_barometer_among_several_nodes_is_not_a_storm_signal(
    meshed_nodes: MeshedNodes,
) -> None:
    meshed_nodes.start("porch", "garage", "creek")
    meshed_nodes.register("creek", "garage", "porch")
    for name in ["garage", "creek"]:
        meshed_nodes[name].post("/api/scenario/reset")
    _step(meshed_nodes["porch"])
    assert _flood_risk(meshed_nodes["creek"])["storm_signal"]["on"] is False


def test_water_that_stays_high_after_the_rain_stops_stays_elevated(
    meshed_nodes: MeshedNodes,
) -> None:
    meshed_nodes.start("porch")
    meshed_nodes.register("creek", "porch")
    meshed_nodes.hear_from("creek", water_cm=20)
    meshed_nodes.hear_from("creek", water_cm=45)
    meshed_nodes.advance(121)
    meshed_nodes.hear_from("creek", water_cm=45)
    flood_risk = _flood_risk(meshed_nodes["porch"])
    assert flood_risk["level"] == "elevated"
    assert _reason_codes(meshed_nodes["porch"]) == {"water_high"}


def test_after_two_minutes_the_rise_fades_but_the_low_pressure_keeps_the_storm_signal(
    meshed_nodes: MeshedNodes,
) -> None:
    meshed_nodes.start("porch")
    meshed_nodes.register("porch")
    _step(meshed_nodes["porch"], 3)
    meshed_nodes.advance(121)
    _step(meshed_nodes["porch"])
    flood_risk = _flood_risk(meshed_nodes["porch"])
    assert flood_risk["storm_signal"]["on"] is True
    assert "water_rising" not in _reason_codes(meshed_nodes["porch"])
    assert "raining" not in _reason_codes(meshed_nodes["porch"])


def test_the_headline_is_the_worst_node_and_each_node_reports_its_own_level(
    meshed_nodes: MeshedNodes,
) -> None:
    meshed_nodes.start("porch", "garage")
    meshed_nodes.register("garage", "porch")
    _step(meshed_nodes["porch"], 3)
    _step(meshed_nodes["garage"], 2)
    flood_risk = _flood_risk(meshed_nodes["garage"])
    assert flood_risk["level"] == "high"
    assert flood_risk["nodes"] == {"garage": "elevated", "porch": "high"}


def test_a_node_with_a_single_reading_is_not_rising(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("garage")
    _step(meshed_nodes["garage"], 3)
    meshed_nodes.advance(121)
    meshed_nodes.start("porch")
    meshed_nodes.register("garage", "porch")
    _step(meshed_nodes["garage"])
    codes = _reason_codes(meshed_nodes["porch"])
    assert "water_high" in codes
    assert "water_rising" not in codes


def test_reasons_show_tidy_values(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start("porch")
    meshed_nodes.register("creek", "porch")
    meshed_nodes.hear_from("creek", water_cm=29)
    meshed_nodes.hear_from("creek", water_cm=41.7)
    values = [reason["value"] for reason in _flood_risk(meshed_nodes["porch"])["reasons"]]
    assert all(value == round(value, 1) for value in values)
