import pytest

from storm_shield.community_reading import CommunityReading, Position
from storm_shield.mesh import InMemoryNetwork
from storm_shield.scenario import Scenario


def _reading(node: str) -> CommunityReading:
    return CommunityReading.from_measurements(
        node=node, seq=1, position=Position(0, 0), readings=Scenario().readings()
    )


def test_a_node_that_has_left_can_no_longer_publish_to_the_others() -> None:
    network = InMemoryNetwork()
    leaver = network.join("leaver")
    listener = network.join("listener")
    heard: list[object] = []
    listener.subscribe(lambda sender, message: heard.append(message))

    network.leave("leaver")
    leaver.publish(_reading("leaver"))

    assert heard == []


def test_joining_under_a_name_already_taken_fails_loudly() -> None:
    network = InMemoryNetwork()
    network.join("porch")
    with pytest.raises(ValueError, match="porch"):
        network.join("porch")


def test_a_node_that_left_may_join_again_under_its_name() -> None:
    network = InMemoryNetwork()
    network.join("porch")
    network.leave("porch")
    returning = network.join("porch")
    listener = network.join("listener")
    heard: list[object] = []
    listener.subscribe(lambda sender, message: heard.append(message))

    returning.publish(_reading("porch"))

    assert len(heard) == 1


# One degree of latitude is about 111 km, so these are about 0.9, 1.8 and 2.7 km from the origin.
NEAR = Position(0.008, 0)
FAR = Position(0.016, 0)
FARTHER = Position(0.024, 0)


class _Hub:
    """A Hub and a Sensor on a network, to see whether the Sensor's reading reaches the Hub."""

    def __init__(self, network: InMemoryNetwork, sensor_at: Position) -> None:
        self.network = network
        self.heard: list[object] = []
        network.join("hub", position=Position(0, 0)).subscribe(
            lambda sender, message: self.heard.append(message)
        )
        self.sensor = network.join("sensor", "hub", position=sensor_at)

    def sensor_is_heard(self) -> bool:
        """Whether the Hub hears the Sensor send one more reading."""
        before = len(self.heard)
        self.sensor.publish(_reading("sensor"))
        return len(self.heard) > before


def test_a_sensor_out_of_range_of_everyone_is_never_heard_by_the_hub() -> None:
    hub = _Hub(InMemoryNetwork(), sensor_at=FAR)

    assert not hub.sensor_is_heard()


def test_a_sensor_out_of_the_hubs_range_is_heard_through_a_relay_in_range_of_both() -> None:
    hub = _Hub(InMemoryNetwork(), sensor_at=FAR)
    hub.network.join("relay", position=NEAR)

    assert hub.sensor_is_heard()


def test_a_message_hops_through_a_chain_of_relays() -> None:
    hub = _Hub(InMemoryNetwork(), sensor_at=FARTHER)
    hub.network.join("first", position=NEAR)
    hub.network.join("second", position=FAR)

    assert hub.sensor_is_heard()


def test_a_relay_that_is_itself_out_of_reach_of_the_sensor_does_not_help() -> None:
    hub = _Hub(InMemoryNetwork(), sensor_at=FARTHER)
    hub.network.join("relay", position=NEAR)

    assert not hub.sensor_is_heard()


def test_moving_a_sensor_into_range_makes_it_heard_on_the_next_message() -> None:
    hub = _Hub(InMemoryNetwork(), sensor_at=FAR)
    assert not hub.sensor_is_heard()

    hub.network.move("sensor", NEAR)

    assert hub.sensor_is_heard()


def test_moving_a_relay_away_cuts_the_sensor_off() -> None:
    hub = _Hub(InMemoryNetwork(), sensor_at=FAR)
    hub.network.join("relay", position=NEAR)
    assert hub.sensor_is_heard()

    hub.network.move("relay", FARTHER)

    assert not hub.sensor_is_heard()


def test_shrinking_the_range_cuts_a_sensor_off() -> None:
    hub = _Hub(InMemoryNetwork(), sensor_at=NEAR)
    assert hub.sensor_is_heard()

    hub.network.set_radio_range(500)

    assert not hub.sensor_is_heard()


def test_widening_the_range_brings_a_far_sensor_in() -> None:
    hub = _Hub(InMemoryNetwork(), sensor_at=FAR)
    assert not hub.sensor_is_heard()

    hub.network.set_radio_range(3000)

    assert hub.sensor_is_heard()


def test_the_default_range_is_one_kilometre() -> None:
    assert _Hub(InMemoryNetwork(), sensor_at=NEAR).sensor_is_heard()
    assert not _Hub(InMemoryNetwork(), sensor_at=FAR).sensor_is_heard()


def test_an_unlimited_range_reaches_every_node_wherever_it_is() -> None:
    hub = _Hub(InMemoryNetwork(radio_range_m=None), sensor_at=Position(45, 90))

    assert hub.sensor_is_heard()
