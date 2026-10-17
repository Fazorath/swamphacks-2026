from datetime import UTC, datetime, timedelta

from storm_shield.community_reading import CommunityReading
from storm_shield.reading_store import ReadingStore
from storm_shield.scenario import Scenario


def test_a_reading_ages_on_this_nodes_own_clock() -> None:
    received_at = datetime(2026, 10, 16, 12, 0, tzinfo=UTC)
    reading = CommunityReading.from_measurements(
        node="garage", seq=1, position=(29.652, -82.324), readings=Scenario().readings()
    )
    store = ReadingStore()
    store.record("garage", reading, received_at)
    ages = {r.age_s for r in store.latest(received_at + timedelta(seconds=23))}
    assert ages == {23.0}
