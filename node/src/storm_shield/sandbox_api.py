from typing import Protocol

from pydantic import BaseModel, Field

from storm_shield.settings import Role


class SandboxNode(BaseModel):
    id: str
    name: str
    role: Role
    # The true spot the radio range is measured from; readings on the Mesh carry a fuzzed one.
    position: tuple[float, float]
    # The Nodes within radio range of this one: a line is drawn to each.
    links: list[str]
    # Radio hops to the Hub; null when no chain of Nodes reaches it.
    hops: int | None
    # Whether this Node has the newest Community Warning the Hub has sent.
    heard_warning: bool


class SandboxNodes(BaseModel):
    radio_range_m: float
    nodes: list[SandboxNode]


class RadioRange(BaseModel):
    radio_range_m: float = Field(gt=0)


class SandboxControls(Protocol):
    """What the Sandbox lets its Hub's dashboard see and change about the simulated Mesh."""

    def nodes(self) -> SandboxNodes: ...

    def set_radio_range(self, radio_range_m: float) -> SandboxNodes: ...
