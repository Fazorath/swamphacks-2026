from fastapi.testclient import TestClient

from storm_shield.main import create_app
from storm_shield.mesh import InMemoryNetwork
from storm_shield.settings import Settings


def _client(settings: Settings) -> TestClient:
    return TestClient(create_app(settings, InMemoryNetwork().join(settings.name)))


def test_sensor_node_reports_its_id_name_and_role() -> None:
    client = _client(Settings(name="porch", role="sensor"))
    assert client.get("/api/node").json() == {"id": "porch", "name": "porch", "role": "sensor"}


def test_hub_reports_the_hub_role() -> None:
    client = _client(Settings(name="hub", role="hub"))
    assert client.get("/api/node").json() == {"id": "hub", "name": "hub", "role": "hub"}


def _readings_by_kind(client: TestClient) -> dict[str, float]:
    return {reading["kind"]: reading["value"] for reading in client.get("/api/readings").json()}


def test_readings_are_timestamped_and_labeled_simulated() -> None:
    client = _client(Settings())
    readings = client.get("/api/readings").json()
    assert {reading["kind"] for reading in readings} == {
        "pressure",
        "rain_rate",
        "water_level",
        "soil_moisture",
    }
    assert all(reading["simulated"] and reading["timestamp"] for reading in readings)
    assert all(0 <= reading["age_s"] < 5 for reading in readings)


def test_stepping_the_scenario_changes_the_readings() -> None:
    client = _client(Settings())
    normal_day = _readings_by_kind(client)
    assert client.post("/api/scenario/step").json() == {"step": "pressure_drop"}
    assert _readings_by_kind(client)["pressure"] < normal_day["pressure"] - 5
    client.post("/api/scenario/step")
    assert _readings_by_kind(client)["rain_rate"] > 5
    client.post("/api/scenario/step")
    assert _readings_by_kind(client)["water_level"] > normal_day["water_level"] + 50


def test_stepping_past_water_rising_stays_there() -> None:
    client = _client(Settings())
    for _ in range(6):
        client.post("/api/scenario/step")
    assert client.get("/api/scenario").json() == {"step": "water_rising"}


def test_reset_returns_the_scenario_to_normal_day() -> None:
    client = _client(Settings())
    client.post("/api/scenario/step")
    client.post("/api/scenario/step")
    assert client.post("/api/scenario/reset").json() == {"step": "normal_day"}
    assert _readings_by_kind(client)["rain_rate"] < 1
