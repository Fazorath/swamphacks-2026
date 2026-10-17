from datetime import UTC, datetime

from storm_shield.community_reading import CommunityReading, fuzz_position
from storm_shield.scenario import Scenario


def test_a_community_reading_fits_one_reticulum_packet() -> None:
    scenario = Scenario()
    for _ in range(3):
        scenario.step()
    reading = CommunityReading.from_measurements(
        node="91c2e0b47a3d", seq=412, position=(29.652, -82.324), readings=scenario.readings()
    )
    assert len(reading.model_dump_json().encode()) < 350


def test_a_community_reading_carries_the_agreed_fields() -> None:
    reading = CommunityReading.from_measurements(
        node="91c2e0b47a3d", seq=1, position=(29.652, -82.324), readings=Scenario().readings()
    )
    assert set(reading.model_dump()) == {
        "v",
        "kind",
        "node",
        "seq",
        "t",
        "sim",
        "pos",
        "pressure_hpa",
        "water_m",
        "rain_mmh",
        "soil_pct",
    }
    assert reading.t <= datetime.now(UTC).timestamp()


def test_positions_snap_to_a_grid_of_about_200_metres() -> None:
    assert fuzz_position(29.6521, -82.3249) == (29.652, -82.324)
    assert fuzz_position(29.6529, -82.3239) == (29.652, -82.324)
