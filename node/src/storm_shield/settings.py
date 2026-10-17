from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

Role = Literal["sensor", "hub"]


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
