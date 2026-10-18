import asyncio
import logging
import threading
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any, Literal

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from storm_shield.breadboard import open_breadboard
from storm_shield.cache_pack import (
    DOWNLOAD_TIMEOUT_SECONDS,
    RETRY_EVERY_SECONDS,
    CachePack,
)
from storm_shield.cameras import FETCH_TIMEOUT_SECONDS, Cameras, CameraTile
from storm_shield.community_reading import CommunityReading, fuzz_position
from storm_shield.community_warning import CommunityWarning, HeardCommunityWarnings, HubWarnings
from storm_shield.flood_email import FloodEmail
from storm_shield.flood_risk import HISTORY_WINDOW_SECONDS, FloodRisk, flood_risk
from storm_shield.internet_connection import (
    CONNECTIVITY_TIMEOUT_SECONDS,
    InternetConnection,
    Status,
)
from storm_shield.mesh import InMemoryNetwork, Mesh, Message
from storm_shield.node_registry import (
    NODE_NAME_MAX_LENGTH,
    HeardRegistry,
    HubRegistry,
    NodeRegistryMessage,
    NoWaitingSignUp,
    RegisteredNode,
    RegistrationState,
    RegistryFull,
    RegistrySummary,
    SignUp,
)
from storm_shield.official_alert import HeardOfficialAlerts, OfficialAlert
from storm_shield.reading_publisher import ReadingPublisher
from storm_shield.reading_store import NodeSnapshot, ReadingStore
from storm_shield.replay import EventClock, ReplayClockMessage, load_timeline
from storm_shield.reticulum_mesh import ReticulumMesh
from storm_shield.scenario import Reading, Scenario
from storm_shield.settings import Role, Settings
from storm_shield.shelter_status import (
    HeardShelterStatus,
    ShelterRegistry,
    ShelterStatus,
    UnknownShelter,
)
from storm_shield.simulated_fleet import FLEET_FILE, FleetEntry, SimulatedFleet
from storm_shield.timing import REPLAY_PUBLISH_EVERY_SECONDS
from storm_shield.weather_forecast import FORECAST_TIMEOUT_SECONDS, WeatherForecast

CARTO_TILE_URL = "https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png"
TILE_TIMEOUT_SECONDS = 10

logger = logging.getLogger(__name__)


class ScenarioState(BaseModel):
    step: str


class NodeEntry(NodeSnapshot):
    """A Node's latest readings plus whether it counts; `name` is its registry name."""

    registered: bool
    name: str | None


class NodeState(BaseModel):
    id: str
    name: str
    role: Role
    status: Status
    registration: RegistrationState
    scenario: ScenarioState
    flood_risk: FloodRisk
    nodes: list[NodeEntry]
    official_alerts: list[OfficialAlert]
    community_warnings: list[CommunityWarning]
    fleet: list[FleetEntry]


class OpenShelters(BaseModel):
    open: list[str]


class WarningLog(BaseModel):
    warnings: list[CommunityWarning]


class RegistryAccept(BaseModel):
    id: str


class ShelterChange(BaseModel):
    id: str
    open: bool


class ReplayJump(BaseModel):
    phase: str


class ReplayRate(BaseModel):
    # Slower than x5 stretches S0's 3.5 m rise past the 60 s Surge window, so no warning would fire.
    rate: Literal[5, 10, 30]


class ReplayPhase(BaseModel):
    id: str
    label: str
    event_t: int


class ReplayPhases(BaseModel):
    phases: list[ReplayPhase]
    internet_cue_event_t: int


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
    weather_source: httpx.Client | None = None,
) -> FastAPI:
    cache_pack = CachePack(settings.cache_pack_dir)
    weather_forecast = WeatherForecast(settings.data_dir)
    weather_source = weather_source or httpx.Client(
        timeout=FORECAST_TIMEOUT_SECONDS, follow_redirects=True
    )
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
    timeline = load_timeline()
    if settings.replay_track and settings.replay_track not in timeline.tracks:
        raise ValueError(
            f"NODE_REPLAY_TRACK {settings.replay_track!r} is not in the replay timeline "
            f"({', '.join(timeline.tracks)})"
        )
    event_clock = EventClock()
    simulated_fleet = SimulatedFleet()

    def own_measurements() -> list[Reading] | None:
        """None once this Node's replay track has ended: it goes silent and turns Stale."""
        event = event_clock.current(clock())
        if not settings.replay_track or event.state == "stopped":
            return scenario.readings()
        return timeline.readings_at(settings.replay_track, event.event_t, clock())

    def keep_reading(sender: str, reading: CommunityReading) -> None:
        store.record(sender, reading, clock())
        warn_about_new_surges()

    def hear_community_reading(sender: str, message: Message) -> None:
        if isinstance(message, CommunityReading):
            keep_reading(sender, message)

    publisher = ReadingPublisher(
        mesh,
        fuzz_position(settings.latitude, settings.longitude),
        settings.river_km,
        own_measurements,
        keep_reading,
    )

    def press_a_step(step_name: str) -> None:
        with publisher.lock:
            scenario.go_to(step_name)
            publisher.share()

    def reset_the_scenario() -> None:
        with publisher.lock:
            scenario.reset()
            publisher.share()

    breadboard = open_breadboard(settings.gpio, press_a_step, reset_the_scenario)

    heard_warnings = HeardCommunityWarnings()
    hub_warnings = HubWarnings(int(clock().timestamp())) if settings.role == "hub" else None
    flood_email = FloodEmail.from_settings(settings)

    def hear_community_warning(_: str, message: Message) -> None:
        if isinstance(message, CommunityWarning):
            heard_warnings.hear(message)

    def repeat_community_warnings() -> None:
        if hub_warnings:
            for warning in hub_warnings.sent():
                mesh.publish(warning)

    def warn_about_new_surges() -> None:
        """Hub only: warn about each Registered Node whose Surge has not been warned about yet."""
        if not hub_warnings:
            return
        snapshot = store.snapshot(clock())
        surged = flood_risk(snapshot.recent, heard_registry.registered_ids()).surged
        river_km = {node: snapshot.recent[node][-1].river_km for node in surged}
        event = event_clock.current(clock())
        now = int(clock().timestamp())
        # With no replay running the Surge happened now, on the Hub's own clock.
        surge_t = now if event.state == "stopped" else event.event_t
        for warning in hub_warnings.issue_for_new_surges(river_km, surge_t, now):
            # The Hub does not hear its own broadcasts, so it keeps the warning itself.
            heard_warnings.hear(warning)
            # A measured speed updates a warning the team was already emailed about.
            if flood_email and warning.measured is None:
                flood_email.send_for(warning)
            try:
                mesh.publish(warning)
            except Exception:
                # The Hub already shows it and has it in its log.
                logger.exception("could not send Community Warning %s", warning.id)

    shelter_status = HeardShelterStatus()

    def hear_shelter_status(_: str, message: Message) -> None:
        if isinstance(message, ShelterStatus):
            shelter_status.hear(message)

    shelter_registry = ShelterRegistry(
        cache_pack.shelter_ids,
        lambda: int(clock().timestamp()),
        settings.data_dir / "shelter_status.json",
    )

    def announce_shelters(status: ShelterStatus) -> None:
        # The Hub does not hear its own broadcasts, so it takes the status itself.
        shelter_status.hear(status)
        try:
            mesh.publish(status)
        except Exception:
            # The change already stands on the Hub, and the next repeat sends it again.
            logger.exception("could not announce the Shelter status")

    def repeat_shelter_status() -> None:
        status = shelter_registry.snapshot()
        if status:
            announce_shelters(status)

    heard_registry = HeardRegistry()
    sign_up_pressed = threading.Event()

    def hear_registry(_: str, message: Message) -> None:
        if isinstance(message, NodeRegistryMessage):
            heard_registry.hear(message)

    def registration() -> RegistrationState:
        if settings.role == "hub" or mesh.identity in heard_registry.registered_ids():
            return "registered"
        return "waiting" if sign_up_pressed.is_set() else "unverified"

    def send_sign_up() -> None:
        try:
            mesh.publish(SignUp(node=mesh.identity, name=settings.name[:NODE_NAME_MAX_LENGTH]))
        except Exception:
            # Nothing is lost: the next repeat sends it again.
            logger.exception("could not send the Sign-up")

    def repeat_sign_up() -> None:
        if sign_up_pressed.is_set() and registration() != "registered":
            send_sign_up()

    hub_registry = (
        HubRegistry(
            RegisteredNode(id=mesh.identity, name=settings.name),
            lambda: int(clock().timestamp()),
            settings.data_dir / "registry.json",
        )
        if settings.role == "hub"
        else None
    )

    def hear_sign_up(_: str, message: Message) -> None:
        if hub_registry and isinstance(message, SignUp):
            hub_registry.hear_sign_up(message, clock())

    def announce_registry(registry: NodeRegistryMessage) -> None:
        # The Hub does not hear its own broadcasts, so it takes the registry itself.
        heard_registry.hear(registry)
        try:
            mesh.publish(registry)
        except Exception:
            # The change already stands on the Hub, and the next repeat sends it again.
            logger.exception("could not announce the Node registry")

    def repeat_registry() -> None:
        if hub_registry:
            announce_registry(hub_registry.snapshot())

    def hear_event_clock(_: str, message: Message) -> None:
        if isinstance(message, ReplayClockMessage):
            event_clock.hear(message, clock())

    def announce_event_clock(message: ReplayClockMessage) -> None:
        # The Hub does not hear its own broadcasts, so it sets its own clock too.
        event_clock.hear(message, clock())
        try:
            mesh.publish(message)
        except Exception:
            # The clock already runs on the Hub, and the next repeat sends it again.
            logger.exception("could not announce the Event clock")

    official_alerts = HeardOfficialAlerts()

    def hear_official_alert(_: str, message: Message) -> None:
        if isinstance(message, OfficialAlert):
            official_alerts.hear(message)

    forwarded_alert_ids: set[str] = set()

    def due_official_alerts() -> list[OfficialAlert]:
        event = event_clock.current(clock())
        return [] if event.state == "stopped" else timeline.official_alerts_due(event.event_t)

    def forward_official_alert(alert: OfficialAlert) -> None:
        # The Hub does not hear its own broadcasts, so it keeps the alert itself.
        official_alerts.hear(alert)
        forwarded_alert_ids.add(alert.id)
        try:
            mesh.publish(alert)
        except Exception:
            # The Hub already shows it, and the next repeat sends it again.
            logger.exception("could not forward Official Alert %s", alert.id)

    def forward_newly_due_official_alerts() -> None:
        for alert in due_official_alerts():
            if alert.id not in forwarded_alert_ids:
                forward_official_alert(alert)

    def pause_at_the_end() -> None:
        """Hold the clock at the replay's end instead of letting it play on past the timeline."""
        event = event_clock.current(clock())
        if event.state == "playing" and event.event_t >= timeline.end_unix:
            announce_event_clock(
                ReplayClockMessage(state="paused", event_t=timeline.end_unix, rate=event.rate)
            )

    def repeat_due_official_alerts() -> None:
        for alert in due_official_alerts():
            forward_official_alert(alert)

    mesh.subscribe(hear_community_reading)
    mesh.subscribe(hear_event_clock)
    mesh.subscribe(hear_official_alert)
    mesh.subscribe(hear_community_warning)
    mesh.subscribe(hear_shelter_status)
    mesh.subscribe(hear_registry)
    mesh.subscribe(hear_sign_up)
    publisher.share()
    if settings.role == "hub":
        repeat_shelter_status()
        repeat_registry()

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        publish_every_seconds = settings.publish_every_seconds
        if settings.replay_track:
            publish_every_seconds = min(publish_every_seconds, REPLAY_PUBLISH_EVERY_SECONDS)

        async def keep_sharing() -> None:
            while True:
                await asyncio.sleep(publish_every_seconds)
                try:
                    publisher.share()
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

        async def keep_weather_forecast_fresh() -> None:
            while True:
                try:
                    if settings.role == "hub":
                        await asyncio.to_thread(weather_forecast.fetch, weather_source, clock())
                    else:
                        await asyncio.to_thread(
                            weather_forecast.download, settings.weather_forecast_url, weather_source
                        )
                except Exception:
                    # The copy on disk stays; the layers say how old it is.
                    logger.exception("could not refresh the weather forecast")
                # Without any copy a Node retries soon: the Hub may not have fetched yet.
                has_copy = weather_forecast.read() is not None
                await asyncio.sleep(
                    settings.weather_forecast_seconds if has_copy else RETRY_EVERY_SECONDS
                )

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

        # Also how a Hub whose pack arrives late starts announcing; it waits at most one period.
        async def keep_repeating_shelter_status() -> None:
            while True:
                await asyncio.sleep(settings.shelter_repeat_seconds)
                try:
                    repeat_shelter_status()
                except Exception:
                    logger.exception("could not repeat the Shelter status")

        async def keep_repeating_registry() -> None:
            while True:
                await asyncio.sleep(settings.registry_repeat_seconds)
                try:
                    repeat_registry()
                except Exception:
                    logger.exception("could not repeat the Node registry")

        async def keep_repeating_warnings() -> None:
            while True:
                await asyncio.sleep(settings.warning_repeat_seconds)
                try:
                    repeat_community_warnings()
                except Exception:
                    logger.exception("could not repeat the Community Warnings")

        async def keep_signing_up() -> None:
            while True:
                await asyncio.sleep(settings.sign_up_repeat_seconds)
                try:
                    repeat_sign_up()
                except Exception:
                    logger.exception("could not repeat the Sign-up")

        async def keep_repeating_event_clock() -> None:
            while True:
                await asyncio.sleep(settings.replay_repeat_seconds)
                try:
                    event = event_clock.current(clock())
                    if event.state != "stopped":
                        announce_event_clock(event)
                        # A Node that joined late or missed a packet gets the alerts with the clock.
                        repeat_due_official_alerts()
                except Exception:
                    logger.exception("could not repeat the Event clock")

        async def keep_following_the_timeline() -> None:
            while True:
                await asyncio.sleep(settings.alert_check_seconds)
                try:
                    # Alerts first, so the last one is sent before the clock stops at the end.
                    forward_newly_due_official_alerts()
                    pause_at_the_end()
                except Exception:
                    logger.exception("could not follow the replay timeline")

        tasks = [
            asyncio.create_task(keep_sharing()),
            asyncio.create_task(keep_checking_internet()),
            asyncio.create_task(keep_cameras_fresh()),
            asyncio.create_task(keep_signing_up()),
        ]
        if settings.role == "hub":
            tasks.append(asyncio.create_task(keep_repeating_shelter_status()))
            tasks.append(asyncio.create_task(keep_repeating_registry()))
            tasks.append(asyncio.create_task(keep_repeating_warnings()))
            tasks.append(asyncio.create_task(keep_repeating_event_clock()))
            tasks.append(asyncio.create_task(keep_following_the_timeline()))
        if settings.cache_pack_url:
            tasks.append(asyncio.create_task(fetch_cache_pack()))
        if settings.role == "hub" or settings.weather_forecast_url:
            tasks.append(asyncio.create_task(keep_weather_forecast_fresh()))
        try:
            yield
        finally:
            for task in tasks:
                task.cancel()
            # Released even if the app stops on an error, or the pins stay held.
            if breadboard:
                breadboard.close()

    app = FastAPI(title="Storm Shield Node", lifespan=lifespan)

    @app.get("/api/state")
    def node_state() -> NodeState:
        snapshot = store.snapshot(clock())
        registered_ids = heard_registry.registered_ids()
        return NodeState(
            id=mesh.identity,
            name=settings.name,
            role=settings.role,
            status=internet.status,
            registration=registration(),
            scenario=ScenarioState(step=scenario.step_name),
            flood_risk=flood_risk(snapshot.recent, registered_ids),
            nodes=[
                NodeEntry(
                    **node.model_dump(),
                    registered=node.id in registered_ids,
                    name=heard_registry.name_of(node.id),
                )
                for node in snapshot.nodes
            ],
            official_alerts=official_alerts.shown_at(event_clock.current(clock())),
            community_warnings=heard_warnings.shown_at(event_clock.current(clock())),
            fleet=simulated_fleet.at(cache_pack.file(FLEET_FILE), event_clock.current(clock())),
        )

    @app.post("/api/registry/signup")
    def sign_up_with_hub() -> dict[str, RegistrationState]:
        # The press is kept in memory only: after a restart an unregistered Node starts over.
        if registration() == "unverified":
            sign_up_pressed.set()
            send_sign_up()
        return {"registration": registration()}

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

    @app.post("/api/scenario/step")
    def step_scenario() -> ScenarioState:
        with publisher.lock:
            scenario.step()
            publisher.share()
            return ScenarioState(step=scenario.step_name)

    @app.post("/api/scenario/reset")
    def reset_scenario() -> ScenarioState:
        # The lock is re-entrant: holding it here keeps a Breadboard press from landing between the
        # reset and the step we report.
        with publisher.lock:
            reset_the_scenario()
            return ScenarioState(step=scenario.step_name)

    @app.get("/api/replay")
    def replay_clock() -> ReplayClockMessage:
        return event_clock.current(clock())

    @app.get("/api/replay/phases")
    def replay_phases() -> ReplayPhases:
        return ReplayPhases(
            phases=[
                ReplayPhase(id=phase.id, label=phase.label, event_t=timeline.event_t_at(phase.at))
                for phase in timeline.phases
            ],
            internet_cue_event_t=timeline.event_t_at(timeline.internet_cue.at),
        )

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

    @app.get("/api/weather/replay")
    def weather_replay() -> FileResponse:
        file = cache_pack.file("weather_replay.json")
        if file is None:
            raise HTTPException(
                status_code=404, detail="no recorded weather in this Node's Cache Pack"
            )
        return FileResponse(file, media_type="application/json")

    @app.get("/api/weather/forecast")
    def weather_forecast_file() -> Response:
        forecast = weather_forecast.read()
        if forecast is None:
            raise HTTPException(status_code=404, detail="no weather forecast on this Node yet")
        return Response(forecast, media_type="application/json")

    @app.get("/api/shelters")
    def open_shelters() -> OpenShelters:
        # Nothing counts as open until the Hub says so; an id this Node's pack lacks is ignored.
        return OpenShelters(open=shelter_status.open_among(cache_pack.shelter_ids()))

    if settings.role == "hub":

        @app.post("/api/shelters/open")
        def set_shelter_open(change: ShelterChange) -> OpenShelters:
            if not cache_pack.shelter_ids():
                raise HTTPException(
                    status_code=503, detail="the Hub has no valid Cache Pack, so no Shelters yet"
                )
            try:
                status = shelter_registry.set_open(change.id, change.open)
            except UnknownShelter:
                raise HTTPException(
                    status_code=422, detail=f"unknown Shelter {change.id!r}"
                ) from None
            announce_shelters(status)
            return OpenShelters(open=status.open)

    if not hub_registry:
        # Not defined, these would fall through to the dashboard's static mount and answer 405.
        @app.get("/api/registry")
        @app.post("/api/registry/accept")
        @app.get("/api/warnings")
        def not_on_a_sensor() -> None:
            raise HTTPException(status_code=404, detail="only the Hub keeps the registry and log")

    if hub_warnings:

        @app.get("/api/warnings")
        def warning_log() -> WarningLog:
            return WarningLog(warnings=hub_warnings.sent())

    if hub_registry:

        @app.get("/api/registry")
        def registry_summary() -> RegistrySummary:
            now = clock()
            heard = {node.id: node.age_s for node in store.snapshot(now).nodes}
            return hub_registry.summary(heard, now)

        @app.post("/api/registry/accept")
        def accept_sign_up(accept: RegistryAccept) -> RegistrySummary:
            try:
                registry = hub_registry.accept(accept.id)
            except NoWaitingSignUp:
                raise HTTPException(
                    status_code=404, detail=f"no Sign-up from Node {accept.id!r} is waiting"
                ) from None
            except RegistryFull:
                raise HTTPException(
                    status_code=409,
                    detail="the registry would no longer fit one packet; nothing was accepted",
                ) from None
            announce_registry(registry)
            return registry_summary()

    if settings.role == "hub":
        chosen_rate = timeline.rate

        def set_replay(state: Literal["playing", "paused"], event_t: int) -> ReplayClockMessage:
            announce_event_clock(ReplayClockMessage(state=state, event_t=event_t, rate=chosen_rate))
            return event_clock.current(clock())

        @app.post("/api/replay/rate")
        def set_replay_rate(change: ReplayRate) -> ReplayClockMessage:
            nonlocal chosen_rate
            chosen_rate = change.rate
            heard = event_clock.current(clock())
            if heard.state == "stopped":
                return heard
            return set_replay(heard.state, heard.event_t)

        @app.post("/api/replay/start")
        def start_replay() -> ReplayClockMessage:
            return set_replay("playing", timeline.start_unix)

        @app.post("/api/replay/pause")
        def pause_replay() -> ReplayClockMessage:
            heard = event_clock.current(clock())
            if heard.state != "playing":
                raise HTTPException(status_code=409, detail="the replay is not playing")
            return set_replay("paused", heard.event_t)

        @app.post("/api/replay/resume")
        def resume_replay() -> ReplayClockMessage:
            heard = event_clock.current(clock())
            if heard.state != "paused":
                raise HTTPException(status_code=409, detail="the replay is not paused")
            if heard.event_t >= timeline.end_unix:
                raise HTTPException(
                    status_code=409, detail="the replay has ended; Reset or jump to a phase"
                )
            return set_replay("playing", heard.event_t)

        @app.post("/api/replay/reset")
        def reset_replay() -> ReplayClockMessage:
            # Paused at 08:30 rather than stopped: a stopped Sensor falls back to the Scenario.
            return set_replay("paused", timeline.start_unix)

        @app.post("/api/replay/jump")
        def jump_replay(jump: ReplayJump) -> ReplayClockMessage:
            phase = next((p for p in timeline.phases if p.id == jump.phase), None)
            if phase is None:
                raise HTTPException(status_code=422, detail=f"unknown phase {jump.phase!r}")
            keeps_paused = event_clock.current(clock()).state == "paused"
            return set_replay(
                "paused" if keeps_paused else "playing", timeline.event_t_at(phase.at)
            )

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
        return InMemoryNetwork().join(settings.name, settings.hub_identity)
    return ReticulumMesh(settings)


def run() -> None:
    logging.basicConfig(level=logging.INFO)
    settings = Settings()
    mesh = build_mesh(settings)
    logger.info("Node %s (%s) is up as %s", mesh.identity, settings.name, settings.role)
    uvicorn.run(create_app(settings, mesh), host="0.0.0.0", port=settings.port)
