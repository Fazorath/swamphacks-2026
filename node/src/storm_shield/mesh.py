import json
import logging
import threading
from collections.abc import Callable, Iterable
from typing import Annotated, Any, Protocol, get_args

from pydantic import Field, TypeAdapter, ValidationError

from storm_shield.community_reading import CommunityReading
from storm_shield.node_registry import NodeRegistryMessage, SignUp
from storm_shield.official_alert import OfficialAlert
from storm_shield.replay import ReplayClockMessage
from storm_shield.shelter_status import ShelterStatus

Message = (
    CommunityReading
    | SignUp
    | NodeRegistryMessage
    | ShelterStatus
    | ReplayClockMessage
    | OfficialAlert
)

# The sender is whatever the Mesh verified, never something the message claims about itself.
MessageListener = Callable[[str, Message], None]

# The `v` every message class declares; decode_message checks it before the classes see the body.
FORMAT_VERSION = 1

logger = logging.getLogger(__name__)

_MESSAGE: TypeAdapter[Message] = TypeAdapter(Annotated[Message, Field(discriminator="kind")])
_KNOWN_KINDS = {message_type.model_fields["kind"].default for message_type in get_args(Message)}


def decode_message(body: bytes) -> Message | None:
    """The message in `body`, or None if this Node cannot use it.

    A kind or format version this Node does not know is a newer Node talking, so it is dropped
    quietly; anything else that does not parse is logged. Extra fields are ignored.
    """
    fields = _fields_with_kind_and_version(body)
    if fields is not None and (fields["kind"] not in _KNOWN_KINDS or fields["v"] != FORMAT_VERSION):
        return None
    try:
        return _MESSAGE.validate_python(fields)
    except ValidationError:
        logger.warning("dropped a mesh packet that is not a message this Node understands")
        return None


def _fields_with_kind_and_version(body: bytes) -> dict[str, Any] | None:
    """The JSON object in `body` if its `kind` is a string and its `v` an integer, else None.

    Only such a message can be a newer Node's; anything else is a broken sender, and the None it
    gets here fails validation so that it is logged.
    """
    try:
        fields = json.loads(body)
    except ValueError:
        return None
    # bool is an int in Python, so `true` must not pass for version 1.
    if (
        not isinstance(fields, dict)
        or not isinstance(fields.get("kind"), str)
        or type(fields.get("v")) is not int
    ):
        return None
    return fields


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
        # Same rule as the radio: readings and Sign-ups may come from any Node, and only as
        # themselves; the rest count only from the Hub this Node was told about.
        if isinstance(message, CommunityReading | SignUp):
            if message.node != sender:
                return
        elif sender != self._hub_identity:
            return
        deliver_to_listeners(self._listeners, sender, message)
