# The Pi: hotspot

The Raspberry Pi 4 is the stage Node, and its Wi-Fi is the hotspot every laptop and phone joins. Words follow `CONTEXT.md`. The hotspot is not needed to run a Node. Give every Node its own `NODE_LATITUDE` and `NODE_LONGITUDE`.

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
- The same two lines are read by the Node, which serves them at `GET /api/join` for the dashboard's Join card. That route answers only callers on the Node's own machine, so the card shows the hotspot name and password in the Hub's own browser (the Pi's, or a laptop running the Hub) and nowhere else. Without `HOTSPOT_SSID` the route is a 404 and the card has no codes to show. `HOTSPOT_DASHBOARD_URL` overrides the address the card sends phones to.
- The Pi is at `10.88.0.1`. Phones open `http://10.88.0.1:8000` or the Hub's address. It is not NetworkManager's default `10.42.0.1` on purpose: a laptop sharing its connection over an Ethernet cable is also `10.42.0.1`, so `ssh 10.42.0.1` reached the laptop ("connection refused") instead of the Pi.
- If it misbehaves, a phone's hotspot is the fallback: AutoInterface already worked over an iPhone hotspot (`docs/agents/lessons-archive.md`, ticket 0004).

## Laptops that cannot do Wi-Fi discovery (WSL2, Docker)

`scripts/run-live.sh` starts a Hub with a TCP listener on port 4242 (`NODE_ALSO_TCP_LISTEN`, on by default for a Hub there; set it to `0` to turn it off) beside Wi-Fi discovery. A laptop behind NAT, such as WSL2 or Docker Desktop, never hears the discovery multicast, so it dials that port instead:

```
JOIN_MESH=tcp scripts/join-demo.sh 10.88.0.1:8000 <town>
```

- A Hub started any other way (`uv run`, a service) has no listener until `NODE_ALSO_TCP_LISTEN=1` is in its environment. Check on the Pi with `ss -ltn | grep 4242`; from the laptop, `nc -vz 10.88.0.1 4242` says "refused" when nothing listens (a working ping proves only that something answered).
- Keep the Hub's `NODE_DATA_DIR`: the Hub's id lives there, and every Node's `HUB_IDENTITY` must match it. `join-demo.sh` reads the id from the Hub's `/api/state`.
- Accept the laptop's Sign-up on the Hub Panel's Registry tab. Until it is accepted, the Hub lists its readings but does not count them.
- The listener is open on every interface. Messages are signed, but do not leave a Hub running on a network you do not trust.

## Manual check (not done until done on the real Pi)

- [x] `pi/setup-hotspot.sh up`; a laptop joins the hotspot and opens the Pi's dashboard (done on the real Pi, 2026-10-18).
- [ ] With the Pi's Ethernet unplugged, a phone on the hotspot has no internet.
- [ ] `pi/setup-hotspot.sh down`; the Node still works on a normal network.

Laptop rehearsal covers only the software path. It proves nothing about the hotspot or discovery over it.
