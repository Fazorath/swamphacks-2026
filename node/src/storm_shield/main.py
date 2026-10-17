import asyncio
import itertools
import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from storm_shield.cache_pack import (
    DOWNLOAD_TIMEOUT_SECONDS,
    RETRY_EVERY_SECONDS,
    CachePack,
)
from storm_shield.community_reading import CommunityReading, fuzz_position
from storm_shield.mesh import InMemoryNetwork, Mesh
from storm_shield.reading_store import NodeReading, ReadingStore
from storm_shield.scenario import Scenario
from storm_shield.settings import Role, Settings

READINGS_PUSH_SECONDS = 2
PUBLISH_EVERY_SECONDS = 3

logger = logging.getLogger(__name__)


class NodeIdentity(BaseModel):
    name: str
    role: Role


class ScenarioState(BaseModel):
    step: str


class CachePackStatus(BaseModel):
    available: bool
    manifest: dict[str, Any] | None


def create_app(
    settings: Settings,
    mesh: Mesh | None = None,
    pack_source: httpx.Client | None = None,
) -> FastAPI:
    # Until the Reticulum Mesh lands, a Node started on its own hears only itself.
    mesh = mesh or InMemoryNetwork().join(settings.name)
    cache_pack = CachePack(settings.cache_pack_dir)
    pack_source = pack_source or httpx.Client(
        timeout=DOWNLOAD_TIMEOUT_SECONDS, follow_redirects=True
    )
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

        async def fetch_cache_pack() -> None:
            while cache_pack.manifest is None:
                try:
                    await asyncio.to_thread(
                        cache_pack.download, settings.cache_pack_url, pack_source
                    )
                except Exception:
                    # Whatever went wrong, a Node without a pack must keep retrying.
                    logger.exception("could not get the Cache Pack, retrying")
                    await asyncio.sleep(RETRY_EVERY_SECONDS)

        tasks = [asyncio.create_task(keep_sharing())]
        if settings.cache_pack_url:
            tasks.append(asyncio.create_task(fetch_cache_pack()))
        yield
        for task in tasks:
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

    @app.get("/api/cache-pack")
    def cache_pack_status() -> CachePackStatus:
        manifest = cache_pack.manifest
        return CachePackStatus(available=manifest is not None, manifest=manifest)

    @app.get("/api/cache-pack.zip")
    def cache_pack_zip() -> FileResponse:
        if cache_pack.manifest is None:
            raise HTTPException(status_code=404, detail="no Cache Pack on this Node yet")
        return FileResponse(cache_pack.zip_path, media_type="application/zip")

    @app.get("/api/cache-pack/files/{path:path}")
    def cache_pack_file(path: str) -> FileResponse:
        file = cache_pack.file(path)
        if file is None:
            raise HTTPException(status_code=404, detail="not in the Cache Pack")
        return FileResponse(file)

    # Mounted last so it never shadows /api routes.
    dashboard = settings.dashboard_dir
    if dashboard.is_dir():
        app.mount("/", StaticFiles(directory=dashboard, html=True), name="dashboard")
    return app


def run() -> None:
    settings = Settings()
    uvicorn.run(create_app(settings), host="0.0.0.0", port=settings.port)
