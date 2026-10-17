import asyncio
import itertools
import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime

import uvicorn
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from storm_shield.community_reading import CommunityReading, fuzz_position
from storm_shield.mesh import InMemoryNetwork, Mesh
from storm_shield.reading_store import NodeReading, ReadingStore
from storm_shield.reticulum_mesh import ReticulumMesh
from storm_shield.scenario import Scenario
from storm_shield.settings import Role, Settings

READINGS_PUSH_SECONDS = 2
PUBLISH_EVERY_SECONDS = 3

logger = logging.getLogger(__name__)


class NodeIdentity(BaseModel):
    id: str
    name: str
    role: Role


class ScenarioState(BaseModel):
    step: str


def create_app(settings: Settings, mesh: Mesh) -> FastAPI:
    scenario = Scenario()
    store = ReadingStore()
    position = fuzz_position(settings.latitude, settings.longitude)
    # Starting from the clock keeps a restarted Node ahead of the seq others last saw from it.
    sequence = itertools.count(int(time.time()))

    def share_own_readings() -> None:
        reading = CommunityReading.from_measurements(
            node=mesh.identity, seq=next(sequence), position=position, readings=scenario.readings()
        )
        store.record(mesh.identity, reading, datetime.now(UTC))
        mesh.publish(reading)

    def store_reading_from(sender: str, reading: CommunityReading) -> None:
        store.record(sender, reading, datetime.now(UTC))

    mesh.subscribe(store_reading_from)
    share_own_readings()

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        async def keep_sharing() -> None:
            while True:
                await asyncio.sleep(PUBLISH_EVERY_SECONDS)
                try:
                    share_own_readings()
                except Exception:
                    # One bad tick must not silence this Node for the rest of the storm.
                    logger.exception("could not share this Node's readings")

        task = asyncio.create_task(keep_sharing())
        yield
        task.cancel()

    app = FastAPI(title="Storm Shield Node", lifespan=lifespan)

    @app.get("/api/node")
    def node_identity() -> NodeIdentity:
        return NodeIdentity(id=mesh.identity, name=settings.name, role=settings.role)

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


def build_mesh(settings: Settings) -> Mesh:
    if settings.mesh == "memory":
        return InMemoryNetwork().join(settings.name)
    return ReticulumMesh(settings)


def run() -> None:
    logging.basicConfig(level=logging.INFO)
    settings = Settings()
    mesh = build_mesh(settings)
    logger.info("Node %s (%s) is up as %s", mesh.identity, settings.name, settings.role)
    uvicorn.run(create_app(settings, mesh), host="0.0.0.0", port=settings.port)
