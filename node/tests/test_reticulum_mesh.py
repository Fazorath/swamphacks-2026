import stat
from pathlib import Path

import pytest
import RNS

from storm_shield.community_reading import CommunityReading
from storm_shield.replay import ReplayClockMessage
from storm_shield.reticulum_mesh import (
    SIGNATURE_LENGTH,
    load_or_create_identity,
    node_id,
    sign,
    verify,
)
from storm_shield.shelter_status import ShelterStatus


def _reading(node: str) -> CommunityReading:
    return CommunityReading(
        node=node,
        seq=1_760_650_928,
        t=1_760_650_928,
        sim=True,
        pos=(29.652, -82.324),
        pressure_hpa=991.2,
        water_m=0.84,
        rain_mmh=14.8,
        soil_pct=91,
    )


def test_a_reading_from_an_announced_node_verifies() -> None:
    porch = RNS.Identity()
    reading = _reading(node_id(porch))
    assert verify(sign(porch, reading), {node_id(porch): porch}) == (node_id(porch), reading)


def test_a_reading_from_a_node_not_yet_announced_is_dropped() -> None:
    porch = RNS.Identity()
    assert verify(sign(porch, _reading(node_id(porch))), {}) is None


def test_a_reading_signed_by_someone_else_is_dropped() -> None:
    porch, intruder = RNS.Identity(), RNS.Identity()
    claims_to_be_porch = sign(intruder, _reading(node_id(porch)))
    assert verify(claims_to_be_porch, {node_id(porch): porch}) is None


def test_a_reading_changed_in_transit_is_dropped() -> None:
    porch = RNS.Identity()
    packet = bytearray(sign(porch, _reading(node_id(porch))))
    packet[-3] ^= 1
    assert verify(bytes(packet), {node_id(porch): porch}) is None


def test_garbage_is_dropped() -> None:
    assert verify(b"", {}) is None
    assert verify(b"x" * (SIGNATURE_LENGTH + 5), {}) is None


def test_a_signed_reading_fits_one_unencrypted_packet() -> None:
    porch = RNS.Identity()
    assert len(sign(porch, _reading(node_id(porch)))) <= RNS.Packet.PLAIN_MDU


def _shelters(ver: int = 3) -> ShelterStatus:
    return ShelterStatus(ver=ver, t=1_760_650_928, open=["sr-center", "hs-gym"])


def test_shelter_status_signed_by_the_hub_verifies_as_from_the_hub() -> None:
    hub = RNS.Identity()
    known = {node_id(hub): hub}
    assert verify(sign(hub, _shelters()), known, node_id(hub)) == (node_id(hub), _shelters())


def test_shelter_status_signed_by_another_node_is_dropped() -> None:
    hub, rogue = RNS.Identity(), RNS.Identity()
    known = {node_id(hub): hub, node_id(rogue): rogue}
    assert verify(sign(rogue, _shelters()), known, node_id(hub)) is None


def test_shelter_status_is_dropped_when_no_hub_is_configured() -> None:
    hub = RNS.Identity()
    assert verify(sign(hub, _shelters()), {node_id(hub): hub}) is None


def test_shelter_status_is_dropped_before_the_hub_has_announced() -> None:
    hub = RNS.Identity()
    assert verify(sign(hub, _shelters()), {}, node_id(hub)) is None


def test_a_message_kind_this_node_does_not_know_is_ignored() -> None:
    hub = RNS.Identity()
    body = b'{"v": 1, "kind": "from-the-future", "t": 1}'
    packet = bytes(hub.sign(body)) + body
    assert verify(packet, {node_id(hub): hub}, node_id(hub)) is None


def test_a_signed_shelter_status_fits_one_unencrypted_packet() -> None:
    hub = RNS.Identity()
    twelve = ShelterStatus(ver=3, t=1_760_650_928, open=[f"shelter-{n:02}" for n in range(12)])
    assert len(sign(hub, twelve)) <= RNS.Packet.PLAIN_MDU


def test_the_event_clock_signed_by_the_hub_verifies_and_one_signed_by_another_node_is_dropped() -> (
    None
):
    hub, rogue = RNS.Identity(), RNS.Identity()
    known = {node_id(hub): hub, node_id(rogue): rogue}
    clock = ReplayClockMessage(state="playing", event_t=1_787_712_300, rate=30)
    assert verify(sign(hub, clock), known, node_id(hub)) == (node_id(hub), clock)
    assert verify(sign(rogue, clock), known, node_id(hub)) is None
    assert len(sign(hub, clock)) <= RNS.Packet.PLAIN_MDU


def test_a_node_keeps_its_identity_in_a_file_only_its_owner_can_read(tmp_path: Path) -> None:
    path = tmp_path / "identity"
    first = load_or_create_identity(path)
    assert stat.S_IMODE(path.stat().st_mode) == 0o600
    assert node_id(load_or_create_identity(path)) == node_id(first)


def test_an_identity_file_readable_by_everyone_is_locked_down_on_load(tmp_path: Path) -> None:
    path = tmp_path / "identity"
    load_or_create_identity(path)
    path.chmod(0o644)
    load_or_create_identity(path)
    assert stat.S_IMODE(path.stat().st_mode) == 0o600


def test_a_damaged_identity_file_stops_the_node_and_names_the_file(tmp_path: Path) -> None:
    path = tmp_path / "identity"
    path.write_bytes(b"cut short")
    with pytest.raises(ValueError, match="identity.*Delete it"):
        load_or_create_identity(path)
