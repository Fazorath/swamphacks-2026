import threading
from collections.abc import Callable
from typing import Protocol

from storm_shield.community_reading import CommunityReading
from storm_shield.shelter_status import ShelterStatus

Message = CommunityReading | ShelterStatus

# The sender is whatever the Mesh verified, never something the message claims about itself.
MessageListener = Callable[[str, Message], None]


class Mesh(Protocol):
    identity: str

    def publish(self, message: Message) -> None: ...

    def subscribe(self, listener: MessageListener) -> None: ...


class InMemoryNetwork:
    """Stands in for the radio: Nodes created here hear each other inside one process."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._meshes: dict[str, InMemoryMesh] = {}

    def join(self, identity: str, hub_identity: str = "") -> "InMemoryMesh":
        mesh = InMemoryMesh(identity, self, hub_identity)
        with self._lock:
            self._meshes[identity] = mesh
        return mesh

    def leave(self, identity: str) -> None:
        with self._lock:
            self._meshes.pop(identity, None)

    def deliver(self, sender: str, message: Message) -> None:
        with self._lock:
            receivers = [mesh for name, mesh in self._meshes.items() if name != sender]
        # Through JSON, as on the radio, so a field the wire format lacks can't sneak across.
        wire_copy = type(message).model_validate_json(message.model_dump_json())
        for mesh in receivers:
            mesh.receive(sender, wire_copy)


class InMemoryMesh:
    def __init__(self, identity: str, network: InMemoryNetwork, hub_identity: str = "") -> None:
        self.identity = identity
        self._hub_identity = hub_identity
        self._network = network
        self._listeners: list[MessageListener] = []

    def publish(self, message: Message) -> None:
        self._network.deliver(self.identity, message)

    def subscribe(self, listener: MessageListener) -> None:
        self._listeners.append(listener)

    def receive(self, sender: str, message: Message) -> None:
        # Same rule as the radio: Shelter status counts only from the Hub this Node was told about.
        if isinstance(message, ShelterStatus) and sender != self._hub_identity:
            return
        for listener in self._listeners:
            listener(sender, message)
