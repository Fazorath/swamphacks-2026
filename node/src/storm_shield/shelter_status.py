from typing import Literal

from pydantic import BaseModel


class ShelterStatus(BaseModel):
    """The Hub's full list of open Shelters, in the mesh format of docs/specs/wire-formats.md."""

    v: Literal[1] = 1
    kind: Literal["shelters"] = "shelters"
    ver: int
    t: int
    open: list[str]
