import logging
import threading
import time
from collections.abc import Mapping
from pathlib import Path
from typing import Any

import RNS
from pydantic import ValidationError

from storm_shield.community_reading import CommunityReading
from storm_shield.mesh import MessageListener
from storm_shield.settings import Settings

APP_NAME = "storm_shield"
ANNOUNCE_EVERY_SECONDS = 10
NODE_ID_LENGTH = 12
SIGNATURE_LENGTH = 64

# Slot n listens on LOOPBACK_BASE_PORT + n and dials every lower slot, so each pair of Nodes on
# this machine shares exactly one connection. A hub-and-spoke layout does not work: Reticulum does
# not pass one client's broadcast on to another client.
LOOPBACK_BASE_PORT = 4250

logger = logging.getLogger(__name__)


def node_id(identity: Any) -> str:
    return str(identity.hexhash[:NODE_ID_LENGTH])


def reticulum_config(settings: Settings) -> str:
    return f"""[reticulum]
  enable_transport = False
  share_instance = No

[logging]
  loglevel = 2

[interfaces]
{_interface_config(settings)}
"""


def _interface_config(settings: Settings) -> str:
    if settings.mesh_interface == "auto":
        return "  [[Wi-Fi]]\n    type = AutoInterface\n    enabled = yes"
    if settings.mesh_interface == "tcp":
        listen_ip, listen_port = "0.0.0.0", settings.tcp_port
        dials = [_peer_address(entry, settings.tcp_port) for entry in _entries(settings.tcp_peers)]
    else:
        listen_ip, listen_port = "127.0.0.1", LOOPBACK_BASE_PORT + settings.loopback_slot
        dials = [("127.0.0.1", LOOPBACK_BASE_PORT + slot) for slot in range(settings.loopback_slot)]
    listen = (
        "  [[Listen]]\n    type = TCPServerInterface\n    enabled = yes\n"
        f"    listen_ip = {listen_ip}\n    listen_port = {listen_port}"
    )
    dial_peers = [
        f"  [[Peer {number}]]\n    type = TCPClientInterface\n    enabled = yes\n"
        f"    target_host = {host}\n    target_port = {port}"
        for number, (host, port) in enumerate(dials)
    ]
    return "\n".join([listen, *dial_peers])


def _entries(peers: str) -> list[str]:
    return [entry.strip() for entry in peers.split(",") if entry.strip()]


def _peer_address(entry: str, default_port: int) -> tuple[str, int]:
    host, _, port = entry.partition(":")
    if port and not port.isdigit():
        raise ValueError(f"NODE_TCP_PEERS entry {entry!r} must be host or host:port")
    return (host, int(port) if port else default_port)


def sign(identity: Any, reading: CommunityReading) -> bytes:
    """Signature then JSON: Reticulum does not say who sent a data packet, so the Node does."""
    body = reading.model_dump_json().encode()
    return bytes(identity.sign(body)) + body


def verify(data: bytes, known_nodes: Mapping[str, Any]) -> CommunityReading | None:
    """The reading if its Node has announced itself and its signature holds, else None."""
    if len(data) <= SIGNATURE_LENGTH:
        return None
    signature, body = data[:SIGNATURE_LENGTH], data[SIGNATURE_LENGTH:]
    try:
        reading = CommunityReading.model_validate_json(body)
    except ValidationError:
        logger.warning("dropped a mesh packet that is not a Community Reading")
        return None
    sender = known_nodes.get(reading.node)
    # Nothing to log for an unknown sender: until its announce arrives that is the normal case.
    if sender is None:
        return None
    if not sender.validate(signature, body):
        logger.warning("dropped a reading whose signature does not match Node %s", reading.node)
        return None
    return reading


class ReticulumMesh:
    """Readings as signed, unencrypted broadcast packets; Nodes learn each other from announces."""

    def __init__(self, settings: Settings) -> None:
        config_dir = settings.data_dir / "reticulum"
        config_dir.mkdir(parents=True, exist_ok=True)
        # Rewritten on every start so the settings, not a stale file, decide the interface.
        (config_dir / "config").write_text(reticulum_config(settings))
        RNS.Reticulum(configdir=str(config_dir), loglevel=RNS.LOG_WARNING)

        self._key = _load_or_create_identity(settings.data_dir / "identity")
        self.identity = node_id(self._key)
        self._known_nodes: dict[str, Any] = {}
        self._listeners: list[MessageListener] = []

        self._announce_destination = RNS.Destination(
            self._key, RNS.Destination.IN, RNS.Destination.SINGLE, APP_NAME, "node"
        )
        RNS.Transport.register_announce_handler(_NodeAnnounces(self._known_nodes))

        readings_in = RNS.Destination(
            None, RNS.Destination.IN, RNS.Destination.PLAIN, APP_NAME, "readings"
        )
        readings_in.set_packet_callback(self._on_packet)
        self._readings_out = RNS.Destination(
            None, RNS.Destination.OUT, RNS.Destination.PLAIN, APP_NAME, "readings"
        )

        threading.Thread(target=self._announce_forever, daemon=True).start()

    def publish(self, message: CommunityReading) -> None:
        packet = sign(self._key, message)
        if len(packet) > RNS.Packet.PLAIN_MDU:
            raise ValueError(f"signed reading is {len(packet)} bytes, over one Reticulum packet")
        if not RNS.Packet(self._readings_out, packet).send():
            logger.warning("Reticulum did not send this Node's reading")

    def subscribe(self, listener: MessageListener) -> None:
        self._listeners.append(listener)

    def _on_packet(self, data: bytes, _packet: Any) -> None:
        reading = verify(data, self._known_nodes)
        if reading is None:
            return
        for listener in self._listeners:
            try:
                listener(reading.node, reading)
            except Exception:
                # Reticulum would swallow this silently on its own thread.
                logger.exception("a listener failed on a reading from %s", reading.node)

    def _announce_forever(self) -> None:
        while True:
            try:
                self._announce_destination.announce()
            except Exception:
                # One failed announce must not make this Node undiscoverable for good.
                logger.exception("could not announce this Node")
            time.sleep(ANNOUNCE_EVERY_SECONDS)


class _NodeAnnounces:
    aspect_filter = f"{APP_NAME}.node"

    def __init__(self, known_nodes: dict[str, Any]) -> None:
        self._known_nodes = known_nodes

    def received_announce(
        self,
        destination_hash: bytes,
        announced_identity: Any,
        app_data: bytes | None,
        announce_packet_hash: bytes | None = None,
    ) -> None:
        self._known_nodes[node_id(announced_identity)] = announced_identity


def _load_or_create_identity(path: Path) -> Any:
    if path.exists():
        return RNS.Identity.from_file(str(path))
    key = RNS.Identity()
    key.to_file(str(path))
    return key
