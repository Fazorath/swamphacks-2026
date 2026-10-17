from storm_shield.community_reading import CommunityReading
from storm_shield.mesh import InMemoryNetwork, Message
from storm_shield.shelter_status import ShelterStatus

HUB = "hub-node"


def _status(ver: int = 1) -> ShelterStatus:
    return ShelterStatus(ver=ver, t=1_760_650_928, open=["sr-center"])


def _reading(node: str) -> CommunityReading:
    return CommunityReading(
        node=node,
        seq=1,
        t=1_760_650_928,
        sim=True,
        pos=(29.652, -82.324),
        pressure_hpa=1015,
        water_m=0.2,
        rain_mmh=0,
        soil_pct=30,
    )


def _listen(network: InMemoryNetwork, name: str, hub_identity: str) -> list[tuple[str, Message]]:
    heard: list[tuple[str, Message]] = []
    mesh = network.join(name, hub_identity)
    mesh.subscribe(lambda sender, message: heard.append((sender, message)))
    return heard


def test_shelter_status_from_the_configured_hub_is_delivered_with_the_hub_as_sender() -> None:
    network = InMemoryNetwork()
    heard = _listen(network, "porch", HUB)
    network.join(HUB).publish(_status())
    assert heard == [(HUB, _status())]


def test_shelter_status_from_any_other_node_is_ignored() -> None:
    network = InMemoryNetwork()
    heard = _listen(network, "porch", HUB)
    network.join("rogue").publish(_status())
    assert heard == []


def test_a_node_with_no_hub_identity_ignores_shelter_status() -> None:
    network = InMemoryNetwork()
    heard = _listen(network, "porch", "")
    network.join(HUB).publish(_status())
    assert heard == []


def test_community_readings_still_flow_next_to_shelter_status() -> None:
    network = InMemoryNetwork()
    heard = _listen(network, "porch", HUB)
    sender = network.join("garage")
    sender.publish(_reading("garage"))
    sender.publish(_status())
    assert heard == [("garage", _reading("garage"))]
