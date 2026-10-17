from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

Role = Literal["sensor", "hub"]
MeshKind = Literal["reticulum", "memory"]
ReticulumInterface = Literal["auto", "loopback", "tcp"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="NODE_", populate_by_name=True)

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
    # for rehearsing without the Pis. "tcp" reaches Nodes at addresses you give it.
    mesh_interface: ReticulumInterface = "auto"
    # Each Node on one machine needs its own slot; only read when mesh_interface is "loopback".
    loopback_slot: int = 0
    # "tcp" is the fixed-address interface (for example over Tailscale): this Node listens on
    # tcp_port and dials every host in tcp_peers, a comma-separated list of "host" or "host:port".
    # Every Node must list every other Node, because Reticulum does not relay between clients.
    tcp_port: int = 4242
    tcp_peers: str = ""
    # Holds this Node's Reticulum config and identity. Never shared between Nodes, never committed.
    data_dir: Path = Path(__file__).resolve().parents[2] / "data"
    # Unprefixed on purpose: operators set CACHE_PACK_URL / CACHE_PACK_DIR in .env.
    # Empty URL means this Node never downloads a pack.
    cache_pack_url: str = Field(default="", validation_alias="CACHE_PACK_URL")
    cache_pack_dir: Path = Field(
        default=Path(__file__).resolve().parents[3] / "cache-pack",
        validation_alias="CACHE_PACK_DIR",
    )
