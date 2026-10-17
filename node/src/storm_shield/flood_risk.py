from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel

from storm_shield.community_reading import CommunityReading

# First-pass thresholds, meant to be retuned against real readings. Change them here only.
HISTORY_WINDOW_SECONDS = 120
WATER_ELEVATED_CM = 30
WATER_HIGH_CM = 60
WATER_RISING_CM = 10  # gained across the history window
RAIN_ELEVATED_MMH = 10
RAIN_HIGH_MMH = 25  # High only while water is also rising
SOIL_RISING_POINTS = 3  # gained across the history window
STORM_PRESSURE_HPA = 1009

NodeLevel = Literal["elevated", "high"]
FloodRiskLevel = Literal["low", "elevated", "high"]
ReasonCode = Literal["water_high", "water_rising", "rain_heavy", "pressure_falling", "raining"]


class Reason(BaseModel):
    code: ReasonCode
    nodes: int
    value: float


class StormSignal(BaseModel):
    on: bool
    nodes: int
    pressure_hpa: float | None


class FloodRisk(BaseModel):
    level: FloodRiskLevel | None
    reasons: list[Reason]
    storm_signal: StormSignal
    nodes: dict[str, NodeLevel | None]


@dataclass
class _NodeView:
    """What one Node's recent readings say, before comparing it with the other Nodes."""

    water_cm: float
    water_gain_cm: float
    rain_mmh: float
    soil_gain_points: float
    pressure_hpa: float

    @classmethod
    def of(cls, readings: list[CommunityReading]) -> "_NodeView":
        newest, oldest = readings[-1], readings[0]
        # With a single reading there is no trend, so nothing is rising.
        return cls(
            water_cm=newest.water_m * 100,
            water_gain_cm=(newest.water_m - oldest.water_m) * 100,
            rain_mmh=newest.rain_mmh,
            soil_gain_points=newest.soil_pct - oldest.soil_pct,
            pressure_hpa=newest.pressure_hpa,
        )

    @property
    def water_rising(self) -> bool:
        return self.water_gain_cm >= WATER_RISING_CM

    @property
    def soil_rising(self) -> bool:
        return self.soil_gain_points >= SOIL_RISING_POINTS

    @property
    def level(self) -> NodeLevel | None:
        if self.water_cm >= WATER_HIGH_CM or (self.rain_mmh >= RAIN_HIGH_MMH and self.water_rising):
            return "high"
        if self.water_cm >= WATER_ELEVATED_CM or self.rain_mmh >= RAIN_ELEVATED_MMH:
            return "elevated"
        return "elevated" if self.water_rising else None


def flood_risk(recent: dict[str, list[CommunityReading]]) -> FloodRisk:
    """Flood Risk for everything this Node can see, from each counted Node's recent readings."""
    views = {
        node: _NodeView.of(readings) for node, readings in recent.items() if _counts(node, readings)
    }
    node_levels = {node: view.level for node, view in views.items()}

    low_pressure = [view for view in views.values() if view.pressure_hpa < STORM_PRESSURE_HPA]
    storm_on = bool(low_pressure) and len(low_pressure) * 2 >= len(views)
    storm = low_pressure if storm_on else []
    soil_rising = [view for view in views.values() if view.soil_rising]
    # One odd sensor cannot make it rain, but a lone Node is believed on its own.
    needed = min(2, len(views))
    raining = bool(views) and len(soil_rising) >= needed

    reasons = [
        reason
        for reason in [
            _reason(
                "water_high",
                max,
                [v.water_cm for v in views.values() if v.water_cm >= WATER_ELEVATED_CM],
            ),
            _reason(
                "water_rising", max, [v.water_gain_cm for v in views.values() if v.water_rising]
            ),
            _reason(
                "rain_heavy",
                max,
                [v.rain_mmh for v in views.values() if v.rain_mmh >= RAIN_ELEVATED_MMH],
            ),
            _reason("pressure_falling", min, [v.pressure_hpa for v in storm]),
            _reason("raining", max, [v.soil_gain_points for v in soil_rising] if raining else []),
        ]
        if reason
    ]

    own_levels = set(node_levels.values())
    headline: FloodRiskLevel | None = None
    if "high" in own_levels:
        headline = "high"
    elif "elevated" in own_levels:
        headline = "elevated"
    elif raining or storm_on:
        headline = "low"
    return FloodRisk(
        level=headline,
        reasons=reasons,
        storm_signal=StormSignal(
            on=storm_on,
            nodes=len(storm),
            pressure_hpa=min((v.pressure_hpa for v in storm), default=None),
        ),
        nodes=node_levels,
    )


def _counts(node: str, readings: list[CommunityReading]) -> bool:
    # The one place that decides whether a Node's readings count. Only registered Nodes (0012)
    # and Nodes not silent for 60 s (0021) will count, and they will change this check alone.
    return True


def _reason(
    code: ReasonCode, most_telling: Callable[[list[float]], float], values: list[float]
) -> Reason | None:
    return Reason(code=code, nodes=len(values), value=most_telling(values)) if values else None
