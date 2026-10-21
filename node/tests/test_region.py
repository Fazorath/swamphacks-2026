import json
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from meshed_nodes import MeshedNodes

from storm_shield import region as region_module
from storm_shield.main import create_app
from storm_shield.mesh import InMemoryNetwork
from storm_shield.region import RegionError, load_region, region_path
from storm_shield.replay import load_event
from storm_shield.settings import Settings

NEPAL = region_path("nepal")


def _write_region(folder: Path, name: str = "fixture", **changes: Any) -> Path:
    """A Region file under `folder` made from Nepal's with `changes` merged in; its path."""
    region = json.loads(NEPAL.read_text()) | {"name": name} | changes
    (folder / name).mkdir(parents=True)
    path = folder / name / "region.json"
    path.write_text(json.dumps(region))
    return path


def _flash_flood(**changes: Any) -> dict[str, Any]:
    """Nepal's flood-warning rules with `changes` applied to the flash-flood block."""
    rules = json.loads(NEPAL.read_text())["rules"]["flood_warning"]
    rules["flash_flood"] |= changes
    return {"rules": {"flood_warning": rules}}


def _surged(client: TestClient) -> list[str]:
    surged: list[str] = client.get("/api/state").json()["flood_risk"]["surged"]
    return surged


def test_nepals_region_holds_what_the_app_used_to_hard_wire() -> None:
    region = load_region(NEPAL)
    rules = region.rules.flood_warning
    assert region.hazard == "flash_flood"
    assert region.time_zone == "Asia/Kathmandu"
    assert (rules.flash_flood.surge_rise.cm, rules.flash_flood.surge_window_s) == (300, 60)
    assert (rules.flash_flood.elevated_level.cm, rules.flash_flood.high_level.cm) == (300, 600)
    assert (rules.rain_elevated.mm_per_hour, rules.rain_high.mm_per_hour) == (10, 25)
    assert rules.storm_pressure.hpa == 1000
    assert [site.id for site in region.sensor_sites] == ["s3", "s2", "s1", "s0"]
    assert len(region.shelters) == 5


def test_thresholds_are_converted_from_the_units_they_are_written_in(tmp_path: Path) -> None:
    path = _write_region(tmp_path, **_flash_flood(surge_rise={"value": 10, "unit": "ft"}))
    assert load_region(path).rules.flood_warning.flash_flood.surge_rise.cm == pytest.approx(304.8)


@pytest.mark.parametrize(
    ("changes", "field"),
    [
        ({"time_zone": "Mars/Olympus"}, "time_zone"),
        ({"bbox": [28.0, 85.0, 27.0, 86.0]}, "bbox"),
        ({"surprise": 1}, "surprise"),
        (_flash_flood(surge_rise={"value": 3, "unit": "furlongs"}), "surge_rise.unit"),
        (_flash_flood(surge_window_s=0), "surge_window_s"),
        (_flash_flood(surge_window_s=300), "flash_flood"),
        ({"official_alert_sources": []}, "official_alert_sources"),
    ],
)
def test_a_bad_region_file_names_the_bad_field(
    tmp_path: Path, changes: dict[str, Any], field: str
) -> None:
    path = _write_region(tmp_path, **changes)
    with pytest.raises(RegionError) as error:
        load_region(path)
    assert field in str(error.value)


def test_a_sensor_site_outside_the_box_is_named(tmp_path: Path) -> None:
    sites = json.loads(NEPAL.read_text())["sensor_sites"]
    sites[1]["pos"] = [0.0, 0.0]
    path = _write_region(tmp_path, sensor_sites=sites)
    with pytest.raises(RegionError, match=r"sensor_sites\[1\]"):
        load_region(path)


def test_a_node_will_not_start_on_a_bad_region_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _write_region(tmp_path, time_zone="Mars/Olympus")
    monkeypatch.setattr(region_module, "REGIONS_DIR", tmp_path)
    settings = Settings(name="porch", region="fixture", dashboard_dir=tmp_path / "none")
    mesh = InMemoryNetwork().join("porch", "hub")
    with pytest.raises(RegionError, match="time_zone"):
        create_app(settings, mesh)


def test_an_event_alert_from_a_source_the_region_does_not_list_stops_the_node(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    sources = [{"tag": "dhm", "name": "DHM", "covers": "Nepal"}]
    _write_region(tmp_path, official_alert_sources=sources)
    monkeypatch.setattr(region_module, "REGIONS_DIR", tmp_path)
    assert load_event().official_alerts[-1].issuer == "district"
    settings = Settings(name="porch", region="fixture", dashboard_dir=tmp_path / "none")
    mesh = InMemoryNetwork().join("porch", "hub")
    with pytest.raises(RegionError, match="district"):
        create_app(settings, mesh)


def test_the_regions_surge_rise_decides_when_the_warning_fires(
    meshed_nodes: MeshedNodes, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # A 200 cm rise: calm for Nepal's 300 cm, a Surge for a Region that asks for 150 cm.
    meshed_nodes.start("nepal-like")
    _write_region(tmp_path, **_flash_flood(surge_rise={"value": 1.5, "unit": "m"}))
    monkeypatch.setattr(region_module, "REGIONS_DIR", tmp_path)
    meshed_nodes.start("fixture-like", region="fixture")
    for name in ("nepal-like", "fixture-like"):
        meshed_nodes.register("creek", name)
        meshed_nodes.hear_from("creek", water_cm=20)
        meshed_nodes.advance(8)
        meshed_nodes.hear_from("creek", water_cm=220)
    assert _surged(meshed_nodes["nepal-like"]) == []
    assert _surged(meshed_nodes["fixture-like"]) == ["creek"]
