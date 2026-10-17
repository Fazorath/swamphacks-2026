from collections.abc import Iterator

import pytest
from meshed_nodes import MeshedNodes


@pytest.fixture
def meshed_nodes() -> Iterator[MeshedNodes]:
    nodes = MeshedNodes()
    yield nodes
    nodes.close()
