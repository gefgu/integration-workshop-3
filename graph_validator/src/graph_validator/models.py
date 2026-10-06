"""Pydantic models: the JSON contract shared by the library, CLI and HTTP service."""
from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from .catalog import CATALOG, COLS, ROWS, TYPES, normalize_type


class Piece(BaseModel):
    """A placed component as the teacher app stores it: two column legs `a`/`b` plus a row."""

    id: str
    type: str
    a: int
    b: int
    row: int
    value: int | None = None

    @field_validator("type", mode="before")
    @classmethod
    def _legacy(cls, v: str) -> str:
        return normalize_type(v)

    @field_validator("type")
    @classmethod
    def _known(cls, v: str) -> str:
        if v not in TYPES:
            raise ValueError(f"unknown component type: {v}")
        return v


class Terminal(BaseModel):
    col: int
    row: int


class DetectedComponent(BaseModel):
    """Camera output: component type plus the (col,row) of each terminal (SFR1)."""

    id: str | None = None
    type: str
    terminals: dict[str, Terminal]

    @field_validator("type", mode="before")
    @classmethod
    def _legacy(cls, v: str) -> str:
        return normalize_type(v)


class DetectedBoard(BaseModel):
    components: list[DetectedComponent]


class MatchOptions(BaseModel):
    match_values: bool = False
    strict_positions: bool = False


class Category(str, Enum):
    COMPLETE = "complete"
    MISSING_COMPONENT = "missing_component"
    MISSING_CONNECTION = "missing_connection"
    EXCESS_CONNECTION = "excess_connection"
    EXCESS_COMPONENT = "excess_component"
    INCORRECT_CONNECTION = "incorrect_connection"
    REVERSED_POLARITY = "reversed_polarity"
    WRONG_VALUE = "wrong_value"
    WRONG_COMPONENT = "wrong_component"
    MISCONNECTED_COMPONENT = "misconnected_component"
    OPEN_CIRCUIT = "open_circuit"
    SHORT_CIRCUIT = "short_circuit"


Action = Literal["place_component", "place_connection", "connect_circuit", "interact"]


class InteractSpec(BaseModel):
    quiz_correct_id: str


class Step(BaseModel):
    id: str
    action: Action
    add: list[Piece] = Field(default_factory=list)  # appended to the previous step's target
    pieces: list[Piece] | None = None  # explicit boundary state (SFR23); overrides `add`
    options: MatchOptions = Field(default_factory=MatchOptions)
    interact: InteractSpec | None = None
    # {category: {component family or "*": text}} (SFR15.1)
    overrides: dict[str, dict[str, str]] = Field(default_factory=dict)


class Lesson(BaseModel):
    id: str
    version: int = 1
    kind: Literal["guided", "challenge"] = "guided"
    time_limit_s: int | None = None  # SFR24, challenge only
    steps: list[Step]


def board_problems(pieces: list[Piece]) -> list[str]:
    """Hard errors that make a board invalid (not feedback): bounds, kit limits, socket collisions."""
    out: list[str] = []
    used: dict[str, int] = {}
    seen_ids: set[str] = set()
    spans: dict[int, list[tuple[int, int, str]]] = {}
    for p in pieces:
        if p.id in seen_ids:
            out.append(f"duplicate piece id {p.id}")
        seen_ids.add(p.id)
        if not (1 <= p.a <= COLS and 1 <= p.b <= COLS):
            out.append(f"{p.id}: column out of 1..{COLS}")
        if not (0 <= p.row < ROWS):
            out.append(f"{p.id}: row out of 0..{ROWS - 1}")
        if abs(p.a - p.b) != CATALOG[p.type].length:
            out.append(f"{p.id}: {p.type} must span {CATALOG[p.type].length} column(s)")
        used[p.type] = used.get(p.type, 0) + 1
        lo, hi = min(p.a, p.b), max(p.a, p.b)
        for olo, ohi, oid in spans.get(p.row, []):
            if lo <= ohi and olo <= hi:
                out.append(f"{p.id} overlaps {oid} on row {p.row}")
        spans.setdefault(p.row, []).append((lo, hi, p.id))
    for t, n in used.items():
        if n > CATALOG[t].kit_limit:
            out.append(f"kit has only {CATALOG[t].kit_limit} x {t} (found {n})")
    return out


class InvalidBoard(ValueError):
    def __init__(self, problems: list[str]):
        super().__init__("; ".join(problems))
        self.problems = problems
