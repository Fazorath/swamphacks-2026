from pathlib import Path

from fastapi.testclient import TestClient

from storm_shield.main import create_app
from storm_shield.mesh import InMemoryNetwork
from storm_shield.settings import HOTSPOT_ADDRESS, Settings


def _client(host: str, ssid: str = "stormshield-mesh") -> TestClient:
    settings = Settings(hotspot_ssid=ssid, hotspot_password="correct-horse")
    app = create_app(settings, InMemoryNetwork().join(settings.name))
    return TestClient(app, client=(host, 50000))


def test_the_nodes_own_machine_is_told_the_hotspot() -> None:
    response = _client("127.0.0.1").get("/api/join")
    assert response.status_code == 200
    assert response.json() == {
        "ssid": "stormshield-mesh",
        "password": "correct-horse",
        "url": "http://10.88.0.1:8000",
    }


def test_a_phone_on_the_wifi_is_not_told_the_password() -> None:
    assert _client("10.88.0.7").get("/api/join").status_code == 403


def test_a_node_with_no_hotspot_has_nothing_to_tell() -> None:
    assert _client("127.0.0.1", ssid="").get("/api/join").status_code == 404


def test_the_hotspot_address_matches_the_one_the_pi_script_sets() -> None:
    script = (Path(__file__).resolve().parents[2] / "pi" / "setup-hotspot.sh").read_text()

    assert f'address="{HOTSPOT_ADDRESS}"' in script
