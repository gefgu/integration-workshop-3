"""SFR2/3/4/7/19/23: lesson steps, targets, lint and step evaluation."""
from __future__ import annotations

from collections import Counter

from pydantic import BaseModel

from .catalog import DIRECTED
from .diff import diff_inventory, diff_parts
from .equiv import circuit_hash, diff_nets, equivalent, net_partners
from .feedback import feedback, misconnected_message
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
    nums = {s.id: n for n, s in enumerate(lesson.steps, 1)}
    return [m if sid is None else f"step {nums[sid]} ({sid}): {m}" for sid, m in lint_issues(lesson)]


def lint_issues(lesson: Lesson) -> list[tuple[str | None, str]]:
    """Same checks as `lint`, as (step_id | None, message) so a UI can pin errors to a step."""
    out: list[tuple[str | None, str]] = []
    if not lesson.steps:
        return [(None, "lesson has no steps")]
    if lesson.time_limit_s is not None and lesson.kind != "challenge":
        out.append((None, "time_limit_s only applies to challenge lessons (SFR24)"))
    ids = [s.id for s in lesson.steps]
    if len(set(ids)) != len(ids):
        out.append((None, "duplicate step ids"))
    prev: list[Piece] = []
    circuit_steps = [i for i, s in enumerate(lesson.steps) if s.action == "connect_circuit"]
    if lesson.kind == "guided" and lesson.steps and resolve_targets(lesson)[-1] and len(circuit_steps) != 1:
        out.append((None, "guided lesson with pieces needs exactly one connect_circuit step"))
    if circuit_steps:
        ci = circuit_steps[0]
        if any(s.action in ("place_component", "place_connection") for s in lesson.steps[ci + 1:]):
            out.append((lesson.steps[ci].id, "connect_circuit must follow all placement steps"))
    for s, cur in zip(lesson.steps, resolve_targets(lesson)):
        for prob in board_problems(cur):
            out.append((s.id, prob))
        before, after = Counter(map(_token, prev)), Counter(map(_token, cur))
        added, removed = after - before, before - after
        prev = cur
        if lesson.kind == "challenge":
            continue  # SFR4 governs the guided tutorial; a challenge has just its final target (SFR3)
        if s.action == "connect_circuit":
            if added or removed:
                out.append((s.id, "connect_circuit must not add or remove pieces"))
            if lesson.kind == "guided" and not cur:
                out.append((s.id, "connect_circuit needs a target circuit"))
        elif removed or sum(added.values()) > 1:
            out.append((s.id, f"a step must teach exactly one action (SFR4); "
                              f"it adds {sum(added.values())} and removes {sum(removed.values())} pieces"))
        elif s.action != "connect_circuit":
            if added:
                (ctype, _), = added.keys()
                want = "place_connection" if ctype.startswith("jumper") else "place_component"
            else:
                want = "interact"
            if s.action != want:
                out.append((s.id, f"action should be '{want}', not '{s.action}'"))
        if s.action == "interact" and s.interact is None:
            out.append((s.id, "interact step needs an `interact` spec (SFR19)"))
    return out


class IssueOut(BaseModel):
    category: Category
    family: str
    part_id: str | None = None
    expected_part_id: str | None = None
    actual_part_id: str | None = None


class StepDebug(BaseModel):
    step_id: str
    action: str
    expected_pieces: list[Piece]
    actual_pieces: list[Piece]
    match_values: bool
    strict_positions: bool
    expected_nets: list[str] = []
    actual_nets: list[str] = []
    expected_circuit: str | None = None  # canonical series/parallel form (None: not reducible)
    actual_circuit: str | None = None


class StepResult(BaseModel):
    approved: bool
    category: Category | None = None
    message: str
    hint: str | None = None  # only when the graph changed since `previous_hash` (SFR7)
    awaiting_answer: bool = False
    graph_hash: str
    issues: list[IssueOut] = []
    debug: StepDebug | None = None


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
    if lesson.kind == "guided" and step.action in ("place_component", "place_connection"):
        issues = diff_inventory(parts, target_parts, opts)
        if issues:
            cat, msg = feedback(issues, step.overrides)
            return StepResult(
                approved=False, category=cat, message=msg,
                issues=[IssueOut(category=i.category, family=i.family, part_id=i.part_id,
                                 expected_part_id=i.expected_part_id, actual_part_id=i.actual_part_id)
                        for i in issues],
                graph_hash=graph_hash(build_graph(parts), opts),
            )
        cat, msg = feedback([], step.overrides)
        return StepResult(approved=True, category=cat, message=msg, graph_hash=graph_hash(build_graph(parts), opts))
    if lesson.kind == "guided" and step.action == "interact":
        gh = graph_hash(build_graph(parts), opts)
        if answer is None:
            return StepResult(approved=False, message="Agora responda à pergunta.", awaiting_answer=True, graph_hash=gh)
        if answer != step.interact.quiz_correct_id:
            return StepResult(approved=False, message="Quase! Observe de novo e tente outra vez.", awaiting_answer=True, graph_hash=gh)
        cat, msg = feedback([], step.overrides)
        return StepResult(approved=True, category=cat, message=msg, graph_hash=gh)
    if opts.strict_positions:
        sg, tg = build_graph(parts), build_graph(target_parts)
        gh, matched = graph_hash(sg, opts), is_match(sg, tg, opts)
    else:
        gh, matched = circuit_hash(parts, opts), equivalent(parts, target_parts, opts)

    if not matched:
        issues = (diff_parts if opts.strict_positions else diff_nets)(parts, target_parts, opts)
        cat, msg = feedback(issues, step.overrides)
        if cat == Category.MISCONNECTED_COMPONENT:
            issue = next(i for i in issues if i.category == cat)
            custom = step.overrides.get(cat.value, {})
            if issue.family not in custom and "*" not in custom:
                expected = next((p for p in target_pieces if p.id == issue.expected_part_id), None)
                if expected:
                    by_id = {p.id: p for p in target_pieces}
                    partner = next((by_id[q.id] for q in net_partners(target_parts, expected.id) if q.id in by_id), None)
                    msg = misconnected_message(expected, partner)
        return StepResult(
            approved=False, category=cat, message=msg,
            hint=msg if gh != previous_hash else None, graph_hash=gh,
            issues=[
                IssueOut(
                    category=i.category,
                    family=i.family,
                    part_id=i.part_id,
                    expected_part_id=i.expected_part_id,
                    actual_part_id=i.actual_part_id,
                )
                for i in issues
            ],
        )

    if step.action == "interact" and lesson.kind == "guided":
        # SFR19: the graph is unchanged by this step, so completion comes from the student's answer.
        if answer is None:
            return StepResult(approved=False, message="Agora responda à pergunta.", awaiting_answer=True, graph_hash=gh)
        if answer != step.interact.quiz_correct_id:
            return StepResult(approved=False, message="Quase! Observe de novo e tente outra vez.", awaiting_answer=True, graph_hash=gh)
    cat, msg = feedback([], step.overrides)
    return StepResult(approved=True, category=cat, message=msg, graph_hash=gh)
