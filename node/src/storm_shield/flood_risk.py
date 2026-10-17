from collections import defaultdict
from typing import Literal

from pydantic import BaseModel

from storm_shield.community_reading import CommunityReading

# First-pass thresholds, tuned by eye against the Scenario. Change them here only.
COUNTING_WINDOW_SECONDS = 60  # a Node silent for longer stops counting (CONTEXT.md: Stale)
WATER_HIGH_CM = 60
WATER_RISING_CM = 5  # gained across the counting window
RAIN_HEAVY_MMH = 20
PRESSURE_FALLING_HPA = 3  # lost across the counting window

FloodRiskLevel = Literal["low", "elevated", "high"]
ReasonCode = Literal["water_high", "water_rising", "rain_heavy"]

_REASON_TEXT: dict[ReasonCode, str] = {
    "water_high": "water level high",
    "water_rising": "water level rising",
    "rain_heavy": "heavy rain",
}


class Reason(BaseModel):
    code: ReasonCode
    nodes: list[str]
    text: str


class StormSignal(BaseModel):
    falling: bool
    text: str


class FloodRisk(BaseModel):
    level: FloodRiskLevel
    reasons: list[Reason]
    storm_signal: StormSignal


def flood_risk(recent: dict[str, list[CommunityReading]]) -> FloodRisk:
    """Flood Risk for everything this Node can see, from each counted Node's recent readings."""
    nodes_by_reason: dict[ReasonCode, list[str]] = defaultdict(list)
    levels: list[FloodRiskLevel] = ["low"]
    pressure_falling: list[str] = []
    for node, readings in recent.items():
        reasons = _reasons(readings)
        for reason in reasons:
            nodes_by_reason[reason].append(node)
        levels.append(_level(reasons))
        if readings[0].pressure_hpa - readings[-1].pressure_hpa >= PRESSURE_FALLING_HPA:
            pressure_falling.append(node)
    return FloodRisk(
        level="high" if "high" in levels else "elevated" if "elevated" in levels else "low",
        reasons=[
            Reason(code=code, nodes=nodes, text=f"{_REASON_TEXT[code]} at {_count(nodes)}")
            for code, nodes in nodes_by_reason.items()
        ],
        storm_signal=_storm_signal(pressure_falling, len(recent)),
    )


def _reasons(readings: list[CommunityReading]) -> list[ReasonCode]:
    latest = readings[-1]
    reasons: list[ReasonCode] = []
    if latest.water_m * 100 >= WATER_HIGH_CM:
        reasons.append("water_high")
    if (latest.water_m - readings[0].water_m) * 100 >= WATER_RISING_CM:
        reasons.append("water_rising")
    if latest.rain_mmh >= RAIN_HEAVY_MMH:
        reasons.append("rain_heavy")
    return reasons


def _level(reasons: list[ReasonCode]) -> FloodRiskLevel:
    if "water_high" in reasons or {"rain_heavy", "water_rising"} <= set(reasons):
        return "high"
    return "elevated" if reasons else "low"


def _storm_signal(falling: list[str], counted: int) -> StormSignal:
    # "Across Nodes" means at least half of the counted Nodes, so one odd Node does not raise it.
    if falling and len(falling) * 2 >= counted:
        return StormSignal(falling=True, text=f"pressure falling at {_count(falling)}")
    return StormSignal(falling=False, text="pressure steady")


def _count(nodes: list[str]) -> str:
    return f"{len(nodes)} Node" if len(nodes) == 1 else f"{len(nodes)} Nodes"
