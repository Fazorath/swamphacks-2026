from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

Role = Literal["sensor", "hub"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="NODE_")

    name: str = "node-1"
    role: Role = "sensor"
    port: int = 8000
    dashboard_dir: str = "../dashboard/dist"
