import time
from collections.abc import Callable
from typing import Any

import pytest
from meshed_nodes import MeshedNodes

# 08:30 NPT on 26 Aug 2026, the first moment of the replay timeline.
REPLAY_START = 1787712300
RATE = 30
STALE_AFTER_SECONDS = 15


def _wait_until(condition: Callable[[], bool]) -> None:
    deadline = time.monotonic() + 5
    while not condition():
        assert time.monotonic() < deadline, "condition never became true"
        time.sleep(0.01)


def _event_clock(meshed_nodes: MeshedNodes, name: str) -> dict[str, object]:
    clock: dict[str, object] = meshed_nodes[name].get("/api/replay").json()
    return clock


def _heard_from(meshed_nodes: MeshedNodes, viewer: str, node: str) -> dict[str, Any]:
    nodes = meshed_nodes[viewer].get("/api/state").json()["nodes"]
    entry: dict[str, Any] = next(entry for entry in nodes if entry["id"] == node)
    return entry


def _water_cm(meshed_nodes: MeshedNodes, viewer: str, node: str) -> float:
    water_level: float = _heard_from(meshed_nodes, viewer, node)["measurements"]["water_level"][
        "value"
    ]
    return water_level


def _start_replay(meshed_nodes: MeshedNodes) -> None:
    assert meshed_nodes["hub"].post("/api/replay/start").status_code == 200


def test_a_replay_started_on_the_hub_reaches_every_node(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start_hub()
    meshed_nodes.start_sensor("s0", replay_track="S0")
    meshed_nodes.start_sensor("porch")
    _start_replay(meshed_nodes)
    for name in ("hub", "s0", "porch"):
        assert _event_clock(meshed_nodes, name) == {
            "v": 1,
            "kind": "replay",
            "state": "playing",
            "event_t": REPLAY_START,
            "rate": RATE,
        }


def test_every_node_counts_the_event_clock_on_its_own_clock(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start_hub()
    meshed_nodes.start_sensor("porch")
    _start_replay(meshed_nodes)
    meshed_nodes.advance(60)
    for name in ("hub", "porch"):
        assert _event_clock(meshed_nodes, name)["event_t"] == REPLAY_START + 60 * RATE


def test_a_sensors_readings_follow_its_track(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start_hub()
    meshed_nodes.start_sensor("s2", replay_track="S2")
    _start_replay(meshed_nodes)
    # 20 s later the Event clock reads 08:40, where Syabrubesi's gauge read 1.62 m.
    meshed_nodes.advance(20)
    _wait_until(lambda: _water_cm(meshed_nodes, "s2", "s2") == 162.0)
    assert _water_cm(meshed_nodes, "hub", "s2") == 162.0


def test_a_sensor_shows_the_surge_its_track_holds(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start_hub()
    meshed_nodes.start_sensor("s0", replay_track="S0")
    _start_replay(meshed_nodes)
    # 08:37:30 is 450 event seconds in, and S0's water has jumped from 0.7 m to 4.2 m.
    meshed_nodes.advance(15)
    _wait_until(lambda: _water_cm(meshed_nodes, "s0", "s0") == 420.0)


def test_a_sensor_whose_track_ends_goes_stale(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start_hub()
    meshed_nodes.start_sensor("s0", replay_track="S0")
    _start_replay(meshed_nodes)
    # S0 goes silent at 08:38, 480 event seconds, which is 16 s of real time.
    meshed_nodes.advance(20)
    time.sleep(0.2)
    for viewer in ("s0", "hub"):
        assert _heard_from(meshed_nodes, viewer, "s0")["age_s"] > STALE_AFTER_SECONDS


def test_a_node_with_no_track_keeps_the_scenario(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start_hub()
    meshed_nodes.start_sensor("porch")
    _start_replay(meshed_nodes)
    meshed_nodes.advance(20)
    assert _water_cm(meshed_nodes, "porch", "porch") == pytest.approx(20, abs=1)


def test_a_replay_message_not_from_the_hub_is_ignored(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start_sensor("s0", replay_track="S0")
    meshed_nodes.announce_replay("playing", REPLAY_START, sender="intruder")
    assert _event_clock(meshed_nodes, "s0")["state"] == "stopped"


def test_a_sensor_cannot_start_the_replay(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start_sensor("s0", replay_track="S0")
    assert meshed_nodes["s0"].post("/api/replay/start").status_code == 404


def test_a_node_that_joins_late_converges_after_a_repeat(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start_hub(replay_repeat_seconds=0.02)
    _start_replay(meshed_nodes)
    meshed_nodes.advance(10)
    meshed_nodes.start_sensor("late", replay_track="S1")
    _wait_until(lambda: _event_clock(meshed_nodes, "late")["state"] == "playing")
    assert _event_clock(meshed_nodes, "late")["event_t"] == REPLAY_START + 10 * RATE


def test_a_node_told_to_play_an_unknown_track_refuses_to_start(meshed_nodes: MeshedNodes) -> None:
    with pytest.raises(ValueError, match="S9"):
        meshed_nodes.start_sensor("s9", replay_track="S9")


def test_pausing_the_replay_holds_every_nodes_readings(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start_hub()
    meshed_nodes.start_sensor("s2", replay_track="S2")
    _start_replay(meshed_nodes)
    meshed_nodes.advance(20)
    assert meshed_nodes["hub"].post("/api/replay/pause").json()["state"] == "paused"
    held = REPLAY_START + 20 * RATE
    meshed_nodes.advance(60)
    for name in ("hub", "s2"):
        clock = _event_clock(meshed_nodes, name)
        assert (clock["state"], clock["event_t"]) == ("paused", held)
    _wait_until(lambda: _water_cm(meshed_nodes, "s2", "s2") == 162.0)
    assert meshed_nodes["hub"].post("/api/replay/resume").json()["state"] == "playing"
    meshed_nodes.advance(10)
    assert _event_clock(meshed_nodes, "s2")["event_t"] == held + 10 * RATE


def test_jumping_to_a_phase_moves_every_nodes_event_clock(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start_hub()
    meshed_nodes.start_sensor("porch")
    _start_replay(meshed_nodes)
    jump = meshed_nodes["hub"].post("/api/replay/jump", json={"phase": "dhm-sms"})
    assert jump.status_code == 200
    # DHM SMS is 09:15, 45 minutes after the replay starts.
    for name in ("hub", "porch"):
        clock = _event_clock(meshed_nodes, name)
        assert (clock["state"], clock["event_t"]) == ("playing", REPLAY_START + 45 * 60)


def test_jumping_while_paused_stays_paused(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start_hub()
    _start_replay(meshed_nodes)
    meshed_nodes["hub"].post("/api/replay/pause")
    meshed_nodes["hub"].post("/api/replay/jump", json={"phase": "border"})
    clock = _event_clock(meshed_nodes, "hub")
    assert (clock["state"], clock["event_t"]) == ("paused", REPLAY_START + 10 * 60)


def test_jumping_to_an_unknown_phase_is_refused(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start_hub()
    assert meshed_nodes["hub"].post("/api/replay/jump", json={"phase": "nope"}).status_code == 422


def test_pause_and_resume_refuse_the_wrong_state(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start_hub()
    assert meshed_nodes["hub"].post("/api/replay/pause").status_code == 409
    assert meshed_nodes["hub"].post("/api/replay/resume").status_code == 409


def test_reset_returns_every_node_to_calm(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start_hub()
    meshed_nodes.start_sensor("s0", replay_track="S0")
    _start_replay(meshed_nodes)
    meshed_nodes.advance(15)
    _wait_until(lambda: _water_cm(meshed_nodes, "s0", "s0") == 420.0)
    assert meshed_nodes["hub"].post("/api/replay/reset").status_code == 200
    for name in ("hub", "s0"):
        clock = _event_clock(meshed_nodes, name)
        assert (clock["state"], clock["event_t"]) == ("paused", REPLAY_START)
    _wait_until(lambda: _water_cm(meshed_nodes, "hub", "s0") < 100)


def test_the_phases_and_the_internet_cue_are_listed_in_event_time(
    meshed_nodes: MeshedNodes,
) -> None:
    meshed_nodes.start_hub()
    listed = meshed_nodes["hub"].get("/api/replay/phases").json()
    assert [phase["id"] for phase in listed["phases"]] == [
        "calm",
        "collapse",
        "border",
        "syabrubesi",
        "dhm-notice",
        "dhm-sms",
        "betrawati",
        "end",
    ]
    assert listed["phases"][0]["event_t"] == REPLAY_START
    assert listed["internet_cue_event_t"] == REPLAY_START + 50 * 60


def test_a_sensor_cannot_control_the_replay(meshed_nodes: MeshedNodes) -> None:
    meshed_nodes.start_sensor("s0", replay_track="S0")
    for action in ("pause", "resume", "reset"):
        assert meshed_nodes["s0"].post(f"/api/replay/{action}").status_code == 404
