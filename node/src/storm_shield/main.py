import asyncio
from collections.abc import AsyncIterator

import uvicorn
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from storm_shield.scenario import Reading, Scenario
from storm_shield.settings import Role, Settings

READINGS_PUSH_SECONDS = 2


class NodeIdentity(BaseModel):
    name: str
    role: Role


class ScenarioState(BaseModel):
    step: str


def create_app(settings: Settings) -> FastAPI:
    app = FastAPI(title="Storm Shield Node")
    scenario = Scenario()

    @app.get("/api/node")
    def node_identity() -> NodeIdentity:
        return NodeIdentity(name=settings.name, role=settings.role)

    @app.get("/api/readings")
    def readings() -> list[Reading]:
        return scenario.readings()

    @app.get("/api/readings/stream")
    async def readings_stream() -> StreamingResponse:
        async def events() -> AsyncIterator[str]:
            while True:
                payload = ",".join(reading.model_dump_json() for reading in scenario.readings())
                yield f"data: [{payload}]\n\n"
                await asyncio.sleep(READINGS_PUSH_SECONDS)

        return StreamingResponse(events(), media_type="text/event-stream")

    @app.get("/api/scenario")
    def scenario_state() -> ScenarioState:
        return ScenarioState(step=scenario.step_name)

    @app.post("/api/scenario/step")
    def step_scenario() -> ScenarioState:
        scenario.step()
        return ScenarioState(step=scenario.step_name)

    @app.post("/api/scenario/reset")
    def reset_scenario() -> ScenarioState:
        scenario.reset()
        return ScenarioState(step=scenario.step_name)

    # Mounted last so it never shadows /api routes.
    dashboard = settings.dashboard_dir
    if dashboard.is_dir():
        app.mount("/", StaticFiles(directory=dashboard, html=True), name="dashboard")
    return app


def run() -> None:
    settings = Settings()
    uvicorn.run(create_app(settings), host="0.0.0.0", port=settings.port)
