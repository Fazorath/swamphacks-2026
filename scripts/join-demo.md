# Audience Node runbook

`scripts/join-demo.sh <hub address> <town>` (or `<name> <lat> <lon>`) makes a laptop a Node on the demo Mesh:
a dot with the `REAL` ring on the God's Eye View, in a Nepal town, that a volunteer can switch
off by turning its Wi-Fi off. Its readings come from the Event's surface, so say out loud that the
numbers are simulated; the Node and the Mesh are real.

The Hub laptop must be running `scripts/run-demo.sh`. It listens on Wi-Fi discovery and on TCP
(port 4242, `DEMO_TCP_PORT`) beside its loopback Mesh, so either kind of audience laptop can join.

## Pick how the laptop runs

| Laptop | How | How it finds the Hub |
|---|---|---|
| Linux, with the repo set up | `scripts/join-demo.sh <hub address> <town>` | Wi-Fi discovery (the real Mesh claim) |
| Linux, no setup | the Docker image with `--network host` and `-e JOIN_MESH=auto` | Wi-Fi discovery |
| Windows (or anything with Docker Desktop) | the Docker image | dials the Hub's TCP port: Docker Desktop sits behind a VM's NAT, so Wi-Fi discovery cannot cross it |

WSL2 sits behind NAT like Docker Desktop, so inside WSL2 run `JOIN_MESH=tcp scripts/join-demo.sh <hub address> <town>`.
A Hub started with `scripts/run-live.sh` (the Pi) has the TCP listener on; see `pi/README.md`.

macOS native and Windows without Docker are not supported.

Towns (name and approximate position): `Dhunche`, `Trishuli`, `Kakani`, `Dhading`, `Kathmandu`.
Any other name needs a latitude and longitude after it. Two laptops need two different names.

## Prepare the laptop (once, with internet)

- **Linux native:** as `scripts/demo-setup.md` step 1 to 2 (`uv sync`, `pnpm install`); the first
  run builds the dashboard. Nothing is downloaded after that.
- **Docker:** `docker build -f scripts/join-demo.Dockerfile -t storm-shield-join .` from the repo
  root. Docker Desktop must be running.

Then run it once against the Hub (below) so the laptop gets its Node id, and accept it. The Node id
lives in `.join-demo/data` (Linux) or the `storm-shield-join-data` volume (Docker); keep that and
the laptop stays accepted. Deleting it gives a new Node id and needs a new accept.

## Run it

The Hub address is the Hub laptop's address on the shared network and the dashboard port, which
`run-demo.sh` prints ("Phones on this laptop's networks").

```
scripts/join-demo.sh 192.168.1.20 Dhunche
docker run --rm -it -v storm-shield-join-data:/data storm-shield-join 192.168.1.20 Dhunche
docker run --rm -it --network host -e JOIN_MESH=auto -v storm-shield-join-data:/data storm-shield-join 192.168.1.20 Dhunche
```

(Linux native, Docker on Windows, Docker on Linux.) Use `-it`, or Ctrl-C does not reach the script. A Hub on a non-default TCP port needs `-e JOIN_HUB_TCP_PORT=<port>`.

The script refuses to start if the Hub does not answer, if the address is not a Hub, or if its own
ports are in use. It then prints its Node id and the accept step, and says "Heard the Hub over the
Mesh" and "Registered" as they happen. If the Hub is not heard within 60 s it prints what to check.

## Accept it on the Hub (once, before the show)

Either click **Accept** on the laptop's name in the Hub Panel's Registry tab, or paste the `curl`
line the script printed on any machine that can reach the Hub. The registry is one signed packet, so it holds about 8 Nodes
with short names and 4 to 5 with 32-character ones: the Hub, S0 to S3, the Pi and an audience
laptop make 7, so keep names short. A ninth is refused with a message.

## Hand it to a volunteer

1. Start the script and check the dot is on the God's Eye View with `REAL` and the town's name.
2. Tell the volunteer: "Turn your Wi-Fi off." After about 5 seconds the dot loses its glow
   (Contact lost); after 15 it goes grey (Stale).
3. "Now turn it back on." The dot returns on its own; nobody restarts anything.

If the volunteer **closes the lid** instead, the laptop sleeps and the result is the same as Wi-Fi
off, but it may take longer to wake. Better: a teammate turns the laptop's Wi-Fi off from the
keyboard, or the Hub-side teammate says "Wi-Fi off" and does it. Keep the lid open on stage.

## If the Hub is not heard

The script's fix list, in order of how often it was the cause:

- **firewalld** on either laptop blocks discovery: `sudo firewall-cmd --zone=<zone> --add-port=29716/udp --add-port=42671/udp`
  (the zone of the Wi-Fi link; gone at reboot).
- **Docker on the Hub laptop** blocks connection sharing if the Hub laptop shares its internet over
  a cable: `sudo iptables -I DOCKER-USER -i <cable> -o <wifi> -j ACCEPT`.
- The **macOS firewall** on a Mac Hub laptop: allow incoming connections for Python, or switch it
  off for the demo.
- A **guest or hotel Wi-Fi** that isolates clients, or a Hub on a different network.
- In Docker without host networking, discovery cannot work; the image already uses TCP, so check
  that the Hub laptop's TCP port (4242) is reachable.

## What this does not prove

It was rehearsed on one machine over loopback and local TCP. Wi-Fi discovery between two real
laptops, `--network host` on a Linux Docker host, a Windows laptop other than the Hub's own machine,
and the lid-closed case are unproven. The image itself was built and run on Docker Desktop (Windows)
against a Hub on the same machine, over TCP, with a pause and unpause standing in for Wi-Fi off and on.
