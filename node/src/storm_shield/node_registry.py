import threading
from collections.abc import Callable
from datetime import datetime
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, ValidationError

# What one signed Reticulum packet holds (RNS.Packet.PLAIN_MDU), counting the 64-byte signature.
# A test checks this against Reticulum itself.
MAX_SIGNED_MESSAGE_BYTES = 464
SIGNATURE_BYTES = 64
NODE_NAME_MAX_LENGTH = 32

RegistrationState = Literal["unverified", "waiting", "registered"]


class SignUp(BaseModel):
    """A Node asking to be Registered, in the mesh format of docs/specs/wire-formats.md.

    It names its Node because the Mesh cannot address the Hub; the Mesh checks the signature
    against that Node, so one Node cannot sign another up.
    """

    v: Literal[1] = 1
    kind: Literal["signup"] = "signup"
    node: str
    name: str = Field(max_length=NODE_NAME_MAX_LENGTH)


class RegisteredNode(BaseModel):
    id: str
    name: str


class NodeRegistryMessage(BaseModel):
    """The Hub's full list of Registered Nodes, signed by the Hub."""

    v: Literal[1] = 1
    kind: Literal["registry"] = "registry"
    ver: int
    # Always 1 of 1 for now; a registry that spans packets is not built.
    part: int = 1
    of: int = 1
    t: int
    nodes: list[RegisteredNode]


class WaitingSignUp(BaseModel):
    id: str
    name: str
    heard_at: datetime


class RegistryRow(BaseModel):
    id: str
    name: str | None
    status: RegistrationState
    last_heard_s: float | None


class RegistrySummary(BaseModel):
    ver: int
    nodes: list[RegistryRow]


class RegistryFull(Exception):
    """The registry would no longer fit one signed packet."""


class NoWaitingSignUp(Exception):
    """No Node with this id is waiting to be accepted."""


class HeardRegistry:
    """The newest registry this Node has heard from the Hub; with none, nobody is Registered."""

    def __init__(self) -> None:
        # The Reticulum receive thread writes while request threads read.
        self._lock = threading.Lock()
        self._newest: NodeRegistryMessage | None = None

    def hear(self, registry: NodeRegistryMessage) -> None:
        """Keep the registry only if its `ver` is higher, so a late old copy can't undo an accept."""
        if registry.of != 1:
            return
        with self._lock:
            if self._newest is None or registry.ver > self._newest.ver:
                self._newest = registry

    def registered_ids(self) -> frozenset[str]:
        with self._lock:
            return (
                frozenset(node.id for node in self._newest.nodes) if self._newest else frozenset()
            )

    def name_of(self, node_id: str) -> str | None:
        with self._lock:
            nodes = self._newest.nodes if self._newest else []
        return next((node.name for node in nodes if node.id == node_id), None)


class SavedRegistry(BaseModel):
    """What the Hub keeps on disk between restarts."""

    ver: int
    nodes: list[RegisteredNode]


class HubRegistry:
    """The Hub's own list of Registered Nodes, and the Sign-ups waiting for the operator.

    The Hub is always in it. Kept in `state_file` so a restart neither forgets a Registered Node
    nor lets `ver` go backwards; Sign-ups wait in memory only, because a Node resends its own.
    """

    def __init__(
        self,
        hub: RegisteredNode,
        unix_seconds: Callable[[], int],
        state_file: Path,
    ) -> None:
        self._hub = hub
        self._unix_seconds = unix_seconds
        # Request threads accept while the Mesh listener records Sign-ups and the loop repeats.
        self._lock = threading.Lock()
        self._state_file = state_file
        self._waiting: dict[str, WaitingSignUp] = {}
        self._ver = 1
        self._nodes: list[RegisteredNode] = [hub]
        if state_file.exists():
            saved = self._load()
            # Nodes already hold the saved `ver`, and only a higher one replaces it.
            self._commit(saved.ver + 1, saved.nodes)
        else:
            self._commit(1, [hub])

    def snapshot(self) -> NodeRegistryMessage:
        with self._lock:
            return self._message()

    def hear_sign_up(self, sign_up: SignUp, heard_at: datetime) -> None:
        """Wait for the operator, unless the Node is already Registered under any name."""
        with self._lock:
            if any(node.id == sign_up.node for node in self._nodes):
                return
            self._waiting[sign_up.node] = WaitingSignUp(
                id=sign_up.node, name=sign_up.name, heard_at=heard_at
            )

    def accept(self, node_id: str) -> NodeRegistryMessage:
        """Register a waiting Node under a higher `ver`, so every Node takes the change."""
        with self._lock:
            waiting = self._waiting.get(node_id)
            if waiting is None:
                raise NoWaitingSignUp(node_id)
            nodes = [*self._nodes, RegisteredNode(id=waiting.id, name=waiting.name)]
            message = self._message(self._ver + 1, nodes)
            if len(message.model_dump_json().encode()) + SIGNATURE_BYTES > MAX_SIGNED_MESSAGE_BYTES:
                raise RegistryFull(node_id)
            self._commit(message.ver, nodes)
            del self._waiting[node_id]
            return message

    def summary(self, heard_ages: dict[str, float], now: datetime) -> RegistrySummary:
        """Every Registered Node, every waiting Sign-up, and every Node heard that is neither.

        `heard_ages` is seconds since each Node's last reading, on this Node's clock.
        """
        with self._lock:
            registered = [
                RegistryRow(
                    id=node.id,
                    name=node.name,
                    status="registered",
                    last_heard_s=heard_ages.get(node.id),
                )
                for node in self._nodes
            ]
            waiting = [
                RegistryRow(
                    id=sign_up.id,
                    name=sign_up.name,
                    status="waiting",
                    last_heard_s=(now - sign_up.heard_at).total_seconds(),
                )
                for sign_up in self._waiting.values()
            ]
            known = {row.id for row in registered} | set(self._waiting)
            unverified = [
                RegistryRow(id=node_id, name=None, status="unverified", last_heard_s=age)
                for node_id, age in sorted(heard_ages.items())
                if node_id not in known
            ]
            return RegistrySummary(ver=self._ver, nodes=[*registered, *waiting, *unverified])

    def _message(
        self, ver: int | None = None, nodes: list[RegisteredNode] | None = None
    ) -> NodeRegistryMessage:
        return NodeRegistryMessage(
            ver=self._ver if ver is None else ver,
            t=self._unix_seconds(),
            nodes=self._nodes if nodes is None else nodes,
        )

    def _load(self) -> SavedRegistry:
        try:
            return SavedRegistry.model_validate_json(self._state_file.read_text())
        except ValidationError as error:
            # Guessing would drop a Registered Node or rewind `ver`, so the operator decides.
            raise RuntimeError(
                f"{self._state_file} is not a valid Node registry file; fix it, or delete it "
                "to start over with only the Hub"
            ) from error

    def _commit(self, ver: int, nodes: list[RegisteredNode]) -> None:
        """Save first, so a failed write leaves the Hub as it was and announces nothing unsaved."""
        # The Hub is listed even if an old file lacks it, under the name it has now.
        nodes = [self._hub, *(node for node in nodes if node.id != self._hub.id)]
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        # Replace the file in one step, so losing power mid-write cannot leave half a file.
        temporary_file = self._state_file.with_suffix(".tmp")
        temporary_file.write_text(SavedRegistry(ver=ver, nodes=nodes).model_dump_json())
        temporary_file.replace(self._state_file)
        self._ver = ver
        self._nodes = nodes
