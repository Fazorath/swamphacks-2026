# Breadboard drives the Scenario on the Pi

**Status:** ready-for-agent

Ticket: `docs/tickets/0016-breadboard-drives-the-scenario.md`. Parent spec: `docs/specs/storm-shield.md` (stories 35 and 36, "Scenario" and "Network layout"). Words follow `CONTEXT.md` ("Breadboard", "Scenario"). The Replay is the demo's driver now (ADR 0004); the Breadboard is the physical way to drive the Scenario that remains.

## Problem Statement

On stage the presenter wants to show the storm arriving by touching wires to a board, not by typing on a laptop. Today the Scenario can only be stepped from the keyboard or over HTTP, so the Raspberry Pi has no physical controls at all. The team has one Pi 4 and a breadboard with jumper wires and no buttons, so a "press" has to be a wire plugged from the 3.3 V pin into an input pin.

The Pi must also be the network: a Wi-Fi hotspot with no internet that every laptop and phone joins, so the demo can show the system working with the venue's network and the internet gone. Nobody has written down how to set that up, or which pin does what, so wiring and setup are repeated from memory.

Two risks need handling. A bare wire on a GPIO pin can float and fire random presses, and a wire contact bounces for a few milliseconds. And a laptop running the same code must not break because it has no GPIO.

## Solution

The Pi's Node reads four Breadboard inputs. Plugging a wire from the 3.3 V pin into an input pin is a press:

- pressure drop, rain and water rising each jump the Scenario to that step;
- a fourth input resets it to normal day.

The Pi's readings change within the next publish, and a laptop dashboard joined to the Pi's hotspot shows the new step and readings. A press changes only the Pi's own Node, so a single Node going High cannot raise a Community Warning by itself. That is also the point the demo makes about one bad Node. During a Replay the Sensor follows the Replay's track, so a press does nothing visible until the Replay is stopped.

On a machine that is not a Pi, the Node starts without loading any GPIO code and the keyboard and HTTP steps work as before.

A script sets the Pi up as a Wi-Fi hotspot with no internet; it is off until someone runs it and can be switched off again, after which the Pi is an ordinary Node. A README next to the code holds the pin table, the wiring and the hotspot notes.

## User Stories

1. As the presenter, I want to plug a wire into the pressure-drop pin, so that the Pi's Node jumps to the pressure-drop step.
2. As the presenter, I want to plug a wire into the rain pin, so that the Pi's Node jumps to the rain step.
3. As the presenter, I want to plug a wire into the water-rising pin, so that the Pi's Node jumps to the water-rising step.
4. As the presenter, I want to plug a wire into a reset pin, so that the Pi's Node goes back to normal day and I can rehearse again.
5. As the presenter, I want a press to jump straight to a named step, so that pressing out of order or twice on stage cannot leave the Scenario somewhere I did not intend.
6. As the presenter, I want unplugging a wire to change nothing, so that taking my hand off the board cannot undo the storm.
7. As the presenter, I want the readings on a laptop dashboard to change after each press, so that the audience sees the Breadboard drive the system.
8. As the presenter, I want the Scenario step shown in the Node Panel to match what I pressed, so that I can check the board without counting wires.
9. As a teammate rehearsing on a laptop, I want the Node to start with no GPIO and no error, so that I can run the same code without a Pi.
10. As a teammate rehearsing on a laptop, I want to keep stepping and resetting the Scenario from the keyboard and over HTTP, so that nothing I used before stopped working.
11. As a teammate on a laptop, I want to force GPIO off or on with a setting, so that a Pi that is not detected, or a laptop that is, can still be told what to do.
12. As the Pi's operator, I want an input pin that nothing is plugged into to read as "not pressed", so that a floating pin never fires a random press.
13. As the Pi's operator, I want a wire's contact bounce to count as one press, so that a single plug-in does not repeat the step.
14. As the Pi's operator, I want the Node to start even if the GPIO library or a pin cannot be used, with a clear log line, so that a Pi problem never takes the dashboard down.
15. As the presenter, I want a press to affect only the Pi's Node, so that one Node going High cannot raise a Community Warning on its own.
16. As an audience member, I want to see that a single misbehaving Node does not cause a false alarm, so that I trust the warnings when two Nodes agree.
17. As the presenter, I want a press during a Replay to be harmless, so that touching a wire by accident does not corrupt the replayed flood.
18. As a teammate reading the notes, I want it written that a press does nothing visible mid-Replay, so that nobody wonders on stage why the board "stopped working".
19. As the Pi's operator, I want one script that sets up the Wi-Fi hotspot, so that I do not repeat the commands from memory.
20. As the Pi's operator, I want the hotspot to start off and only come on when I run the script, so that a fresh Pi never takes over its own Wi-Fi unexpectedly.
21. As the Pi's operator, I want one command that turns the hotspot off, so that the Pi can act as a normal Node on a real network.
22. As the Pi's operator, I want the hotspot to have no internet, so that "internet off" on stage is real and the Pi is the network.
23. As the Pi's operator, I want the hotspot name and password to come from my gitignored `.env`, so that nothing secret is committed to a repo that goes public.
24. As a teammate, I want `.env.example` to list the hotspot settings with blank values and a one-line comment each, so that I know what to set.
25. As a teammate, I want the script to stop with a clear message if the name or password is missing, so that I do not create an open network by mistake.
26. As the Pi's operator, I want running the script twice to leave one working hotspot, so that a rerun is safe.
27. As the Pi's operator, I want the notes to say the Pi's Wi-Fi is busy while the hotspot is on, so that I use Ethernet for SSH and do not lock myself out.
28. As the Pi's operator, I want the pin table next to the code, so that I can wire the board without reading Python.
29. As the Pi's operator, I want the wiring written so that every wire comes from the 3.3 V pin, with a warning never to use 5 V, so that I cannot damage the Pi.
30. As the Pi's operator, I want the notes to tell me to check the rail with a multimeter before plugging in, so that a wrong rail is caught first.
31. As a teammate, I want a wiring diagram or pin table kept in the repo, so that the next person can rebuild the board.
32. As a teammate, I want the manual check written as a short list (press each wire, watch a laptop on the hotspot), so that we know when the Pi side is proven.
33. As a teammate, I want the manual check to stay marked not done until it is done on the real Pi, so that nobody reports a hardware check that was only rehearsed.
34. As a reviewer, I want the GPIO code to be tested without a Pi, so that CI-style checks run on any laptop.
35. As a reviewer, I want the pin-to-step mapping in one place, so that the pin table and the code cannot drift apart.

## Implementation Decisions

- **Scenario gains a jump.** It can be set to a named step as well as stepped forward and reset. Jumping to a step it is already on is harmless. An unknown step name is an error, not a silent no-op.
- **A new Breadboard module** owns the four inputs and the pin-to-step mapping: three Scenario steps and one reset. It hides the GPIO library behind a small interface: start it with the Node's Scenario, stop it on shutdown. Callers never see a pin.
- **Press semantics.** A press is the rising edge of an input going high. Releasing does nothing. Switch-style hold behaviour is not built.
- **Hardware setup.** Each input uses the Pi's internal pull-down so an empty pin reads low, and a 50 ms debounce so one plug-in is one press. The default pins (BCM numbering) are 17 pressure drop, 27 rain, 22 water rising and 23 reset. The mapping lives in one place and the pin table in the README is generated from, or checked against, it by hand once.
- **GPIO library.** `gpiozero`. It is an optional dependency group installed on the Pi and also a dev dependency, so tests can use its mock pin factory on any machine. The Node imports it only when GPIO is on.
- **Setting `NODE_GPIO`** takes `auto` (default), `on` or `off`. `auto` turns GPIO on when the machine reports it is a Raspberry Pi and off otherwise. `on` on a machine where the library or pins are unusable stops the Node with an error that names the setting; `auto` that fails logs and carries on without GPIO.
- **Effect on the Node.** A press calls the same Scenario the HTTP step and reset use, under the same lock, so a press and an HTTP step cannot interleave. The Scenario's readings change on the next publish; nothing new goes over the Mesh, and no message type is added.
- **Replay.** Unchanged. A Sensor on a Replay track ignores the Scenario while the Event clock plays or is paused, so a press has no visible effect then. The Scenario still moves underneath and shows when the Replay stops.
- **Node HTTP API.** No new endpoints. The Scenario step already appears in the state snapshot, so the Node Panel shows a press with no dashboard change.
- **Hotspot script.** A shell script under a `pi/` folder wraps `nmcli` to create and bring up a Wi-Fi access point with no internet sharing. It reads the name and password from the environment, fails with a message when either is missing, is safe to run twice, and has a documented command to bring the connection down. It does not start at boot.
- **Hotspot settings.** `HOTSPOT_SSID` and `HOTSPOT_PASSWORD`, unprefixed like the other non-Node settings, listed in `.env.example` with blank values and one-line comments. The password is fixed and kept in the gitignored `.env`, never in the repo. The Node itself does not read them; only the script does.
- **README next to the code** (under `pi/`): pin table (BCM and physical numbers), wiring steps from the 3.3 V pin with a no-5-V warning and the multimeter check, hotspot setup and turn-off commands, a note that the Pi's Wi-Fi is taken while the hotspot is up (use Ethernet), the mid-Replay note, and the manual check list.
- **No Mesh or wire-format change.** The Breadboard is local input only; a press is not shared. Reaching every Node from one press is out of scope.
- **Glossary.** `CONTEXT.md` already defines Breadboard and the updated Scenario (committed in the grilling).

## Testing Decisions

- **A good test** presses an input and checks what a Viewer or the API sees: the Scenario step in the state snapshot and the readings the Node publishes. It does not check which function ran or how the library is called.
- **One seam, the existing Seam A** (the Node HTTP API with the in-memory Mesh, `MeshedNodes`): start a Node with the Breadboard on and `gpiozero`'s mock pin factory, drive a mock pin high, and read `/api/state` and the readings. This is the highest seam that reaches the behaviour. The hotspot script and real pins are not unit-tested.
- **Behaviours covered:**
  - each of the three step inputs jumps to its step;
  - the reset input returns to normal day;
  - a press out of order jumps straight to its step and a second press of the same input changes nothing more;
  - releasing an input changes nothing;
  - a burst of rapid high-low-high on one input inside the debounce window counts as one press;
  - `NODE_GPIO=off` starts a Node that never imports the GPIO library and still steps over HTTP;
  - `auto` on a machine that is not a Pi starts without GPIO;
  - `on` with an unusable library stops the Node with an error that names the setting;
  - a Sensor on a Replay track shows no visible change after a press, and shows the pressed step once the Replay is stopped.
- **The Community Warning story** (a lone Pi Node High raises no warning) rests on the existing Registry and warning tests; no new test is added for it unless the Breadboard can reach a state those tests do not.
- **Prior art:** `test_node_api.py` (Scenario step and reset over HTTP), `test_replay_drives_the_sensor_nodes.py` (Scenario versus Replay track), and the `MeshedNodes` harness. Any new Node setting that touches disk or hardware is set up in `MeshedNodes._settings`.
- **Not proven by tests, only by a manual check on the real Pi:** real pin wiring, contact bounce on real jumper wires, the hotspot, and discovery over it. Per `AGENTS.md`, never report this check as passed from a laptop.

## Out of Scope

- Pressing a Breadboard input to move other Nodes, or any new Mesh message for it.
- Switch-style behaviour (flip off to go back a step) and any other use of a held input.
- Controlling the Replay (Start, Pause, Reset) from the Breadboard.
- Real buttons, switches, analog sensors or any input other than the four pins.
- Starting the Node or the hotspot at boot (a systemd unit), and any dashboard change.
- Feeding the hotspot name and password to the Join card's Wi-Fi QR code; a later ticket does that.
- Hotspot hardening beyond a password-protected WPA network (client limits, captive portals, DHCP tuning).
- Debounce or pin changes at run time, and any settings screen for them.

## Further Notes

- The team's tools are a Pi 4, a breadboard and jumper wires. A press is a wire from the 3.3 V pin to an input pin. Touching a pin with a wire is rough, so the pull-down and the debounce are what make it usable.
- Check the 3.3 V rail with a multimeter before plugging anything in. A 5 V wire on a GPIO pin can damage the Pi.
- When the hotspot is on, the Pi's Wi-Fi is the access point, so it cannot also be a Wi-Fi client. Use Ethernet to SSH in.
- AutoInterface already worked between a Pi and a laptop over an iPhone hotspot (lessons log, ticket 0004). If the Pi's own hotspot misbehaves, that is the fallback.
- Update the 0016 ticket's first bullet when building: the inputs jump to a named step instead of stepping forward.
