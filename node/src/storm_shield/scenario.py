import random
from datetime import UTC, datetime
from typing import Literal, get_args

from pydantic import BaseModel

ReadingKind = Literal["pressure", "rain_rate", "water_level", "soil_moisture"]

ScenarioStep = Literal["normal_day", "pressure_drop", "rain", "water_rising"]

SCENARIO_STEPS: list[ScenarioStep] = list(get_args(ScenarioStep))

# Base values per step: pressure hPa, rain rate mm/h, water level cm, soil moisture %. Water and
# pressure are scaled to the levels in flood_risk.py. The last step is High from heavy rain on
# rising water and stays under the Surge size, so a quick run of steps is not a Surge.
_STEP_VALUES: dict[ScenarioStep, dict[ReadingKind, float]] = {
    "normal_day": {"pressure": 1015, "rain_rate": 0, "water_level": 100, "soil_moisture": 30},
    "pressure_drop": {"pressure": 990, "rain_rate": 0, "water_level": 100, "soil_moisture": 32},
    "rain": {"pressure": 985, "rain_rate": 12, "water_level": 350, "soil_moisture": 55},
    "water_rising": {"pressure": 980, "rain_rate": 30, "water_level": 390, "soil_moisture": 85},
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
    def step_name(self) -> ScenarioStep:
        return SCENARIO_STEPS[self._index]

    def step(self) -> None:
        self._index = min(self._index + 1, len(SCENARIO_STEPS) - 1)

    def go_to(self, step_name: ScenarioStep) -> None:
        self._index = SCENARIO_STEPS.index(step_name)

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
