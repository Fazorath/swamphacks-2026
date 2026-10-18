"""Checks a running scripts/run-demo.sh end to end over HTTP: Nodes, registry, Replay controls,
Community Warning, Official Alerts and the pack-server half of "cut the internet". Run it
while the demo is up: python3 scripts/check_demo.py. It stops the pack server; restart the demo after."""
import json, time, urllib.request

HUB = "http://127.0.0.1:8000"
results = []


def get(url):
    with urllib.request.urlopen(url, timeout=5) as r:
        body = r.read()
        return r.status, body


def j(url):
    return json.loads(get(url)[1])


def post(path, body=None):
    data = json.dumps(body or {}).encode()
    req = urllib.request.Request(HUB + path, data=data, method="POST",
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


def wait(fn, secs):
    end = time.time() + secs
    while time.time() < end:
        try:
            v = fn()
            if v:
                return v
        except Exception:
            pass
        time.sleep(1)
    return None


# 1. Every Node answers and serves the dashboard
for port, name in [(8000, "hub"), (8001, "s0"), (8002, "s1"), (8003, "s2"), (8004, "s3")]:
    try:
        st, body = get(f"http://127.0.0.1:{port}/")
        check(f"{name} :{port} serves dashboard", st == 200 and b"<div id=\"root\"" in body or b"root" in body)
    except Exception as e:
        check(f"{name} :{port} serves dashboard", False, type(e).__name__)

# 2. Registry
reg = j(HUB + "/api/registry")
entries = reg.get("nodes", reg if isinstance(reg, list) else [])
status = {e.get("name"): e.get("status") for e in entries}
check("S0-S3 registered with Hub", all(status.get(n) == "registered" for n in ["s0", "s1", "s2", "s3"]), json.dumps(status))

# 3. Cache pack on Hub and a Sensor
for port in (8000, 8004):
    try:
        st, _ = get(f"http://127.0.0.1:{port}/api/cache-pack")
        check(f"cache pack ready on :{port}", st == 200)
    except Exception as e:
        check(f"cache pack ready on :{port}", False, str(e)[:80])

# 4. Hub hears all Nodes
state = j(HUB + "/api/state")
names = sorted(n.get("name") for n in state.get("nodes", []))
check("Hub state lists hub + s0-s3", {"s0", "s1", "s2", "s3"} <= set(names), ",".join(map(str, names)))

# 5. Replay controls
phases = j(HUB + "/api/replay/phases")
check("phases endpoint lists 8 phases", len(phases.get("phases", [])) == 8, str(len(phases.get("phases", []))))
check("rate x30", post("/api/replay/rate", {"rate": 30})[0] == 200)
check("rate x1 refused", post("/api/replay/rate", {"rate": 1})[0] == 422)
check("reset", post("/api/replay/reset")[0] == 200)
rp = j(HUB + "/api/replay")
check("reset = paused", "paused" in json.dumps(rp), json.dumps(rp)[:160])
check("start", post("/api/replay/start")[0] == 200)
check("pause", post("/api/replay/pause")[0] == 200)
check("resume", post("/api/replay/resume")[0] == 200)
check("jump to unknown phase refused", post("/api/replay/jump", {"phase": "nope"})[0] == 422)

# 6. Collapse -> Community Warning
check("jump collapse", post("/api/replay/jump", {"phase": "collapse"})[0] == 200)
w = wait(lambda: j(HUB + "/api/state").get("warnings") or j(HUB + "/api/state").get("community_warnings"), 30)
check("Community Warning after Collapse", w, json.dumps(w)[:160] if w else "none in 30 s")
s = j("http://127.0.0.1:8003/api/state")
check("Sensor s2 also holds the warning", s.get("warnings") or s.get("community_warnings"))

# 7. Official alerts
check("jump dhm-sms", post("/api/replay/jump", {"phase": "dhm-sms"})[0] == 200)
oa = wait(lambda: j("http://127.0.0.1:8004/api/state").get("official_alerts"), 15)
check("Official Alerts reach s3", oa, f"{len(oa) if oa else 0} alerts")

# 8. Cut the internet half 1: stop the pack server, readings keep flowing
import os, signal
pid = int(open(os.path.join(os.path.dirname(__file__), "..", ".demo", "pack-server.pid")).read())
os.kill(pid, signal.SIGTERM)
time.sleep(1)
try:
    get("http://127.0.0.1:8900/cache-pack.zip")
    check("pack server stopped", False)
except Exception:
    check("pack server stopped", True)
time.sleep(8)
st2 = j(HUB + "/api/state")
ages = {n.get("name"): n.get("age_s") for n in st2.get("nodes", [])}
fresh = [n for n, a in ages.items() if isinstance(a, (int, float)) and a < 10]
check("readings still fresh on Hub after cut", {"s1", "s2", "s3"} <= set(fresh), json.dumps(ages))

# 9. End and Reset
check("jump end", post("/api/replay/jump", {"phase": "end"})[0] == 200)
time.sleep(2)
check("resume at end refused", post("/api/replay/resume")[0] == 409)
check("final reset", post("/api/replay/reset")[0] == 200)

print(f"\n{sum(ok for _, ok, _ in results)}/{len(results)} passed")
