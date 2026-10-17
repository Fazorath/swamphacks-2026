from datetime import UTC, datetime, timedelta

from storm_shield.community_reading import CommunityReading
from storm_shield.reading_store import ReadingStore
from storm_shield.scenario import Scenario


def test_a_reading_ages_on_this_nodes_own_clock() -> None:
    received_at = datetime(2026, 10, 16, 12, 0, tzinfo=UTC)
    reading = CommunityReading.from_measurements(
        node="garage", seq=1, position=(29.652, -82.324), readings=Scenario().readings()
    )
    store = ReadingStore(history_seconds=120)
    store.record("garage", reading, received_at)
    [heard] = store.snapshot(received_at + timedelta(seconds=23)).nodes
    assert heard.age_s == 23.0
