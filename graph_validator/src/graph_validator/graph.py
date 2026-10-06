"""SFR1: build the terminal graph from placed parts."""
from __future__ import annotations

from dataclasses import dataclass
from itertools import combinations

import networkx as nx

from .catalog import CAPSULES, CATALOG, ORDERED, bank, config_key, piece_value
from .models import DetectedBoard, DetectedComponent, Piece


@dataclass(frozen=True)
class Term:
    name: str
    col: int
    row: int


@dataclass(frozen=True)
class Part:
    id: str
    ctype: str
    terms: tuple[Term, ...]
    value: int | None = None
    config: tuple = ()  # canonical capsule config (see catalog.config_key)

    @property
    def family(self) -> str:
        return CATALOG[self.ctype].family


def part_from_piece(p: Piece) -> Part:
    cols = (p.a, p.b, p.c) if p.type in CAPSULES else (p.a, p.b)
    terms = tuple(Term(n, col, p.row) for n, col in zip(CATALOG[p.type].terminals, cols))
    return Part(p.id, p.type, terms, piece_value(p.type, p.value), config_key(p.type, p.config))


_ALIASES = {"+": "+", "plus": "+", "-": "-", "−": "-", "minus": "-"}


def part_from_detected(c: DetectedComponent, index: int) -> Part:
    """Camera terminals -> Part. Directed types need named terminals; others are orderless pins."""
    ctype = c.type
    names = CATALOG[ctype].terminals
    terms = []
    if ctype in ORDERED:
        by = {_ALIASES.get(k, k): v for k, v in c.terminals.items()}
        for n in names:
            if n not in by:
                raise ValueError(f"{c.id or index}: {ctype} needs terminal '{n}'")
            terms.append(Term(n, by[n].col, by[n].row))
    else:
        raw = sorted(c.terminals.values(), key=lambda t: (t.col, t.row))
        if len(raw) != 2:
            raise ValueError(f"{c.id or index}: {ctype} needs exactly 2 terminals")
        terms = [Term("pin", t.col, t.row) for t in raw]
    return Part(c.id or f"c{index}", ctype, tuple(terms), piece_value(ctype, None), config_key(ctype, c.config))


def parts_from_detected(board: DetectedBoard) -> list[Part]:
    return [part_from_detected(c, i) for i, c in enumerate(board.components)]


def parts_from_pieces(pieces: list[Piece]) -> list[Part]:
    return [part_from_piece(p) for p in pieces]


def build_graph(parts: list[Part]) -> nx.Graph:
    """One node per terminal; edges inside a component and between terminals sharing a column.

    A column is one net within its bank; the two banks are separate nodes. Each node also
    carries `rel_col`/`rel_row` (position relative to the board's bounding-box origin) so
    strict position matching is translation invariant (SFR8).
    """
    g = nx.Graph()
    all_terms = [t for p in parts for t in p.terms]
    min_col = min((t.col for t in all_terms), default=0)
    min_row = min((t.row for t in all_terms), default=0)
    by_col: dict[tuple[int, int], list[str]] = {}
    for p in parts:
        ids = []
        for i, t in enumerate(p.terms):
            nid = f"{p.id}.{i}:{t.name}"  # index keeps the two orderless "pin" legs distinct
            g.add_node(
                nid, part=p.id, ctype=p.family, terminal=t.name, value=p.value, config=p.config,
                col=t.col, row=t.row, rel_col=t.col - min_col, rel_row=t.row - min_row,
            )
            by_col.setdefault((bank(t.row), t.col), []).append(nid)
            ids.append(nid)
        for a, b in combinations(ids, 2):
            g.add_edge(a, b, kind="component")
    for nodes in by_col.values():
        for a, b in combinations(nodes, 2):
            if not g.has_edge(a, b):
                g.add_edge(a, b, kind="column")
    return g
