import sys
import time
from collections.abc import Callable, Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from gpiozero import Device
from gpiozero.pins.mock import MockFactory, MockPin
from meshed_nodes import MeshedNodes

from storm_shield import breadboard
from storm_shield.main import create_app
from storm_shield.mesh import InMemoryNetwork
from storm_shield.scenario import SCENARIO_STEPS, Scenario
from storm_shield.settings import Settings

PRESSURE_DROP_PIN = 17
RAIN_PIN = 22
WATER_RISING_PIN = 5
RESET_PIN = 16


@pytest.fixture
def pins() -> Iterator[MockFactory]:
    """Pins that nothing is plugged into; tests drive them high like a wire from 3.3 V."""
    factory = MockFactory()
    Device.pin_factory = factory
    yield factory
    factory.close()
    Device.pin_factory = None


def _wait_until(condition: Callable[[], bool]) -> None:
    deadline = time.monotonic() + 5
    while not condition():
        assert time.monotonic() < deadline, "condition never became true"
        time.sleep(0.01)


def _press(pins: MockFactory, number: int) -> None:
    pin: MockPin = pins.pin(number)
    pin.drive_high()


def _release(pins: MockFactory, number: int) -> None:
    pin: MockPin = pins.pin(number)
    pin.drive_low()


def _step(client: TestClient) -> str:
    step: str = client.get("/api/state").json()["scenario"]["step"]
    return step


def _node(settings: Settings) -> TestClient:
    return TestClient(create_app(settings, InMemoryNetwork().join(settings.name)))


def _water_cm(client: TestClient) -> float:
    state = client.get("/api/state").json()
    own = next(node for node in state["nodes"] if node["id"] == state["id"])
    water_m: float = own["measurements"]["water_level"]["value"]
    return round(water_m * 100, 1)


@pytest.mark.parametrize(
    ("pin", "step"),
    [
        (PRESSURE_DROP_PIN, "pressure_drop"),
        (RAIN_PIN, "rain"),
        (WATER_RISING_PIN, "water_rising"),
    ],
)
def test_a_wire_on_a_pin_jumps_the_scenario_to_its_step(
    pins: MockFactory, pin: int, step: str
) -> None:
    with _node(Settings(gpio="on")) as client:
        _press(pins, pin)
        _wait_until(lambda: _step(client) == step)


def test_a_press_changes_the_readings_the_dashboard_shows(pins: MockFactory) -> None:
    with _node(Settings(gpio="on")) as client:
        calm = _water_cm(client)
        _press(pins, WATER_RISING_PIN)
        _wait_until(lambda: _water_cm(client) > calm + 50)


def test_the_reset_wire_returns_to_normal_day(pins: MockFactory) -> None:
    with _node(Settings(gpio="on")) as client:
        _press(pins, WATER_RISING_PIN)
        _wait_until(lambda: _step(client) == "water_rising")
        _press(pins, RESET_PIN)
        _wait_until(lambda: _step(client) == "normal_day")


def test_pressing_out_of_order_or_twice_lands_on_the_pressed_step(pins: MockFactory) -> None:
    with _node(Settings(gpio="on")) as client:
        _press(pins, WATER_RISING_PIN)
        _wait_until(lambda: _step(client) == "water_rising")
        _press(pins, RAIN_PIN)
        _wait_until(lambda: _step(client) == "rain")
        _release(pins, RAIN_PIN)
        _press(pins, RAIN_PIN)
        time.sleep(0.2)
        assert _step(client) == "rain"


def test_unplugging_a_wire_changes_nothing(pins: MockFactory) -> None:
    with _node(Settings(gpio="on")) as client:
        _press(pins, RAIN_PIN)
        _wait_until(lambda: _step(client) == "rain")
        _release(pins, RAIN_PIN)
        time.sleep(0.2)
        assert _step(client) == "rain"


def test_a_press_still_works_beside_the_http_steps(pins: MockFactory) -> None:
    with _node(Settings(gpio="on")) as client:
        assert client.post("/api/scenario/step").json() == {"step": "pressure_drop"}
        _press(pins, RAIN_PIN)
        _wait_until(lambda: _step(client) == "rain")
        assert client.post("/api/scenario/reset").json() == {"step": "normal_day"}


def test_a_sensor_playing_the_replay_shows_no_change_from_a_press(
    meshed_nodes: MeshedNodes, pins: MockFactory
) -> None:
    meshed_nodes.start_hub()
    meshed_nodes.start_sensor("s0", river_km=-12.2, gpio="on")
    assert meshed_nodes["hub"].post("/api/replay/start").status_code == 200
    scenario_water_rising_cm = 390
    _press(pins, WATER_RISING_PIN)
    _wait_until(lambda: _step(meshed_nodes["s0"]) == "water_rising")
    assert _water_cm(meshed_nodes["s0"]) < scenario_water_rising_cm


@pytest.fixture
def no_gpio_library(monkeypatch: pytest.MonkeyPatch) -> None:
    """A laptop that never installed gpiozero: importing it raises ImportError."""
    monkeypatch.setitem(sys.modules, "gpiozero", None)


def test_a_node_with_gpio_off_starts_and_steps_without_the_library(
    no_gpio_library: None,
) -> None:
    with _node(Settings(gpio="off")) as client:
        assert client.post("/api/scenario/step").json() == {"step": "pressure_drop"}


def test_a_node_on_a_laptop_starts_without_gpio_on_auto(
    no_gpio_library: None, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(breadboard, "PI_MODEL_FILE", tmp_path / "no-such-model-file")
    with _node(Settings(gpio="auto")) as client:
        assert client.post("/api/scenario/step").json() == {"step": "pressure_drop"}


def test_a_pi_whose_breadboard_cannot_start_still_runs_on_auto(
    no_gpio_library: None, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    model = tmp_path / "model"
    model.write_text("Raspberry Pi 4 Model B Rev 1.5")
    monkeypatch.setattr(breadboard, "PI_MODEL_FILE", model)
    with _node(Settings(gpio="auto")) as client:
        assert client.post("/api/scenario/step").json() == {"step": "pressure_drop"}


def test_gpio_on_stops_the_node_when_the_breadboard_cannot_start(
    no_gpio_library: None,
) -> None:
    with pytest.raises(RuntimeError, match="NODE_GPIO"):
        _node(Settings(gpio="on"))


def test_every_pin_jumps_to_a_step_the_scenario_has() -> None:
    assert set(breadboard.STEP_PINS.values()) <= set(SCENARIO_STEPS)
    assert breadboard.RESET_PIN not in breadboard.STEP_PINS


def test_jumping_to_a_step_the_scenario_lacks_is_an_error() -> None:
    with pytest.raises(ValueError):
        Scenario().go_to("no_such_step")  # type: ignore[arg-type]
