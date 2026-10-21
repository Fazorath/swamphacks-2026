from datetime import UTC, datetime, timedelta

from meshed_nodes import a_calm_day

from storm_shield.community_reading import CommunityReading, Position
from storm_shield.reading_store import ReadingStore


def test_a_reading_ages_on_this_nodes_own_clock() -> None:
    received_at = datetime(2026, 10, 16, 12, 0, tzinfo=UTC)
    reading = CommunityReading.from_measurements(
        node="garage", seq=1, position=Position(29.652, -82.324), readings=a_calm_day()
    )
    store = ReadingStore(history_seconds=120)
    store.record("garage", reading, received_at)
    [heard] = store.snapshot(received_at + timedelta(seconds=23)).nodes
    assert heard.age_s == 23.0


NOON = datetime(2026, 10, 16, 12, 0, tzinfo=UTC)


def _reading(seq: int) -> CommunityReading:
    return CommunityReading.from_measurements(
        node="garage", seq=seq, position=Position(29.652, -82.324), readings=a_calm_day()
    )


def _heard_seq(store: ReadingStore, now: datetime) -> int:
    [reading] = store.snapshot(now).recent["garage"][-1:]
    return reading.seq


def test_a_repeated_seq_is_ignored() -> None:
    store = ReadingStore(history_seconds=120)
    store.record("garage", _reading(5), NOON)
    store.record("garage", _reading(5), NOON + timedelta(seconds=3))
    [heard] = store.snapshot(NOON + timedelta(seconds=4)).nodes
    assert heard.age_s == 4.0


def test_an_older_seq_is_ignored_while_the_node_is_fresh() -> None:
    store = ReadingStore(history_seconds=120)
    store.record("garage", _reading(5), NOON)
    store.record("garage", _reading(4), NOON + timedelta(seconds=15))
    assert _heard_seq(store, NOON + timedelta(seconds=15)) == 5


def test_a_node_silent_past_the_stale_window_is_heard_again_with_a_lower_seq() -> None:
    store = ReadingStore(history_seconds=120)
    store.record("garage", _reading(412), NOON)
    store.record("garage", _reading(0), NOON + timedelta(seconds=16))
    assert _heard_seq(store, NOON + timedelta(seconds=16)) == 0


def test_an_ignored_reading_does_not_keep_the_node_fresh() -> None:
    store = ReadingStore(history_seconds=120)
    store.record("garage", _reading(412), NOON)
    store.record("garage", _reading(0), NOON + timedelta(seconds=10))
    store.record("garage", _reading(1), NOON + timedelta(seconds=16))
    assert _heard_seq(store, NOON + timedelta(seconds=16)) == 1
