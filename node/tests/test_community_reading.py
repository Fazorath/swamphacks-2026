import json
import math
from datetime import UTC, datetime

from meshed_nodes import a_calm_day

from storm_shield.community_reading import CommunityReading, Position, Reading, fuzz_position
from storm_shield.mesh import decode_message


def _a_reading() -> CommunityReading:
    return CommunityReading.from_measurements(
        node="91c2e0b47a3d",
        seq=412,
        position=Position(29.652, -82.324),
        readings=a_calm_day(),
        river_km=-12.2,
    )


def test_a_community_reading_fits_one_reticulum_packet() -> None:
    assert len(_a_reading().model_dump_json().encode()) < 350


def test_a_reading_with_a_kind_the_rules_do_not_know_still_fits_one_packet() -> None:
    reading = CommunityReading.from_measurements(
        node="91c2e0b47a3d",
        seq=412,
        position=Position(29.652, -82.324),
        readings=[
            Reading(kind=kind, value=1234.567, unit=unit, timestamp=datetime.now(UTC))
            for kind, unit in [
                ("water_level", "m"),
                ("rain_rate", "mm/h"),
                ("soil_moisture", "%"),
                ("air_pressure", "hPa"),
                ("air_temperature", "degC"),
                ("wind_speed", "km/h"),
            ]
        ],
    )
    assert len(reading.model_dump_json().encode()) < 350


def test_a_community_reading_carries_the_agreed_fields() -> None:
    reading = _a_reading()
    assert set(reading.model_dump()) == {
        "v",
        "kind",
        "node",
        "seq",
        "t",
        "sim",
        "pos",
        "river_km",
        "m",
    }
    assert reading.v == 2
    assert reading.river_km == -12.2
    assert reading.t <= datetime.now(UTC).timestamp()


def test_measurements_travel_as_kind_value_unit_triples_and_come_back_unchanged() -> None:
    sent = _a_reading()

    body = json.loads(sent.model_dump_json())
    assert {kind for kind, _, _ in body["m"]} == {
        "air_pressure",
        "rain_rate",
        "soil_moisture",
        "water_level",
    }
    assert {kind: unit for kind, _, unit in body["m"]} == {
        "air_pressure": "hPa",
        "rain_rate": "mm/h",
        "soil_moisture": "%",
        "water_level": "m",
    }

    heard = decode_message(sent.model_dump_json().encode())
    assert heard == sent
    assert isinstance(heard, CommunityReading)
    assert heard.m == sent.m


def test_a_version_1_reading_is_dropped() -> None:
    body = json.loads(_a_reading().model_dump_json())
    body.update(v=1, pressure_hpa=1015, water_m=0.2, rain_mmh=0, soil_pct=30)
    del body["m"]

    assert decode_message(json.dumps(body).encode()) is None


def test_positions_snap_to_a_grid_of_about_200_metres() -> None:
    assert fuzz_position(29.6521, -82.3249) == (29.652, -82.324)
    assert fuzz_position(29.6529, -82.3239) == (29.652, -82.324)


def test_a_fuzzed_position_stays_within_200_metres_of_the_real_one() -> None:
    metres_per_degree = 111_320
    for latitude, longitude in [(29.6516, -82.3248), (29.6531, -82.3239), (29.6499, -82.3262)]:
        fuzzed_latitude, fuzzed_longitude = fuzz_position(latitude, longitude)
        north_south = (fuzzed_latitude - latitude) * metres_per_degree
        east_west = (
            (fuzzed_longitude - longitude) * metres_per_degree * math.cos(math.radians(latitude))
        )
        assert (fuzzed_latitude, fuzzed_longitude) != (latitude, longitude)
        assert math.hypot(north_south, east_west) <= 200
