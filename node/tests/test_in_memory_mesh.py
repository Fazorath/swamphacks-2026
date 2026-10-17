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
