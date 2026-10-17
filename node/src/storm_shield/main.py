import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from storm_shield.mesh import CommunityReadingsMessage, InMemoryNetwork, Mesh, MeshMessage
from storm_shield.reading_store import NodeReading, ReadingStore
from storm_shield.scenario import Scenario
from storm_shield.settings import Role, Settings

READINGS_PUSH_SECONDS = 2


class NodeIdentity(BaseModel):
    name: str
    role: Role


class ScenarioState(BaseModel):
    step: str


def create_app(settings: Settings, mesh: Mesh | None = None) -> FastAPI:
    # Until the Reticulum Mesh lands, a Node started on its own hears only itself.
    mesh = mesh or InMemoryNetwork().join(settings.name)
    scenario = Scenario()
    store = ReadingStore()

    def share_own_readings() -> None:
        readings = scenario.readings()
        store.record(mesh.identity, readings)
        mesh.publish(CommunityReadingsMessage(readings=readings))

    def store_readings_from(sender: str, message: MeshMessage) -> None:
        store.record(sender, message.readings)

    mesh.subscribe(store_readings_from)
    share_own_readings()

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        async def keep_sharing() -> None:
            while True:
                await asyncio.sleep(READINGS_PUSH_SECONDS)
                share_own_readings()

        task = asyncio.create_task(keep_sharing())
        yield
        task.cancel()

    app = FastAPI(title="Storm Shield Node", lifespan=lifespan)

    @app.get("/api/node")
    def node_identity() -> NodeIdentity:
        return NodeIdentity(name=settings.name, role=settings.role)

    @app.get("/api/readings")
    def readings() -> list[NodeReading]:
        return store.latest()

    @app.get("/api/readings/stream")
    async def readings_stream() -> StreamingResponse:
        async def events() -> AsyncIterator[str]:
            while True:
                payload = ",".join(reading.model_dump_json() for reading in store.latest())
                yield f"data: [{payload}]\n\n"
                await asyncio.sleep(READINGS_PUSH_SECONDS)

        return StreamingResponse(events(), media_type="text/event-stream")

    @app.get("/api/scenario")
    def scenario_state() -> ScenarioState:
        return ScenarioState(step=scenario.step_name)

    @app.post("/api/scenario/step")
    def step_scenario() -> ScenarioState:
        scenario.step()
        share_own_readings()
        return ScenarioState(step=scenario.step_name)

    @app.post("/api/scenario/reset")
    def reset_scenario() -> ScenarioState:
        scenario.reset()
        share_own_readings()
        return ScenarioState(step=scenario.step_name)

    # Mounted last so it never shadows /api routes.
    dashboard = settings.dashboard_dir
    if dashboard.is_dir():
        app.mount("/", StaticFiles(directory=dashboard, html=True), name="dashboard")
    return app


def run() -> None:
    settings = Settings()
    uvicorn.run(create_app(settings), host="0.0.0.0", port=settings.port)
