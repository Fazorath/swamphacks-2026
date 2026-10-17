import random
import time

from pydantic import BaseModel

SCENARIO_STEPS = ["normal_day", "pressure_drop", "rain", "water_rising"]

# Base values per step: pressure hPa, rain rate mm/h, water level m, soil moisture %.
_STEP_VALUES: dict[str, tuple[float, float, float, float]] = {
    "normal_day": (1015, 0, 0.20, 30),
    "pressure_drop": (1002, 0, 0.20, 32),
    "rain": (998, 12, 0.35, 55),
    "water_rising": (995, 30, 0.90, 85),
}


class Reading(BaseModel):
    """The measurements of a Community Reading, in the field names and units of wire-formats.md."""

    t: int
    sim: bool = True
    pressure_hpa: float
    water_m: float
    rain_mmh: float
    soil_pct: int


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

    def reading(self) -> Reading:
        pressure, rain, water, soil = _STEP_VALUES[self.step_name]
        # Small jitter so the live readings visibly update at a steady cadence.
        return Reading(
            t=int(time.time()),
            pressure_hpa=round(pressure + random.uniform(-0.5, 0.5), 1),
            water_m=round(max(0.0, water + random.uniform(-0.005, 0.005)), 2),
            rain_mmh=round(max(0.0, rain + random.uniform(-0.5, 0.5)), 1),
            soil_pct=round(soil + random.uniform(-0.5, 0.5)),
        )
