# The Pi: Breadboard and hotspot

The Raspberry Pi 4 is the stage Node. A wire touched to a Breadboard pin jumps its Scenario, and its Wi-Fi is the hotspot every laptop and phone joins. Words follow `CONTEXT.md`. Neither part is needed to run a Node: on a laptop, or on the Pi with `NODE_GPIO=off`, the Scenario steps from the keyboard or `POST /api/scenario/step`.

## Pin table

Four inputs. Each pin uses the Pi's internal pull-down, so a pin with nothing plugged in reads "not pressed". A press is a wire from a **3.3 V** pin to the input pin; unplugging it does nothing.

| Input | BCM pin | Physical pin | Effect |
|---|---|---|---|
| Pressure drop | 17 | 11 | Scenario jumps to `pressure_drop` |
| Rain | 22 | 15 | Scenario jumps to `rain` |
| Water rising | 5 | 29 | Scenario jumps to `water_rising` |
| Reset | 16 | 36 | Scenario goes back to `normal_day` |
| 3.3 V (the wire's source) | – | 1 or 17 | – |

The table lives in `node/src/storm_shield/breadboard.py`; change both together.

A press jumps straight to its step, so pressing out of order or twice is safe. It changes only this Node, so one Node going High cannot raise a Community Warning by itself. While this Node plays a Replay (its Sensor follows an Event clock that is playing or paused) a press changes nothing you can see; the Scenario moves underneath and shows when the Replay is stopped.

## Wiring

1. Do not use 5 V. A 5 V wire on a GPIO pin can damage the Pi. Use only physical pin 1 or 17 (3.3 V).
2. With the Pi powered off, run a jumper from physical pin 1 to a breadboard power rail.
3. Power the Pi on and measure the rail against a ground pin (for example physical pin 6) with a multimeter. It must read about 3.3 V, never 5 V. Fix the wiring before going on.
4. Run one jumper from each input pin in the table to its own spot on the breadboard, so a loose end is easy to plug into the rail.
5. A press is touching or plugging that wire into the rail. Pull it out to let go.

## Running the Node with the Breadboard

```
pi/install.sh
cd node && NODE_GPIO=on .venv/bin/storm-shield-node
```

`pi/install.sh` installs the system libraries `lgpio` builds against (`swig`, `python3-dev`, `build-essential`, `liblgpio-dev`) and runs `uv sync --group pi`, which adds `gpiozero` and `lgpio`. Both are in the lockfile, so nothing is installed by hand.

On the Pi, always sync with the group: `uv sync --group pi`. A plain `uv sync` (also run by `scripts/run-live.sh` on every restart, so don't use that script on the Pi) removes `lgpio`, and the Node then stops with `PinFactoryFallback: Falling back from lgpio: No module named 'lgpio'` and, ending in `OSError: [Errno 22]`, `NODE_GPIO=on but the Breadboard could not start`. Run `pi/install.sh` or `uv sync --group pi` again.

`NODE_GPIO` is `auto` by default: on only when the machine says it is a Raspberry Pi, so a laptop never loads GPIO. `on` stops the Node with an error if the pins cannot be read; `off` never loads the library. With `auto`, a Pi that cannot start the Breadboard logs why and keeps running without it. Give every Node its own `NODE_LATITUDE` and `NODE_LONGITUDE`.

## Hotspot

Needs NetworkManager (Raspberry Pi OS Bookworm or Trixie; the team's Pi is on Trixie). Put `HOTSPOT_SSID` and `HOTSPOT_PASSWORD` (8 or more characters) in the repo's `.env`, which is never committed.

```
pi/setup-hotspot.sh up     # creates the connection and brings it up; safe to run again
pi/setup-hotspot.sh down   # off; the Pi is an ordinary Node again
```

- It never starts at boot. Run `up` yourself.
- The Pi's Wi-Fi is the access point while it is up, so it cannot also join another Wi-Fi. While setting up, SSH in over Ethernet; once the hotspot is on you can also SSH to `10.88.0.1` from a laptop that joined it.
- The hotspot hands out addresses (phones need that) and shares whatever uplink the Pi has. **With Ethernet plugged into the Pi, hotspot clients have internet.** Unplug the Pi's cable before the demo so "internet off" is real; the script warns if Ethernet is connected. The Pi has no other uplink, so unplugging the Hub laptop's tether then cuts the internet.
- The password is passed to `nmcli` as an argument, so another user on the Pi could see it in `ps` for a moment. Quote values in `.env` that contain spaces or `$` (the script reads the file as shell, like `scripts/run-live.sh`).
- The Pi is at `10.88.0.1`. Phones open `http://10.88.0.1:8000` or the Hub's address. It is not NetworkManager's default `10.42.0.1` on purpose: a laptop sharing its connection over an Ethernet cable is also `10.42.0.1`, so `ssh 10.42.0.1` reached the laptop ("connection refused") instead of the Pi.
- If it misbehaves, a phone's hotspot is the fallback: AutoInterface already worked over an iPhone hotspot (`docs/agents/lessons.md`, ticket 0004).

## Manual check (not done until done on the real Pi)

- [ ] Rail measured at 3.3 V.
- [x] `pi/setup-hotspot.sh up`; a laptop joins the hotspot and opens the Pi's dashboard (done on the real Pi, 2026-10-18).
- [ ] With the Pi's Ethernet unplugged, a phone on the hotspot has no internet.
- [x] Touching each of the three step wires changes the Scenario step and the readings on the laptop's dashboard (done on the real Pi, 2026-10-18).
- [ ] The reset wire returns it to normal day.
- [ ] Unplugging a wire changes nothing, and an unplugged pin never presses by itself.
- [ ] `pi/setup-hotspot.sh down`; the Node still works on a normal network.

Laptop rehearsal covers only the software path (mock pins in `node/tests/test_breadboard.py`). It proves nothing about the wiring, wire bounce, the hotspot or discovery over it.
