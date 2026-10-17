from collections.abc import Iterator
from pathlib import Path

import pytest
from meshed_nodes import MeshedNodes


@pytest.fixture
def meshed_nodes(tmp_path: Path) -> Iterator[MeshedNodes]:
    nodes = MeshedNodes(tmp_path / "nodes")
    yield nodes
    nodes.close()
