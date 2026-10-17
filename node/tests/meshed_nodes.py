from fastapi.testclient import TestClient

from storm_shield.main import create_app
from storm_shield.mesh import InMemoryNetwork
from storm_shield.settings import Settings


class MeshedNodes:
    """Several Nodes in one process, joined by the in-memory Mesh and driven through their APIs."""

    def __init__(self) -> None:
        self._network = InMemoryNetwork()
        self._clients: dict[str, TestClient] = {}

    def start(self, *names: str) -> None:
        for name in names:
            mesh = self._network.join(name)
            self._clients[name] = TestClient(create_app(Settings(name=name), mesh))

    def remove(self, name: str) -> None:
        self._network.leave(name)
        del self._clients[name]

    def __getitem__(self, name: str) -> TestClient:
        return self._clients[name]
