"""Component-level diff between the bench and a target (input to SFR12 classification)."""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass

from .catalog import DIRECTED
from .graph import Part
from .models import Category, MatchOptions


@dataclass(frozen=True)
class Issue:
    category: Category
    family: str  # component family the issue is about (used for per-component overrides)
    part_id: str | None = None


def _token(p: Part, dx: int, values: bool) -> tuple:
    cols = tuple(t.col + dx for t in p.terms)
    cols = cols if p.ctype in DIRECTED else tuple(sorted(cols))
    return (p.family, cols, p.value if values else None)


def _tokens(parts: list[Part], dx: int, values: bool) -> list[tuple[tuple, Part]]:
    return [(_token(p, dx, values), p) for p in parts]


def _best_shift(student: list[Part], target: list[Part], values: bool) -> int:
    """The column offset that makes the student's pieces overlap the target's the most.

    Lessons are position independent (SFR8), so the student may have built the circuit
    a few columns away; aligning first keeps the diff readable.
    """
    want = Counter(t for t, _ in _tokens(target, 0, values))
    best, best_cost = 0, None
    for dx in sorted(range(-10, 11), key=abs):
        have = Counter(t for t, _ in _tokens(student, dx, values))
        cost = sum(((have - want) + (want - have)).values())
        if best_cost is None or cost < best_cost:
            best, best_cost = dx, cost
    return best


def diff_parts(student: list[Part], target: list[Part], opts: MatchOptions) -> list[Issue]:
    values = opts.match_values
    dx = _best_shift(student, target, values)
    have = _tokens(student, dx, values)
    want = _tokens(target, 0, values)

    extra = list(have)
    missing: list[tuple[tuple, Part]] = []
    for tok, part in want:
        for i, (etok, _) in enumerate(extra):
            if etok == tok:
                del extra[i]
                break
        else:
            missing.append((tok, part))

    issues: list[Issue] = []

    # 1) A directed piece placed backwards: its flip is exactly what is missing.
    for etok, ep in list(extra):
        if ep.ctype not in DIRECTED:
            continue
        flipped = (etok[0], tuple(reversed(etok[1])), etok[2])
        for mtok, mp in missing:
            if mtok == flipped:
                issues.append(Issue(Category.REVERSED_POLARITY, ep.family, ep.id))
                missing.remove((mtok, mp))
                extra.remove((etok, ep))
                break

    # 2) Right place, wrong piece: same columns, different type or value.
    for etok, ep in list(extra):
        for mtok, mp in missing:
            if mtok[1] == etok[1] and ep.family != "jumper" and mp.family != "jumper":
                cat = Category.WRONG_VALUE if mp.family == ep.family else Category.WRONG_COMPONENT
                issues.append(Issue(cat, mp.family, ep.id))
                missing.remove((mtok, mp))
                extra.remove((etok, ep))
                break

    # 3) A jumper is missing in one place and present in another: it is in the wrong place.
    miss_j = [m for m in missing if m[1].family == "jumper"]
    extra_j = [e for e in extra if e[1].family == "jumper"]
    for (mtok, mp), (etok, ep) in zip(miss_j, extra_j):
        issues.append(Issue(Category.INCORRECT_CONNECTION, "jumper", ep.id))
        missing.remove((mtok, mp))
        extra.remove((etok, ep))

    for _, mp in missing:
        cat = Category.MISSING_CONNECTION if mp.family == "jumper" else Category.MISSING_COMPONENT
        issues.append(Issue(cat, mp.family, mp.id))
    for _, ep in extra:
        issues.append(Issue(Category.EXCESS_CONNECTION, ep.family, ep.id))

    if not issues:
        # Same pieces, same columns, yet not isomorphic (e.g. strict positions differ).
        issues.append(Issue(Category.INCORRECT_CONNECTION, "*"))
    return issues
