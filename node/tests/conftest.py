import pytest
from meshed_nodes import MeshedNodes


@pytest.fixture
def meshed_nodes() -> MeshedNodes:
    return MeshedNodes()
