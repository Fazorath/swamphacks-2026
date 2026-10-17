import asyncio
import itertools
import logging
import time
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from storm_shield.cache_pack import (
    DOWNLOAD_TIMEOUT_SECONDS,
    RETRY_EVERY_SECONDS,
    CachePack,
)
from storm_shield.cameras import FETCH_TIMEOUT_SECONDS, Cameras, CameraTile
from storm_shield.community_reading import CommunityReading, fuzz_position
from storm_shield.flood_risk import HISTORY_WINDOW_SECONDS, FloodRisk, flood_risk
from storm_shield.internet_connection import (
    CONNECTIVITY_TIMEOUT_SECONDS,
    InternetConnection,
    Status,
)
from storm_shield.mesh import InMemoryNetwork, Mesh
from storm_shield.reading_store import NodeReading, ReadingStore
from storm_shield.reticulum_mesh import ReticulumMesh
from storm_shield.scenario import Scenario
from storm_shield.settings import Role, Settings

CARTO_TILE_URL = "https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png"
TILE_TIMEOUT_SECONDS = 10
READINGS_PUSH_SECONDS = 2
PUBLISH_EVERY_SECONDS = 3

logger = logging.getLogger(__name__)


class NodeInfo(BaseModel):
    id: str
    name: str
    role: Role
    status: Status


class ScenarioState(BaseModel):
    step: str


class OpenShelters(BaseModel):
    open: list[str]


class CachePackStatus(BaseModel):
    available: bool
    manifest: dict[str, Any] | None


def create_app(
    settings: Settings,
    mesh: Mesh,
    pack_source: httpx.Client | None = None,
    clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    tile_source: httpx.Client | None = None,
    internet_source: httpx.Client | None = None,
    camera_source: httpx.Client | None = None,
) -> FastAPI:
    cache_pack = CachePack(settings.cache_pack_dir)
    pack_source = pack_source or httpx.Client(
        timeout=DOWNLOAD_TIMEOUT_SECONDS, follow_redirects=True
    )
    tile_source = tile_source or httpx.Client(timeout=TILE_TIMEOUT_SECONDS)
    internet = InternetConnection(
        internet_source or httpx.Client(timeout=CONNECTIVITY_TIMEOUT_SECONDS)
    )
    cameras = Cameras(camera_source or httpx.Client(timeout=FETCH_TIMEOUT_SECONDS))
    # httpx logs every request URL at INFO, and a tile URL carries the CARTO key.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    scenario = Scenario()
    store = ReadingStore(HISTORY_WINDOW_SECONDS)
    position = fuzz_position(settings.latitude, settings.longitude)
    # Starting from the clock keeps a restarted Node ahead of the seq others last saw from it.
    sequence = itertools.count(int(time.time()))

    def share_own_readings() -> None:
        reading = CommunityReading.from_measurements(
            node=mesh.identity, seq=next(sequence), position=position, readings=scenario.readings()
        )
        store.record(mesh.identity, reading, clock())
        mesh.publish(reading)

    def store_reading_from(sender: str, reading: CommunityReading) -> None:
        store.record(sender, reading, clock())

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

        async def keep_checking_internet() -> None:
            while True:
                try:
                    await asyncio.to_thread(internet.probe)
                except Exception:
                    logger.exception("could not check whether this Node has internet")
                await asyncio.sleep(settings.internet_check_seconds)

        # Apart from the internet check, so slow cameras never delay noticing the cable is out.
        async def keep_cameras_fresh() -> None:
            while True:
                try:
                    if internet.status == "online":
                        await asyncio.to_thread(cameras.refresh_due, clock())
                except Exception:
                    logger.exception("could not refresh the camera pictures")
                await asyncio.sleep(settings.internet_check_seconds)

        tasks = [
            asyncio.create_task(keep_sharing()),
            asyncio.create_task(keep_checking_internet()),
            asyncio.create_task(keep_cameras_fresh()),
        ]
        if settings.cache_pack_url:
            tasks.append(asyncio.create_task(fetch_cache_pack()))
        yield
        for task in tasks:
            task.cancel()

    app = FastAPI(title="Storm Shield Node", lifespan=lifespan)

    @app.get("/api/node")
    def node_info() -> NodeInfo:
        return NodeInfo(
            id=mesh.identity, name=settings.name, role=settings.role, status=internet.status
        )

    @app.get("/api/cameras")
    def camera_tiles() -> list[CameraTile]:
        return cameras.tiles(internet.status, clock())

    @app.get("/api/cameras/{camera_id}.jpg")
    def camera_picture(camera_id: int) -> Response:
        if not cameras.knows(camera_id):
            raise HTTPException(status_code=404, detail="no such camera")
        picture = cameras.picture(camera_id, internet.status, clock())
        if picture is None:
            raise HTTPException(
                status_code=503,
                detail="no live picture: this Node is Mesh-only or the camera failed",
            )
        # A cached copy shown later would look live, which is exactly what this must never do.
        return Response(picture, media_type="image/jpeg", headers={"Cache-Control": "no-store"})

    @app.get("/api/readings")
    def readings() -> list[NodeReading]:
        return store.latest(clock())

    @app.get("/api/flood-risk")
    def current_flood_risk() -> FloodRisk:
        return flood_risk(store.recent(clock()))

    @app.get("/api/readings/stream")
    async def readings_stream() -> StreamingResponse:
        async def events() -> AsyncIterator[str]:
            while True:
                payload = ",".join(reading.model_dump_json() for reading in store.latest(clock()))
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

    @app.get("/api/shelters")
    def open_shelters() -> OpenShelters:
        # Demo placeholder until 0015: every Shelter in this Node's own pack counts as open.
        return OpenShelters(open=cache_pack.shelter_ids())

    @app.get("/api/tiles/{z}/{x}/{y}.png")
    def map_tile(z: int, x: int, y: int) -> Response:
        if not settings.carto_api_key:
            raise HTTPException(status_code=404, detail="CARTO_API_KEY is not set on this Node")
        try:
            upstream = tile_source.get(
                CARTO_TILE_URL.format(z=z, x=x, y=y), params={"key": settings.carto_api_key}
            )
        except httpx.HTTPError as error:
            # The error text can carry the request URL, and the URL carries the key.
            logger.warning("CARTO tile request failed: %s", type(error).__name__)
            raise HTTPException(status_code=502, detail="CARTO is unreachable") from None
        if upstream.status_code != 200:
            raise HTTPException(status_code=502, detail=f"CARTO answered {upstream.status_code}")
        return Response(
            upstream.content,
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=86400"},
        )

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
