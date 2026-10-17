import random
from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel

ReadingKind = Literal["pressure", "rain_rate", "water_level", "soil_moisture"]

SCENARIO_STEPS = ["normal_day", "pressure_drop", "rain", "water_rising"]

# Base values per step: pressure hPa, rain rate mm/h, water level cm, soil moisture %.
_STEP_VALUES: dict[str, dict[ReadingKind, float]] = {
    "normal_day": {"pressure": 1015, "rain_rate": 0, "water_level": 20, "soil_moisture": 30},
    "pressure_drop": {"pressure": 1002, "rain_rate": 0, "water_level": 20, "soil_moisture": 32},
    "rain": {"pressure": 998, "rain_rate": 12, "water_level": 35, "soil_moisture": 55},
    "water_rising": {"pressure": 995, "rain_rate": 30, "water_level": 90, "soil_moisture": 85},
}

_UNITS: dict[ReadingKind, str] = {
    "pressure": "hPa",
    "rain_rate": "mm/h",
    "water_level": "cm",
    "soil_moisture": "%",
}


class Reading(BaseModel):
    kind: ReadingKind
    value: float
    unit: str
    timestamp: datetime
    simulated: bool = True


class Scenario:
    def __init__(self) -> None:
        self._index = 0

    @property
    def step_name(self) -> str:
        return SCENARIO_STEPS[self._index]

    def step(self) -> None:
        self._index = min(self._index + 1, len(SCENARIO_STEPS) - 1)

    def reset(self) -> None:
        self._index = 0

    def readings(self) -> list[Reading]:
        now = datetime.now(UTC)
        return [
            Reading(
                kind=kind,
                # Small jitter so the live readings visibly update at a steady cadence.
                value=round(max(0.0, base + random.uniform(-0.5, 0.5)), 1),
                unit=_UNITS[kind],
                timestamp=now,
            )
            for kind, base in _STEP_VALUES[self.step_name].items()
        ]
