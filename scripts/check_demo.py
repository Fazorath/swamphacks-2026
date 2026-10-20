"""Checks a running scripts/run-demo.sh end to end over HTTP: Nodes, registry, Replay controls,
Community Warning, Official Alerts and the pack-server half of "cut the internet". Run it
while the demo is up: python3 scripts/check_demo.py. It stops the pack server; restart the demo after.
Exits 1 if any check fails or the demo cannot be reached."""
import json
import os
import signal
import sys
import time
import urllib.error
import urllib.request

BASE_PORT = int(os.environ.get("DEMO_BASE_PORT", "8000"))  # the Hub; S0 to S3 take the next four
PACK_PORT = 8900  # fixed in run-demo.sh
HUB = f"http://127.0.0.1:{BASE_PORT}"
SENSOR_PORTS = {"s0": BASE_PORT + 1, "s1": BASE_PORT + 2, "s2": BASE_PORT + 3, "s3": BASE_PORT + 4}
PACK_SERVER_PID_FILE = os.path.join(os.path.dirname(__file__), "..", ".demo", "pack-server.pid")

results = []


def node_url(port, path=""):
    return f"http://127.0.0.1:{port}{path}"


def get(url):
    with urllib.request.urlopen(url, timeout=5) as response:
        return response.status, response.read()


def get_json(url):
    return json.loads(get(url)[1])


def post(path, body=None):
    request = urllib.request.Request(
        HUB + path,
        data=json.dumps(body or {}).encode(),
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            return response.status, response.read().decode()
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode()


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


def wait_for(read, seconds):
    """Polls read() until it returns something truthy; None after `seconds`. The last error is
    printed so a Node that never answers is not mistaken for one that answered empty."""
    deadline = time.time() + seconds
    last_error = None
    while time.time() < deadline:
        try:
            value = read()
            if value:
                return value
        except (urllib.error.URLError, OSError, ValueError) as error:
            last_error = error
        time.sleep(1)
    if last_error is not None:
        print(f"  (last error while waiting: {type(last_error).__name__}: {last_error})", flush=True)
    return None


def run_checks():
    # 1. Every Node answers and serves the dashboard
    nodes = [("hub", BASE_PORT)] + list(SENSOR_PORTS.items())
    for name, port in nodes:
        label = f"{name} :{port} serves dashboard"
        try:
            status, body = get(node_url(port, "/"))
            check(label, status == 200 and b'<div id="root"' in body)
        except (urllib.error.URLError, OSError) as error:
            check(label, False, type(error).__name__)
    if not results[0][1]:
        raise SystemExit("the Hub is not answering; is scripts/run-demo.sh running?")

    # 2. Registry
    registry = get_json(HUB + "/api/registry")
    entries = registry.get("nodes", registry if isinstance(registry, list) else [])
    registration = {entry.get("name"): entry.get("status") for entry in entries}
    check(
        "S0-S3 registered with Hub",
        all(registration.get(name) == "registered" for name in SENSOR_PORTS),
        json.dumps(registration),
    )

    # 3. Cache pack on Hub and a Sensor
    for port in (BASE_PORT, SENSOR_PORTS["s3"]):
        label = f"cache pack ready on :{port}"
        try:
            status, _ = get(node_url(port, "/api/cache-pack"))
            check(label, status == 200)
        except (urllib.error.URLError, OSError) as error:
            check(label, False, str(error)[:80])

    # 4. Hub hears all Nodes
    state = get_json(HUB + "/api/state")
    heard_names = sorted(node.get("name") for node in state.get("nodes", []))
    check(
        "Hub state lists hub + s0-s3",
        set(SENSOR_PORTS) <= set(heard_names),
        ",".join(map(str, heard_names)),
    )

    # 5. Replay controls
    phases = get_json(HUB + "/api/replay/phases").get("phases", [])
    check("phases endpoint lists 8 phases", len(phases) == 8, str(len(phases)))
    check("rate x30", post("/api/replay/rate", {"rate": 30})[0] == 200)
    check("rate x1 refused", post("/api/replay/rate", {"rate": 1})[0] == 422)
    check("reset", post("/api/replay/reset")[0] == 200)
    replay = get_json(HUB + "/api/replay")
    check("reset = paused", "paused" in json.dumps(replay), json.dumps(replay)[:160])
    check("start", post("/api/replay/start")[0] == 200)
    check("pause", post("/api/replay/pause")[0] == 200)
    check("resume", post("/api/replay/resume")[0] == 200)
    check("jump to unknown phase refused", post("/api/replay/jump", {"phase": "nope"})[0] == 422)

    # 6. Collapse -> Community Warning
    check("jump collapse", post("/api/replay/jump", {"phase": "collapse"})[0] == 200)
    warnings = wait_for(lambda: get_json(HUB + "/api/state").get("community_warnings"), 30)
    check(
        "Community Warning after Collapse",
        warnings,
        json.dumps(warnings)[:160] if warnings else "none in 30 s",
    )
    sensor_state = get_json(node_url(SENSOR_PORTS["s2"], "/api/state"))
    check("Sensor s2 also holds the warning", sensor_state.get("community_warnings"))

    # 7. Official alerts
    check("jump dhm-sms", post("/api/replay/jump", {"phase": "dhm-sms"})[0] == 200)
    official_alerts = wait_for(
        lambda: get_json(node_url(SENSOR_PORTS["s3"], "/api/state")).get("official_alerts"), 15
    )
    check(
        "Official Alerts reach s3",
        official_alerts,
        f"{len(official_alerts) if official_alerts else 0} alerts",
    )

    # 8. Cut the internet half 1: stop the pack server, readings keep flowing
    with open(PACK_SERVER_PID_FILE) as pid_file:
        os.kill(int(pid_file.read()), signal.SIGTERM)
    time.sleep(1)
    try:
        get(node_url(PACK_PORT, "/cache-pack.zip"))
        check("pack server stopped", False)
    except (urllib.error.URLError, OSError):
        check("pack server stopped", True)
    time.sleep(8)
    state_after_cut = get_json(HUB + "/api/state")
    ages = {node.get("name"): node.get("age_s") for node in state_after_cut.get("nodes", [])}
    fresh = [name for name, age in ages.items() if isinstance(age, (int, float)) and age < 10]
    # By dhm-sms (09:15) the storyline has s1 and s2 silent; only s3 is still reporting.
    check("readings still fresh on Hub after cut", "s3" in fresh, json.dumps(ages))

    # 9. End and Reset
    check("jump end", post("/api/replay/jump", {"phase": "end"})[0] == 200)
    time.sleep(2)
    check("resume at end refused", post("/api/replay/resume")[0] == 409)
    check("final reset", post("/api/replay/reset")[0] == 200)


def main():
    run_checks()
    passed = sum(ok for _, ok, _ in results)
    print(f"\n{passed}/{len(results)} passed")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
