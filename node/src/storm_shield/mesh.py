import threading
from collections.abc import Callable
from typing import Literal, Protocol

from pydantic import BaseModel

from storm_shield.scenario import Reading


class CommunityReadingsMessage(BaseModel):
    kind: Literal["community_readings"] = "community_readings"
    readings: list[Reading]


MeshMessage = CommunityReadingsMessage

# The sender is whatever the Mesh verified, never something the message claims about itself.
MessageListener = Callable[[str, MeshMessage], None]


class Mesh(Protocol):
    identity: str

    def publish(self, message: MeshMessage) -> None: ...

    def subscribe(self, listener: MessageListener) -> None: ...


class InMemoryNetwork:
    """Stands in for the radio: Nodes created here hear each other inside one process."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._meshes: dict[str, InMemoryMesh] = {}

    def join(self, identity: str) -> "InMemoryMesh":
        mesh = InMemoryMesh(identity, self)
        with self._lock:
            self._meshes[identity] = mesh
        return mesh

    def leave(self, identity: str) -> None:
        with self._lock:
            self._meshes.pop(identity, None)

    def deliver(self, sender: str, message: MeshMessage) -> None:
        with self._lock:
            receivers = [mesh for name, mesh in self._meshes.items() if name != sender]
        for mesh in receivers:
            mesh.receive(sender, message)


class InMemoryMesh:
    def __init__(self, identity: str, network: InMemoryNetwork) -> None:
        self.identity = identity
        self._network = network
        self._listeners: list[MessageListener] = []

    def publish(self, message: MeshMessage) -> None:
        self._network.deliver(self.identity, message)

    def subscribe(self, listener: MessageListener) -> None:
        self._listeners.append(listener)

    def receive(self, sender: str, message: MeshMessage) -> None:
        for listener in self._listeners:
            listener(sender, message)
