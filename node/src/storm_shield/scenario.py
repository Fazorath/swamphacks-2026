import random
from datetime import UTC, datetime
from typing import Literal, get_args

from storm_shield.community_reading import Reading

ScenarioStep = Literal["normal_day", "pressure_drop", "rain", "water_rising"]

SCENARIO_STEPS: list[ScenarioStep] = list(get_args(ScenarioStep))

# Base values per step: air pressure hPa, rain rate mm/h, water level m, soil moisture %. Water and
# pressure are scaled to the levels in flood_risk.py. The last step is High from heavy rain on
# rising water and stays under the Surge size, so a quick run of steps is not a Surge.
_STEP_VALUES: dict[ScenarioStep, dict[str, float]] = {
    "normal_day": {"air_pressure": 1015, "rain_rate": 0, "water_level": 1.0, "soil_moisture": 30},
    "pressure_drop": {"air_pressure": 990, "rain_rate": 0, "water_level": 1.0, "soil_moisture": 32},
    "rain": {"air_pressure": 985, "rain_rate": 12, "water_level": 3.5, "soil_moisture": 55},
    "water_rising": {"air_pressure": 980, "rain_rate": 30, "water_level": 3.9, "soil_moisture": 85},
}

_UNITS: dict[str, str] = {
    "air_pressure": "hPa",
    "rain_rate": "mm/h",
    "water_level": "m",
    "soil_moisture": "%",
}

# Water is in metres, so its jitter and its decimals are 100 times finer than the other kinds'.
_JITTER: dict[str, float] = {"water_level": 0.005}
_DECIMALS: dict[str, int] = {"water_level": 3}


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
                value=_jittered(kind, base),
                unit=_UNITS[kind],
                timestamp=now,
            )
            for kind, base in _STEP_VALUES[self.step_name].items()
        ]


def _jittered(kind: str, base: float) -> float:
    jitter = _JITTER.get(kind, 0.5)
    return round(max(0.0, base + random.uniform(-jitter, jitter)), _DECIMALS.get(kind, 1))
