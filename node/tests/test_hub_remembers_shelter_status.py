import time
from collections.abc import Callable
from pathlib import Path

from fixture_pack import SHELTERS, build_fixture_pack
from meshed_nodes import MeshedNodes

GYM = str(SHELTERS[0]["id"])
LIBRARY = "test-library"
TWO_SHELTERS = [*SHELTERS, {**SHELTERS[0], "id": LIBRARY, "name": "Test Library"}]
REPEAT_SECONDS = 0.02


def _open(meshed_nodes: MeshedNodes, name: str) -> list[str]:
    return list(meshed_nodes[name].get("/api/shelters").json()["open"])


def _set(meshed_nodes: MeshedNodes, shelter_id: str, is_open: bool) -> None:
    meshed_nodes["hub"].post("/api/shelters/open", json={"id": shelter_id, "open": is_open})


def _wait_until(condition: Callable[[], bool]) -> None:
    deadline = time.monotonic() + 5
    while not condition():
        assert time.monotonic() < deadline, "condition never became true"
        time.sleep(0.01)


def _start_hub(
    meshed_nodes: MeshedNodes, tmp_path: Path, shelters: list[dict[str, object]]
) -> None:
    meshed_nodes.start_hub(
        (tmp_path, build_fixture_pack(shelters=shelters)), shelter_repeat_seconds=REPEAT_SECONDS
    )


def test_a_restarted_hub_keeps_a_closed_shelter_closed_on_every_node(
    meshed_nodes: MeshedNodes, tmp_path: Path
) -> None:
    pack = build_fixture_pack(shelters=TWO_SHELTERS)
    meshed_nodes.start("porch", "garage", cache_pack=(tmp_path, pack))
    _start_hub(meshed_nodes, tmp_path, TWO_SHELTERS)
    _set(meshed_nodes, GYM, False)

    meshed_nodes.stop_hub()
    _start_hub(meshed_nodes, tmp_path, TWO_SHELTERS)

    assert _open(meshed_nodes, "hub") == [LIBRARY]
    for name in ("porch", "garage"):
        assert _open(meshed_nodes, name) == [LIBRARY]


def test_a_shelter_missing_from_the_pack_after_a_restart_is_dropped(
    meshed_nodes: MeshedNodes, tmp_path: Path
) -> None:
    meshed_nodes.start("porch", cache_pack=(tmp_path, build_fixture_pack(shelters=TWO_SHELTERS)))
    _start_hub(meshed_nodes, tmp_path, TWO_SHELTERS)

    meshed_nodes.stop_hub()
    _start_hub(meshed_nodes, tmp_path, SHELTERS)

    assert _open(meshed_nodes, "hub") == [GYM]
    # Only a `ver` higher than the pre-restart one replaces what the Node holds.
    _wait_until(lambda: _open(meshed_nodes, "porch") == [GYM])


def test_a_restart_does_not_reseed_a_shelter_that_stayed_open(
    meshed_nodes: MeshedNodes, tmp_path: Path
) -> None:
    _start_hub(meshed_nodes, tmp_path, TWO_SHELTERS)
    _set(meshed_nodes, LIBRARY, False)
    _set(meshed_nodes, LIBRARY, True)

    meshed_nodes.stop_hub()
    _start_hub(meshed_nodes, tmp_path, TWO_SHELTERS)

    assert _open(meshed_nodes, "hub") == [GYM, LIBRARY]
