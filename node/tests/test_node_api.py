from fastapi.testclient import TestClient

from storm_shield.main import create_app
from storm_shield.settings import Settings


def test_sensor_node_reports_its_name_and_role() -> None:
    client = TestClient(create_app(Settings(name="porch", role="sensor")))
    assert client.get("/api/node").json() == {"name": "porch", "role": "sensor"}


def test_hub_reports_the_hub_role() -> None:
    client = TestClient(create_app(Settings(name="hub", role="hub")))
    assert client.get("/api/node").json() == {"name": "hub", "role": "hub"}


def _reading(client: TestClient) -> dict[str, float]:
    [reading] = client.get("/api/readings").json()
    return dict(reading)


def test_reading_follows_the_wire_format_and_is_labeled_simulated() -> None:
    client = TestClient(create_app(Settings()))
    reading = _reading(client)
    assert reading["sim"] is True
    assert reading["t"] > 0
    assert {"pressure_hpa", "water_m", "rain_mmh", "soil_pct"} <= reading.keys()


def test_stepping_the_scenario_changes_the_reading() -> None:
    client = TestClient(create_app(Settings()))
    normal_day = _reading(client)
    assert client.post("/api/scenario/step").json() == {"step": "pressure_drop"}
    assert _reading(client)["pressure_hpa"] < normal_day["pressure_hpa"] - 5
    client.post("/api/scenario/step")
    assert _reading(client)["rain_mmh"] > 5
    client.post("/api/scenario/step")
    assert _reading(client)["water_m"] > normal_day["water_m"] + 0.5


def test_stepping_past_water_rising_stays_there() -> None:
    client = TestClient(create_app(Settings()))
    for _ in range(6):
        client.post("/api/scenario/step")
    assert client.get("/api/scenario").json() == {"step": "water_rising"}


def test_reset_returns_the_scenario_to_normal_day() -> None:
    client = TestClient(create_app(Settings()))
    client.post("/api/scenario/step")
    client.post("/api/scenario/step")
    assert client.post("/api/scenario/reset").json() == {"step": "normal_day"}
    assert _reading(client)["rain_mmh"] < 1
