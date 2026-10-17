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
