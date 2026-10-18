"""The Pi's Breadboard: touching a wire from the 3.3 V pin to an input pin is a press."""

import logging
from collections.abc import Callable
from functools import partial
from pathlib import Path
from typing import Literal

logger = logging.getLogger(__name__)

GpioMode = Literal["auto", "on", "off"]

# BCM pin numbers; pi/README.md lists the same table with the physical pin numbers.
STEP_PINS: dict[int, str] = {17: "pressure_drop", 27: "rain", 22: "water_rising"}
RESET_PIN = 23

# A jumper wire bounces for a few milliseconds when it touches the pin.
DEBOUNCE_SECONDS = 0.05

PI_MODEL_FILE = Path("/proc/device-tree/model")


def runs_on_a_raspberry_pi() -> bool:
    try:
        return "Raspberry Pi" in PI_MODEL_FILE.read_text(errors="replace")
    except OSError:
        return False


class Breadboard:
    """Releasing a wire does nothing, so taking a hand off the board never undoes the storm."""

    def __init__(self, jump_to: Callable[[str], None], reset: Callable[[], None]) -> None:
        # Imported here so a laptop without the library never needs it.
        from gpiozero import Button

        def pressed(do: Callable[[], None]) -> Callable[[], None]:
            def on_press() -> None:
                try:
                    do()
                except Exception:
                    # gpiozero calls this on its own thread; one bad press must not end the board.
                    logger.exception("could not act on a Breadboard press")

            return on_press

        actions: dict[int, Callable[[], None]] = {
            pin: partial(jump_to, step) for pin, step in STEP_PINS.items()
        }
        actions[RESET_PIN] = reset
        self._buttons = []
        for pin, action in actions.items():
            # pull_up=False uses the Pi's pull-down, so an empty pin reads "not pressed".
            button = Button(pin, pull_up=False, bounce_time=DEBOUNCE_SECONDS)
            button.when_pressed = pressed(action)
            self._buttons.append(button)

    def close(self) -> None:
        for button in self._buttons:
            button.close()


def open_breadboard(
    mode: GpioMode, jump_to: Callable[[str], None], reset: Callable[[], None]
) -> Breadboard | None:
    """None when the Node runs without GPIO. "on" insists; "auto" gives up with a log line."""
    if mode == "off" or (mode == "auto" and not runs_on_a_raspberry_pi()):
        return None
    try:
        return Breadboard(jump_to, reset)
    except Exception as error:
        if mode == "on":
            raise RuntimeError(
                f"NODE_GPIO=on but the Breadboard could not start ({error}); "
                "set NODE_GPIO=off to run without it"
            ) from error
        logger.exception("this looks like a Raspberry Pi but the Breadboard could not start")
        return None
