"""SFR2/3/4/7/19/23: lesson steps, targets, lint and step evaluation."""
from __future__ import annotations

from collections import Counter

from pydantic import BaseModel

from .catalog import DIRECTED
from .diff import diff_parts
from .feedback import feedback
from .graph import Part, build_graph, parts_from_pieces
from .match import graph_hash, is_match
from .models import Category, InvalidBoard, Lesson, MatchOptions, Piece, board_problems
from .validate import parts_problems


def _token(p: Piece) -> tuple:
    cols = (p.a, p.b) if p.type in DIRECTED else tuple(sorted((p.a, p.b)))
    return (p.type, cols)


def resolve_targets(lesson: Lesson) -> list[list[Piece]]:
    """Cumulative target per step: previous target + `add`, or the explicit `pieces` boundary (SFR23)."""
    targets: list[list[Piece]] = []
    prev: list[Piece] = []
    for s in lesson.steps:
        cur = list(s.pieces) if s.pieces is not None else prev + list(s.add)
        targets.append(cur)
        prev = cur
    return targets


def lint(lesson: Lesson) -> list[str]:
    """Schema-level problems with a lesson. Empty list = valid."""
    out: list[str] = []
    if not lesson.steps:
        return ["lesson has no steps"]
    if lesson.time_limit_s is not None and lesson.kind != "challenge":
        out.append("time_limit_s only applies to challenge lessons (SFR24)")
    ids = [s.id for s in lesson.steps]
    if len(set(ids)) != len(ids):
        out.append("duplicate step ids")
    prev: list[Piece] = []
    for n, (s, cur) in enumerate(zip(lesson.steps, resolve_targets(lesson)), 1):
        for prob in board_problems(cur):
            out.append(f"step {n} ({s.id}): {prob}")
        before, after = Counter(map(_token, prev)), Counter(map(_token, cur))
        added, removed = after - before, before - after
        prev = cur
        if lesson.kind == "challenge":
            continue  # SFR4 governs the guided tutorial; a challenge has just its final target (SFR3)
        if removed or sum(added.values()) > 1:
            out.append(f"step {n} ({s.id}): a step must teach exactly one action (SFR4); "
                       f"it adds {sum(added.values())} and removes {sum(removed.values())} pieces")
        else:
            if added:
                (ctype, _), = added.keys()
                want = "place_connection" if ctype.startswith("jumper") else "place_component"
            else:
                want = "interact"
            if s.action != want:
                out.append(f"step {n} ({s.id}): action should be '{want}', not '{s.action}'")
        if s.action == "interact" and s.interact is None:
            out.append(f"step {n} ({s.id}): interact step needs an `interact` spec (SFR19)")
    return out


class IssueOut(BaseModel):
    category: Category
    family: str
    part_id: str | None = None


class StepResult(BaseModel):
    approved: bool
    category: Category | None = None
    message: str
    hint: str | None = None  # only when the graph changed since `previous_hash` (SFR7)
    awaiting_answer: bool = False
    graph_hash: str
    issues: list[IssueOut] = []


def evaluate_step(
    lesson: Lesson,
    step_idx: int,
    parts: list[Part],
    previous_hash: str | None = None,
    answer: str | None = None,
) -> StepResult:
    problems = parts_problems(parts)
    if problems:
        raise InvalidBoard(problems)
    step = lesson.steps[step_idx]
    targets = resolve_targets(lesson)
    # Guided lessons check each step's target (SFR2); challenges only the final one (SFR3).
    target_pieces = targets[-1] if lesson.kind == "challenge" else targets[step_idx]
    opts: MatchOptions = step.options
    target_parts = parts_from_pieces(target_pieces)
    sg, tg = build_graph(parts), build_graph(target_parts)
    gh = graph_hash(sg, opts)

    if not is_match(sg, tg, opts):
        issues = diff_parts(parts, target_parts, opts)
        cat, msg = feedback(issues, step.overrides)
        return StepResult(
            approved=False, category=cat, message=msg,
            hint=msg if gh != previous_hash else None, graph_hash=gh,
            issues=[IssueOut(category=i.category, family=i.family, part_id=i.part_id) for i in issues],
        )

    if step.action == "interact" and lesson.kind == "guided":
        # SFR19: the graph is unchanged by this step, so completion comes from the student's answer.
        if answer is None:
            return StepResult(approved=False, message="Agora responda à pergunta.", awaiting_answer=True, graph_hash=gh)
        if answer != step.interact.quiz_correct_id:
            return StepResult(approved=False, message="Quase! Observe de novo e tente outra vez.", awaiting_answer=True, graph_hash=gh)
    cat, msg = feedback([], step.overrides)
    return StepResult(approved=True, category=cat, message=msg, graph_hash=gh)
