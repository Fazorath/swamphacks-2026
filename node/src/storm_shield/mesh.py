import json
import logging
import threading
from collections.abc import Callable, Iterable
from typing import Annotated, Protocol, get_args

from pydantic import Field, TypeAdapter, ValidationError

from storm_shield.community_reading import CommunityReading
from storm_shield.official_alert import OfficialAlert
from storm_shield.replay import ReplayClockMessage
from storm_shield.shelter_status import ShelterStatus

Message = CommunityReading | ShelterStatus | ReplayClockMessage | OfficialAlert

# The sender is whatever the Mesh verified, never something the message claims about itself.
MessageListener = Callable[[str, Message], None]

FORMAT_VERSION = 1

logger = logging.getLogger(__name__)

_MESSAGE: TypeAdapter[Message] = TypeAdapter(Annotated[Message, Field(discriminator="kind")])
_KNOWN_KINDS = {message_type.model_fields["kind"].default for message_type in get_args(Message)}


def decode_message(body: bytes) -> Message | None:
    """The message in `body`, or None if this Node cannot use it.

    A kind or format version this Node does not know is a newer Node talking, so it is dropped
    quietly; anything else that does not parse is logged. Extra fields are ignored.
    """
    try:
        fields = json.loads(body)
    except ValueError:
        fields = None
    if isinstance(fields, dict) and (
        fields.get("kind") not in _KNOWN_KINDS or fields.get("v") != FORMAT_VERSION
    ):
        return None
    try:
        return _MESSAGE.validate_python(fields)
    except ValidationError:
        logger.warning("dropped a mesh packet that is not a message this Node understands")
        return None


def deliver_to_listeners(
    listeners: Iterable[MessageListener], sender: str, message: Message
) -> None:
    """Every listener hears the message even if one of them raises."""
    for listener in listeners:
        try:
            listener(sender, message)
        except Exception:
            # Reticulum would swallow this silently on its own thread.
            logger.exception("a listener failed on a %s from %s", message.kind, sender)


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
        self.deliver_bytes(sender, message.model_dump_json().encode())

    def deliver_bytes(self, sender: str, body: bytes) -> None:
        """What the radio does: every other Node decodes the same bytes, or drops them."""
        with self._lock:
            receivers = [mesh for name, mesh in self._meshes.items() if name != sender]
        wire_copy = decode_message(body)
        if wire_copy is None:
            return
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
        # Same rule as the radio: only readings may come from any Node; the rest count only from
        # the Hub this Node was told about.
        if not isinstance(message, CommunityReading) and sender != self._hub_identity:
            return
        deliver_to_listeners(self._listeners, sender, message)
