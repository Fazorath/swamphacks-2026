from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from storm_shield.breadboard import GpioMode

Role = Literal["sensor", "hub"]
MeshKind = Literal["reticulum", "memory"]
ReticulumInterface = Literal["auto", "loopback", "tcp"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="NODE_", populate_by_name=True)

    name: str = "node-1"
    role: Role = "sensor"
    port: int = 8000
    # Betrawati until the operator sets the real spot; only a fuzzed copy leaves the Node.
    latitude: float = 27.9731
    longitude: float = 85.1860
    # Kilometres down the river from the Lhende-Kyirong confluence (negative above it); blank for a
    # Node that is not on the river, which then cannot start a Community Warning.
    river_km: float | None = None
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
    # How often this Node checks whether it has internet, and whether a camera picture is due.
    internet_check_seconds: float = 5
    # How often the Hub repeats its Shelter status, so a Node that joined late or missed a packet
    # converges.
    shelter_repeat_seconds: float = 30
    # How often the Hub repeats the Node registry, so a Node that joined late or missed a packet
    # converges.
    registry_repeat_seconds: float = 30
    # How often a Node that pressed "Sign up" resends it until the Hub has accepted it.
    sign_up_repeat_seconds: float = 10
    # How often the Hub repeats the Event clock, so a Node that joined late or missed a packet
    # converges.
    replay_repeat_seconds: float = 10
    # How often the Hub sends every Community Warning again, so a Node that joined late or missed a
    # packet still gets it.
    warning_repeat_seconds: float = 10
    # How often the Hub checks whether the Event clock has reached a replayed Official Alert or
    # the end of the replay.
    alert_check_seconds: float = 1
    # How often a Node shares its readings.
    publish_every_seconds: float = 3
    # Whether this Node reads the Pi's Breadboard. "auto" turns it on only on a Raspberry Pi; "on"
    # stops the Node if the Breadboard cannot start; "off" never loads the GPIO library.
    gpio: GpioMode = "auto"
    # Which Sensor track of the replay timeline this Node plays (S0 to S3). Blank keeps the Scenario.
    replay_track: str = ""
    # Unprefixed on purpose: operators set CACHE_PACK_URL / CACHE_PACK_DIR in .env.
    # Empty URL means this Node never downloads a pack.
    cache_pack_url: str = Field(default="", validation_alias="CACHE_PACK_URL")
    # How often a Node refreshes its weather forecast: the Hub from Open-Meteo, others from the Hub.
    # Open-Meteo's free terms allow no more often than hourly.
    weather_forecast_seconds: float = 3600
    # Where a Sensor downloads the Hub's forecast, http://<hub>:8000/api/weather/forecast. Blank on
    # the Hub, which fetches it itself; a blank Sensor never gets a forecast.
    weather_forecast_url: str = ""
    # Secret: only this Node ever holds it; the dashboard asks the Node for tiles.
    carto_api_key: str = Field(default="", validation_alias="CARTO_API_KEY")
    cache_pack_dir: Path = Field(
        default=Path(__file__).resolve().parents[3] / "cache-pack",
        validation_alias="CACHE_PACK_DIR",
    )
    # Whose Shelter status this Node believes (the Hub prints its identity at startup). Blank or
    # wrong means no Shelter status is accepted, so the Node shows nothing open.
    hub_identity: str = Field(default="", validation_alias="HUB_IDENTITY")
