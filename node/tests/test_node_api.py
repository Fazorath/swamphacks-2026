from fastapi.testclient import TestClient

from storm_shield.main import create_app
from storm_shield.settings import Settings


def test_sensor_node_reports_its_name_and_role() -> None:
    client = TestClient(create_app(Settings(name="porch", role="sensor")))
    assert client.get("/api/node").json() == {"name": "porch", "role": "sensor"}


def test_hub_reports_the_hub_role() -> None:
    client = TestClient(create_app(Settings(name="hub", role="hub")))
    assert client.get("/api/node").json() == {"name": "hub", "role": "hub"}
