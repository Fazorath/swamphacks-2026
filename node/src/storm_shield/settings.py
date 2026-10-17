from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

Role = Literal["sensor", "hub"]


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
    # Unprefixed on purpose: operators set CACHE_PACK_URL / CACHE_PACK_DIR in .env.
    # Empty URL means this Node never downloads a pack.
    cache_pack_url: str = Field(default="", validation_alias="CACHE_PACK_URL")
    # Secret: only this Node ever holds it; the dashboard asks the Node for tiles.
    carto_api_key: str = Field(default="", validation_alias="CARTO_API_KEY")
    cache_pack_dir: Path = Field(
        default=Path(__file__).resolve().parents[3] / "cache-pack",
        validation_alias="CACHE_PACK_DIR",
    )
