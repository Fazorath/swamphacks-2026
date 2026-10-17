import RNS

from storm_shield.community_reading import CommunityReading
from storm_shield.reticulum_mesh import SIGNATURE_LENGTH, node_id, sign, verify
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
