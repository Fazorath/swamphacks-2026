from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from storm_shield.settings import Role, Settings


class NodeIdentity(BaseModel):
    name: str
    role: Role


def create_app(settings: Settings) -> FastAPI:
    app = FastAPI(title="Storm Shield Node")

    @app.get("/api/node")
    def node_identity() -> NodeIdentity:
        return NodeIdentity(name=settings.name, role=settings.role)

    # Mounted last so it never shadows /api routes.
    dashboard = Path(settings.dashboard_dir)
    if dashboard.is_dir():
        app.mount("/", StaticFiles(directory=dashboard, html=True), name="dashboard")
    return app


def run() -> None:
    settings = Settings()
    uvicorn.run(create_app(settings), host="0.0.0.0", port=settings.port)
