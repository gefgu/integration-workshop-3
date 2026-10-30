"""Pydantic models: the JSON contract shared by the library, CLI and HTTP service."""
from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from .catalog import (
    AMMETER_SLOT, CAPSULES, CATALOG, COLS, MAX_CAPSULES, ROWS, SLOT_COLS, SLOT_ROWS, TYPES, config_problems,
    normalize_type, slot_of,
)


class Piece(BaseModel):
    """A placed component as the teacher app stores it: two column legs `a`/`b` plus a row."""

    id: str
    type: str
    a: int
    b: int
    row: int
    value: int | None = None
    c: int | None = None  # third column (P3), smart capsules only
    config: dict[str, Any] | None = None  # smart capsule behaviour (mode, op, hz, duty...)

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
    config: dict[str, Any] | None = None

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
    WRONG_CONFIG = "wrong_config"
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
        cols = [p.a, p.b] + ([p.c] if p.type in CAPSULES and p.c is not None else [])
        if not all(1 <= x <= COLS for x in cols):
            out.append(f"{p.id}: column out of 1..{COLS}")
        if not (0 <= p.row < ROWS):
            out.append(f"{p.id}: row out of 0..{ROWS - 1}")
        if p.type in CAPSULES:
            if p.c is None or (p.b, p.c) != (p.a + 1, p.a + 2):
                out.append(f"{p.id}: {p.type} needs three consecutive columns a, a+1, a+2")
            slot = slot_of(p.a, p.row)
            if slot is None:
                out.append(f"{p.id}: {p.type} must sit in a capsule slot (columns {SLOT_COLS}, rows {SLOT_ROWS})")
            elif p.type == "capsula_amperimetro" and slot != AMMETER_SLOT:
                out.append(f"{p.id}: the ammeter only works in slot {AMMETER_SLOT}")
            out += [f"{p.id}: {m}" for m in config_problems(p.type, p.config)]
        else:
            if abs(p.a - p.b) != CATALOG[p.type].length:
                out.append(f"{p.id}: {p.type} must span {CATALOG[p.type].length} column(s)")
            if p.c is not None or p.config:
                out.append(f"{p.id}: {p.type} takes no third column or config")
        used[p.type] = used.get(p.type, 0) + 1
        lo, hi = min(cols), max(cols)
        for olo, ohi, oid in spans.get(p.row, []):
            if lo <= ohi and olo <= hi:
                out.append(f"{p.id} overlaps {oid} on row {p.row}")
        spans.setdefault(p.row, []).append((lo, hi, p.id))
    for t, n in used.items():
        if n > CATALOG[t].kit_limit:
            out.append(f"kit has only {CATALOG[t].kit_limit} x {t} (found {n})")
    if sum(n for t, n in used.items() if t in CAPSULES) > MAX_CAPSULES:
        out.append(f"at most {MAX_CAPSULES} smart capsules can be active at once")
    return out


class InvalidBoard(ValueError):
    def __init__(self, problems: list[str]):
        super().__init__("; ".join(problems))
        self.problems = problems
