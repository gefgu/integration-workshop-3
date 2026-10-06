import random

from graph_validator.equiv import (
    circuit_hash, describe_canonical, describe_nets, diff_nets, equivalent, net_partners,
)
from graph_validator.graph import parts_from_pieces
from graph_validator.models import Category, Lesson, MatchOptions, Step
from graph_validator.steps import evaluate_step
from helpers import P

OFF = MatchOptions()
STRICT = MatchOptions(strict_positions=True)


def parts(ps):
    return parts_from_pieces(ps)


def target():
    """Battery -> button -> 1k -> LED, closed by a 4-column jumper (the lesson from the debug panel)."""
    return [
        P("bat", "bateria", 1, 2, 0),
        P("btn", "botao", 2, 3, 1),
        P("r", "resistor_1k", 3, 4, 2),
        P("led", "led", 4, 5, 3),
        P("j", "jumper_4", 1, 5, 4),
    ]


def swapped():
    return [
        P("bat", "bateria", 1, 2, 0),
        P("btn", "botao", 3, 4, 1),
        P("r", "resistor_1k", 2, 3, 2),
        P("led", "led", 4, 5, 3),
        P("j", "jumper_4", 1, 5, 4),
    ]


def test_series_order_does_not_matter():
    assert equivalent(parts(swapped()), parts(target()), OFF)


def test_fixed_positions_still_reject_the_swap():
    from graph_validator.graph import build_graph
    from graph_validator.match import is_match

    assert not is_match(build_graph(parts(swapped())), build_graph(parts(target())), STRICT)


def test_relabelled_columns_and_row_changes_match():
    moved = [p.model_copy(update={"a": p.a + 3, "b": p.b + 3, "row": p.row + 5}) for p in target()]
    assert equivalent(parts(moved), parts(target()), OFF)


def test_jumper_kind_and_extra_wire_do_not_matter():
    t = target()
    t[-1] = P("j", "jumper_4", 5, 1, 4)
    t.append(P("j2", "jumper_curto", 5, 6, 5))  # only extends the net: a dangling wire is fine
    base = target()
    assert equivalent(parts(base), parts(t), OFF)


def _parallel(order):
    ps = [
        P("bat", "bateria", 1, 2, 0),
        P("w1", "jumper_longo", 1, 3, 1),
        P("w2", "jumper_curto", 4, 5, 2),
        P("btn", "botao", 5, 6, 3),
        P("w3", "jumper_4", 2, 6, 4),
    ]
    branches = {"r": P("r", "resistor_220", 3, 4, 6), "led": P("led", "led", 3, 4, 7)}
    return ps + [branches[k] for k in order]


def test_parallel_branches_in_any_order():
    from graph_validator.equiv import netlist, reduce_sp

    a, b = parts(_parallel(["r", "led"])), parts(_parallel(["led", "r"]))
    assert reduce_sp(netlist(a), False) is not None
    assert equivalent(a, b, OFF)
    assert "paralelo" in describe_canonical(a)
    # the LED in series with the resistor instead of beside it is a different circuit
    series = [p for p in _parallel(["r"])] + [P("led", "led", 7, 8, 7), P("w4", "jumper_curto", 4, 7, 8)]
    assert not equivalent(parts(series), a, OFF)


def test_led_and_battery_polarity_matter():
    t = target()
    flipped_led = [p if p.id != "led" else p.model_copy(update={"a": 5, "b": 4}) for p in t]
    flipped_bat = [p if p.id != "bat" else p.model_copy(update={"a": 2, "b": 1}) for p in t]
    assert not equivalent(parts(flipped_led), parts(t), OFF)
    assert not equivalent(parts(flipped_bat), parts(t), OFF)


def test_values_only_with_match_values():
    t = target()
    other = [p if p.id != "r" else p.model_copy(update={"type": "resistor_220"}) for p in t]
    assert equivalent(parts(other), parts(t), OFF)
    assert not equivalent(parts(other), parts(t), MatchOptions(match_values=True))


def test_missing_wire_is_an_open_loop():
    issues = diff_nets(parts(target()[:-1]), parts(target()), OFF)
    assert issues[0].category == Category.OPEN_CIRCUIT


def test_reversed_led_is_named_even_when_moved():
    t = target()
    moved = [p.model_copy(update={"a": p.a + 2, "b": p.b + 2}) for p in t]
    moved = [p if p.id != "led" else p.model_copy(update={"a": p.b, "b": p.a}) for p in moved]
    issues = diff_nets(parts(moved), parts(t), OFF)
    assert [(i.category, i.part_id) for i in issues] == [(Category.REVERSED_POLARITY, "led")]


def test_part_in_parallel_instead_of_series_is_misconnected():
    t = target()
    wrong = [p if p.id != "r" else p.model_copy(update={"a": 1, "b": 2}) for p in t]
    assert not equivalent(parts(wrong), parts(t), OFF)
    issues = diff_nets(parts(wrong), parts(t), OFF)
    assert issues and issues[0].category in (Category.MISCONNECTED_COMPONENT, Category.OPEN_CIRCUIT,
                                             Category.INCORRECT_CONNECTION)


def test_shorted_battery():
    t = target()
    short = t + [P("s", "jumper_curto", 1, 2, 5)]
    assert not equivalent(parts(short), parts(t), OFF)
    assert diff_nets(parts(short), parts(t), OFF)[0].category == Category.SHORT_CIRCUIT


def test_wheatstone_bridge_uses_the_fallback():
    # topology is checked structurally: reduce_sp must refuse a bridge
    from graph_validator.equiv import netlist, reduce_sp
    from graph_validator.graph import Part, Term

    def mk(i, t, a, b):
        return Part(i, t, (Term("pin", a, 0), Term("pin", b, 0)), None)

    bat = Part("bat", "bateria", (Term("+", 1, 0), Term("-", 6, 0)), None)
    ps = [bat, mk("a", "resistor_220", 1, 3), mk("b", "resistor_220", 1, 4), mk("c", "resistor_220", 3, 6),
          mk("d", "resistor_220", 4, 6), mk("e", "botao", 3, 4)]
    assert reduce_sp(netlist(ps), False) is None
    shuffled = ps[:]
    random.Random(1).shuffle(shuffled)
    assert equivalent(ps, shuffled, OFF)
    assert not equivalent(ps, ps[:-1], OFF)


def test_hash_ignores_movement_and_series_order():
    assert circuit_hash(parts(swapped())) == circuit_hash(parts(target()))
    assert circuit_hash(parts(target())) != circuit_hash(parts(target()[:-1]))


def test_description_is_position_free():
    assert describe_canonical(parts(target()))  == describe_canonical(parts(swapped()))
    nets = describe_nets(parts(target()))
    assert len(nets) == 4 and all("[" in n for n in nets)


def test_net_partners_prefers_battery():
    ps = parts(target())
    assert [p.id for p in net_partners(ps, "btn")][0] == "bat"


def test_connect_step_accepts_swapped_board_and_reports_nets():
    lesson = Lesson(
        id="l", kind="guided",
        steps=[Step(id="c", action="connect_circuit", pieces=target())],
    )
    ok = evaluate_step(lesson, 0, parts(swapped()))
    assert ok.approved
    strict = Lesson(
        id="l", kind="guided",
        steps=[Step(id="c", action="connect_circuit", pieces=target(), options=STRICT)],
    )
    assert not evaluate_step(strict, 0, parts(swapped())).approved
