import httpx
from fastapi.testclient import TestClient

from storm_shield.main import create_app
from storm_shield.mesh import InMemoryNetwork
from storm_shield.settings import Settings

PNG = b"\x89PNG tile bytes"


def _client(
    answer: httpx.Response | Exception, key: str = "secret-key"
) -> tuple[TestClient, list[httpx.Request]]:
    requests: list[httpx.Request] = []

    def respond(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if isinstance(answer, Exception):
            raise answer
        return answer

    tile_source = httpx.Client(transport=httpx.MockTransport(respond))
    settings = Settings(carto_api_key=key)
    app = create_app(settings, InMemoryNetwork().join(settings.name), tile_source=tile_source)
    return TestClient(app), requests


def test_a_tile_is_fetched_from_carto_with_the_nodes_key() -> None:
    client, requests = _client(httpx.Response(200, content=PNG))
    response = client.get("/api/tiles/13/2255/3376.png")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content == PNG
    assert requests[0].url.path == "/rastertiles/dark_all/13/2255/3376.png"
    assert requests[0].url.params["key"] == "secret-key"


def test_the_key_never_reaches_the_browser() -> None:
    client, _ = _client(httpx.Response(200, content=PNG))
    response = client.get("/api/tiles/13/2255/3376.png")
    assert "secret-key" not in str(response.headers) + response.text


def test_a_node_without_a_key_says_so_and_calls_nobody() -> None:
    client, requests = _client(httpx.Response(200, content=PNG), key="")
    response = client.get("/api/tiles/13/2255/3376.png")
    assert response.status_code == 404
    assert "CARTO_API_KEY" in response.json()["detail"]
    assert requests == []


def test_a_rejected_key_is_a_bad_gateway_without_the_key_in_it() -> None:
    client, _ = _client(httpx.Response(403))
    response = client.get("/api/tiles/13/2255/3376.png")
    assert response.status_code == 502
    assert "secret-key" not in response.text


def test_an_unreachable_carto_is_a_bad_gateway() -> None:
    client, _ = _client(httpx.ConnectError("offline"))
    assert client.get("/api/tiles/13/2255/3376.png").status_code == 502
