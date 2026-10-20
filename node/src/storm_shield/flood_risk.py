import logging
from collections.abc import Callable, Collection
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel

from storm_shield.community_reading import CommunityReading

# Tuned for a mountain river: the Bhote Koshi replay's calm water is 0.6 to 2.1 m and its calm
# pressure 1002 to 1008 hPa, so nothing below counts those as a flood. Change them here only.
# The 6 m High level is the reported Syabrubesi warning level (danger 9 m); the Elevated level, the
# rise sizes and the pressure are reconstructed, as are the replay's own water values.
HISTORY_WINDOW_SECONDS = 120
WATER_ELEVATED_CM = 300
WATER_HIGH_CM = 600
WATER_RISING_CM = 50  # gained across the history window, above the replay's calm drift
SURGE_RISE_CM = 300  # gained within SURGE_WINDOW_SECONDS, High before any fixed level is reached
SURGE_WINDOW_SECONDS = 60
RAIN_ELEVATED_MMH = 10
RAIN_HIGH_MMH = 25  # High only while water is also rising
SOIL_RISING_POINTS = 3  # gained across the history window
STORM_PRESSURE_HPA = 1000  # the replay never goes below 1002; the 2026 flood was not a storm

# The unit each kind this Rule set reads is sent in. Any other kind is ignored; a known kind in
# another unit is ignored too, since reading its number as if it were in this unit would be wrong.
WATER_LEVEL, WATER_UNIT = "water_level", "m"
RAIN_RATE, RAIN_UNIT = "rain_rate", "mm/h"
SOIL_MOISTURE, SOIL_UNIT = "soil_moisture", "%"
AIR_PRESSURE, PRESSURE_UNIT = "air_pressure", "hPa"

logger = logging.getLogger(__name__)
# So a Node that keeps sending the wrong unit fills the log once, not every few seconds.
_logged_unit_mismatches: set[tuple[str, str, str]] = set()

NodeLevel = Literal["elevated", "high"]
FloodRiskLevel = Literal["low", "elevated", "high"]
ReasonCode = Literal[
    "water_surge", "water_high", "water_rising", "rain_heavy", "pressure_falling", "raining"
]


class Reason(BaseModel):
    code: ReasonCode
    nodes: int
    value: float
    seconds: int | None = None  # only a Surge says how long the rise took


class StormSignal(BaseModel):
    on: bool
    nodes: int
    pressure_hpa: float | None


class FloodRisk(BaseModel):
    level: FloodRiskLevel | None
    reasons: list[Reason]
    storm_signal: StormSignal
    nodes: dict[str, NodeLevel | None]
    surged: list[str]  # ids of the Nodes whose water is surging now


@dataclass
class _NodeView:
    """What one Node's recent readings say, before comparing it with the other Nodes.

    A kind the Node never sent is None (or no gain), so it takes no part in any rule.
    """

    water_cm: float | None
    water_gain_cm: float
    surge_rise_cm: float
    surge_seconds: int
    rain_mmh: float | None
    soil_gain_points: float
    pressure_hpa: float | None

    @classmethod
    def of(cls, node: str, readings: list[CommunityReading]) -> "_NodeView":
        water = _series(node, readings, WATER_LEVEL, WATER_UNIT)
        rain = _series(node, readings, RAIN_RATE, RAIN_UNIT)
        soil = _series(node, readings, SOIL_MOISTURE, SOIL_UNIT)
        pressure = _series(node, readings, AIR_PRESSURE, PRESSURE_UNIT)
        newest_water_t, newest_water = water[-1] if water else (0, 0.0)
        # The Surge window counts in the sender's own timestamps, so a slow rise cannot pass for
        # one just because its readings arrived together.
        in_surge_window = [w for w in water if newest_water_t - w[0] <= SURGE_WINDOW_SECONDS]
        lowest_t, lowest = min(in_surge_window, key=lambda w: w[1], default=(0, 0.0))
        # With a single reading there is no trend, so nothing is rising.
        return cls(
            water_cm=newest_water * 100 if water else None,
            water_gain_cm=(newest_water - water[0][1]) * 100 if water else 0.0,
            surge_rise_cm=round((newest_water - lowest) * 100, 1) if water else 0.0,
            surge_seconds=newest_water_t - lowest_t if water else 0,
            rain_mmh=rain[-1][1] if rain else None,
            soil_gain_points=soil[-1][1] - soil[0][1] if soil else 0.0,
            pressure_hpa=pressure[-1][1] if pressure else None,
        )

    @property
    def surging(self) -> bool:
        return self.surge_rise_cm >= SURGE_RISE_CM

    @property
    def water_rising(self) -> bool:
        return self.water_gain_cm >= WATER_RISING_CM

    @property
    def soil_rising(self) -> bool:
        return self.soil_gain_points >= SOIL_RISING_POINTS

    @property
    def level(self) -> NodeLevel | None:
        if (
            self.surging
            or _reaches(self.water_cm, WATER_HIGH_CM)
            or (_reaches(self.rain_mmh, RAIN_HIGH_MMH) and self.water_rising)
        ):
            return "high"
        if _reaches(self.water_cm, WATER_ELEVATED_CM) or _reaches(self.rain_mmh, RAIN_ELEVATED_MMH):
            return "elevated"
        return "elevated" if self.water_rising else None


def _reaches(value: float | None, limit: float) -> bool:
    return value is not None and value >= limit


def _series(
    node: str, readings: list[CommunityReading], kind: str, unit: str
) -> list[tuple[int, float]]:
    """Each reading's (sender timestamp, value) for `kind`, oldest first, in the unit this Rule set reads."""
    series = []
    for reading in readings:
        for measured_kind, value, measured_unit in reading.m:
            if measured_kind != kind:
                continue
            if measured_unit == unit:
                series.append((reading.t, value))
            elif (node, kind, measured_unit) not in _logged_unit_mismatches:
                _logged_unit_mismatches.add((node, kind, measured_unit))
                logger.warning(
                    "ignoring %s from Node %s: sent in %s, the flood-warning rules read %s",
                    kind,
                    node,
                    measured_unit,
                    unit,
                )
    return series


def flood_risk(
    recent: dict[str, list[CommunityReading]], registered_ids: Collection[str]
) -> FloodRisk:
    """Flood Risk for everything this Node can see, from each counted Node's recent readings."""
    views = {
        node: _NodeView.of(node, readings)
        for node, readings in recent.items()
        if _counts(node, registered_ids)
    }
    node_levels = {node: view.level for node, view in views.items()}

    low_pressure = [
        view
        for view in views.values()
        if view.pressure_hpa is not None and view.pressure_hpa < STORM_PRESSURE_HPA
    ]
    storm_on = bool(low_pressure) and len(low_pressure) * 2 >= len(views)
    storm = low_pressure if storm_on else []
    soil_rising = [view for view in views.values() if view.soil_rising]
    # One odd sensor cannot make it rain, but a lone Node is believed on its own.
    needed = min(2, len(views))
    raining = bool(views) and len(soil_rising) >= needed

    surged = {node: view for node, view in views.items() if view.surging}

    reasons = [
        reason
        for reason in [
            _surge_reason(list(surged.values())),
            _reason(
                "water_high",
                max,
                [
                    v.water_cm
                    for v in views.values()
                    if v.water_cm is not None and v.water_cm >= WATER_ELEVATED_CM
                ],
            ),
            _reason(
                "water_rising", max, [v.water_gain_cm for v in views.values() if v.water_rising]
            ),
            _reason(
                "rain_heavy",
                max,
                [
                    v.rain_mmh
                    for v in views.values()
                    if v.rain_mmh is not None and v.rain_mmh >= RAIN_ELEVATED_MMH
                ],
            ),
            _reason(
                "pressure_falling",
                min,
                [v.pressure_hpa for v in storm if v.pressure_hpa is not None],
            ),
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
            pressure_hpa=min(
                (v.pressure_hpa for v in storm if v.pressure_hpa is not None), default=None
            ),
        ),
        nodes=node_levels,
        surged=sorted(surged),
    )


def _counts(node: str, registered_ids: Collection[str]) -> bool:
    # The one place that decides whether a Node's readings count. Silent Nodes never reach it:
    # the reading store leaves them out of `recent` (0021).
    return node in registered_ids


def _surge_reason(surging: list[_NodeView]) -> Reason | None:
    if not surging:
        return None
    biggest = max(surging, key=lambda view: view.surge_rise_cm)
    return Reason(
        code="water_surge",
        nodes=len(surging),
        value=biggest.surge_rise_cm,
        seconds=biggest.surge_seconds,
    )


def _reason(
    code: ReasonCode, most_telling: Callable[[list[float]], float], values: list[float]
) -> Reason | None:
    return (
        Reason(code=code, nodes=len(values), value=round(most_telling(values), 1))
        if values
        else None
    )
