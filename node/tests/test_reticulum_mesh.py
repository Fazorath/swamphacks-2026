import RNS

from storm_shield.community_reading import CommunityReading
from storm_shield.reticulum_mesh import SIGNATURE_LENGTH, node_id, sign, verify


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
    assert verify(sign(porch, reading), {node_id(porch): porch}) == reading


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
