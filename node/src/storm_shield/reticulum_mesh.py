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
from storm_shield.settings import ReticulumInterface

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


def reticulum_config(interface: ReticulumInterface, loopback_slot: int) -> str:
    return f"""[reticulum]
  enable_transport = False
  share_instance = No

[logging]
  loglevel = 2

[interfaces]
{_interface_config(interface, loopback_slot)}
"""


def _interface_config(interface: ReticulumInterface, loopback_slot: int) -> str:
    if interface == "auto":
        return "  [[Wi-Fi]]\n    type = AutoInterface\n    enabled = yes"
    listen = (
        "  [[Listen]]\n    type = TCPServerInterface\n    enabled = yes\n"
        f"    listen_ip = 127.0.0.1\n    listen_port = {LOOPBACK_BASE_PORT + loopback_slot}"
    )
    dial_lower_slots = [
        f"  [[Slot {slot}]]\n    type = TCPClientInterface\n    enabled = yes\n"
        f"    target_host = 127.0.0.1\n    target_port = {LOOPBACK_BASE_PORT + slot}"
        for slot in range(loopback_slot)
    ]
    return "\n".join([listen, *dial_lower_slots])


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
    if sender is None or not sender.validate(signature, body):
        return None
    return reading


class ReticulumMesh:
    """Readings as signed, unencrypted broadcast packets; Nodes learn each other from announces."""

    def __init__(self, data_dir: Path, interface: ReticulumInterface, loopback_slot: int) -> None:
        config_dir = data_dir / "reticulum"
        config_dir.mkdir(parents=True, exist_ok=True)
        # Rewritten on every start so the settings, not a stale file, decide the interface.
        (config_dir / "config").write_text(reticulum_config(interface, loopback_slot))
        RNS.Reticulum(configdir=str(config_dir), loglevel=RNS.LOG_WARNING)

        self._key = _load_or_create_identity(data_dir / "identity")
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
            listener(reading.node, reading)

    def _announce_forever(self) -> None:
        while True:
            self._announce_destination.announce()
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
