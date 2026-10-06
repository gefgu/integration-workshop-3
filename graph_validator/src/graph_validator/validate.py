"""Hard board errors on camera/detected parts (bounds, kit limits, socket collisions)."""
from __future__ import annotations

from collections import Counter

from .catalog import AMMETER_SLOT, CAPSULES, CATALOG, COLS, MAX_CAPSULES, ROWS, slot_of
from .graph import Part


def parts_problems(parts: list[Part]) -> list[str]:
    out: list[str] = []
    sockets: dict[tuple[int, int], str] = {}
    for p in parts:
        for t in p.terms:
            if not (1 <= t.col <= COLS and 0 <= t.row < ROWS):
                out.append(f"{p.id}: terminal outside the board ({t.col},{t.row})")
            owner = sockets.setdefault((t.col, t.row), p.id)
            if owner != p.id:
                out.append(f"{p.id} and {owner} share socket ({t.col},{t.row})")
        if p.ctype in CAPSULES:
            slot = slot_of(p.terms[0].col, p.terms[0].row)
            if slot is None:
                out.append(f"{p.id}: {p.ctype} must sit in a capsule slot")
            elif p.ctype == "capsula_amperimetro" and slot != AMMETER_SLOT:
                out.append(f"{p.id}: the ammeter only works in slot {AMMETER_SLOT}")
        if abs(p.terms[0].col - p.terms[-1].col) != CATALOG[p.ctype].length:
            out.append(f"{p.id}: {p.ctype} must span {CATALOG[p.ctype].length} column(s)")
    for t, n in Counter(p.ctype for p in parts).items():
        if n > CATALOG[t].kit_limit:
            out.append(f"kit has only {CATALOG[t].kit_limit} x {t} (found {n})")
    if sum(1 for p in parts if p.ctype in CAPSULES) > MAX_CAPSULES:
        out.append(f"at most {MAX_CAPSULES} smart capsules can be active at once")
    return out
