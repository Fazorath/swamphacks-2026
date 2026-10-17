from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

Role = Literal["sensor", "hub"]
MeshKind = Literal["reticulum", "memory"]
ReticulumInterface = Literal["auto", "loopback"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="NODE_")

    name: str = "node-1"
    role: Role = "sensor"
    port: int = 8000
    # Downtown Gainesville until the operator sets the real spot; only a fuzzed copy leaves the Node.
    latitude: float = 29.6516
    longitude: float = -82.3248
    # Resolved from this file, not the cwd, so the Node starts from any directory.
    dashboard_dir: Path = Path(__file__).resolve().parents[3] / "dashboard" / "dist"
    # "memory" is a Node that hears only itself; tests and the dashboard dev server use it.
    mesh: MeshKind = "reticulum"
    # "auto" finds Nodes on the local Wi-Fi (the demo). "loopback" joins Nodes on this one machine,
    # for rehearsing without the Pis.
    mesh_interface: ReticulumInterface = "auto"
    # Each Node on one machine needs its own slot; only read when mesh_interface is "loopback".
    loopback_slot: int = 0
    # Holds this Node's Reticulum config and identity. Never shared between Nodes, never committed.
    data_dir: Path = Path(__file__).resolve().parents[2] / "data"
