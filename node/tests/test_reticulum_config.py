import pytest

from storm_shield.reticulum_mesh import reticulum_config
from storm_shield.settings import Settings


def test_auto_uses_the_wifi_discovery_interface_only() -> None:
    config = reticulum_config(Settings(mesh_interface="auto"))
    assert "AutoInterface" in config
    assert "TCP" not in config


def test_tcp_listens_and_dials_every_listed_peer_with_a_default_port() -> None:
    config = reticulum_config(
        Settings(mesh_interface="tcp", tcp_port=4242, tcp_peers="100.64.0.2, 100.64.0.3:5000,")
    )
    assert "listen_port = 4242" in config
    assert "target_host = 100.64.0.2\n    target_port = 4242" in config
    assert "target_host = 100.64.0.3\n    target_port = 5000" in config
    assert config.count("TCPClientInterface") == 2


def test_loopback_slot_dials_only_lower_slots() -> None:
    config = reticulum_config(Settings(mesh_interface="loopback", loopback_slot=2))
    assert "listen_port = 4252" in config
    assert "target_port = 4250" in config
    assert "target_port = 4251" in config
    assert config.count("TCPClientInterface") == 2


def test_a_loopback_group_never_dials_below_its_first_slot() -> None:
    config = reticulum_config(
        Settings(mesh_interface="loopback", loopback_slot=22, loopback_first_slot=20)
    )
    assert "listen_port = 4272" in config
    assert "target_port = 4270" in config
    assert "target_port = 4271" in config
    assert config.count("TCPClientInterface") == 2


@pytest.mark.parametrize("first_slot", [-1, 3])
def test_a_first_slot_outside_the_group_names_the_setting(first_slot: int) -> None:
    with pytest.raises(ValueError, match="NODE_LOOPBACK_FIRST_SLOT"):
        reticulum_config(
            Settings(mesh_interface="loopback", loopback_slot=2, loopback_first_slot=first_slot)
        )


def test_a_malformed_tcp_peer_names_the_setting() -> None:
    with pytest.raises(ValueError, match="NODE_TCP_PEERS"):
        reticulum_config(Settings(mesh_interface="tcp", tcp_peers="100.64.0.2:abc"))


def test_reticulum_over_wifi_discovery_is_the_default() -> None:
    settings = Settings()
    assert (settings.mesh, settings.mesh_interface) == ("reticulum", "auto")


def test_the_hub_can_add_wifi_discovery_and_a_tcp_listener_beside_loopback() -> None:
    config = reticulum_config(
        Settings(
            mesh_interface="loopback",
            also_wifi_discovery=True,
            also_tcp_listen=True,
            tcp_port=4242,
        )
    )
    assert "listen_ip = 127.0.0.1\n    listen_port = 4250" in config
    assert "AutoInterface" in config
    assert "listen_ip = 0.0.0.0\n    listen_port = 4242" in config


def test_the_extra_interfaces_are_off_unless_asked_for() -> None:
    config = reticulum_config(Settings(mesh_interface="loopback"))
    assert "AutoInterface" not in config
    assert "0.0.0.0" not in config


def test_a_primary_interface_is_never_added_twice() -> None:
    wifi = reticulum_config(Settings(mesh_interface="auto", also_wifi_discovery=True))
    assert wifi.count("AutoInterface") == 1
    tcp = reticulum_config(Settings(mesh_interface="tcp", also_tcp_listen=True))
    assert tcp.count("TCPServerInterface") == 1
