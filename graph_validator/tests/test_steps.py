import pytest

from graph_validator.graph import parts_from_pieces
from graph_validator.models import Category, InvalidBoard, Lesson
from graph_validator.steps import evaluate_step, lint, resolve_targets

from helpers import P, loop


def lesson(kind="guided", **kw):
    d = {
        "id": "l2", "kind": kind,
        "steps": [
            {"id": "s1", "action": "place_component", "add": [P("bat", "bateria", 1, 2, 0).model_dump()]},
            {"id": "s2", "action": "place_component", "add": [P("led", "led", 3, 4, 2).model_dump()]},
            {"id": "s3", "action": "place_connection", "add": [P("j", "jumper_curto", 2, 3, 3).model_dump()]},
            {"id": "s4", "action": "place_connection", "add": [P("j2", "jumper_longo", 4, 2, 4).model_dump()]},
            {"id": "s5", "action": "interact", "interact": {"quiz_correct_id": "o1"}},
        ],
    }
    d.update(kw)
    return Lesson.model_validate(d)


def parts(*ids_upto):
    pcs = [P("bat", "bateria", 1, 2, 0), P("led", "led", 3, 4, 2), P("j", "jumper_curto", 2, 3, 3), P("j2", "jumper_longo", 4, 2, 4)]
    return parts_from_pieces(pcs[: ids_upto[0]])


def test_cumulative_targets_and_lint_ok():
    l = lesson()
    assert [len(t) for t in resolve_targets(l)] == [1, 2, 3, 4, 4]
    assert lint(l) == []


def test_lint_rejects_two_actions_in_one_step():  # SFR4
    l = lesson()
    l.steps[1].add.append(P("r", "resistor_470", 5, 6, 1))
    assert any("exactly one action" in p for p in lint(l))


def test_lint_checks_action_label():
    l = lesson()
    l.steps[2].action = "place_component"
    assert any("place_connection" in p for p in lint(l))


def test_lint_time_limit_only_for_challenge():
    assert lint(lesson(time_limit_s=60))
    assert lint(lesson(kind="challenge", time_limit_s=60)) == []


def test_guided_step_uses_that_steps_target():
    l = lesson()
    r = evaluate_step(l, 1, parts(2))
    assert r.approved and r.category == Category.COMPLETE
    r = evaluate_step(l, 2, parts(2))
    assert not r.approved and r.category == Category.MISSING_CONNECTION


def test_challenge_only_checks_final_target():
    l = lesson(kind="challenge")
    assert not evaluate_step(l, 0, parts(1)).approved
    assert evaluate_step(l, 0, parts(4)).approved


def test_hint_only_after_graph_change():  # SFR7
    l = lesson()
    first = evaluate_step(l, 2, parts(2))
    assert first.hint
    same = evaluate_step(l, 2, parts(2), previous_hash=first.graph_hash)
    assert same.hint is None and same.message
    changed = evaluate_step(l, 2, parts(1), previous_hash=first.graph_hash)
    assert changed.hint


def test_interact_step_needs_right_answer():  # SFR19
    l = lesson()
    p = parts(4)
    assert evaluate_step(l, 4, p).awaiting_answer
    assert not evaluate_step(l, 4, p, answer="nope").approved
    assert evaluate_step(l, 4, p, answer="o1").approved


def test_invalid_board_is_an_error_not_feedback():
    l = lesson()
    bad = parts_from_pieces([P("a", "led", 1, 2, 0), P("b", "led", 2, 3, 0), P("c", "led", 5, 6, 0)])
    with pytest.raises(InvalidBoard):
        evaluate_step(l, 0, bad)
