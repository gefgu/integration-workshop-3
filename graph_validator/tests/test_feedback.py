from graph_validator.diff import diff_parts
from graph_validator.feedback import classify, feedback, message_for
from graph_validator.graph import parts_from_pieces
from graph_validator.models import Category, MatchOptions

from helpers import P, loop


def issues(student, target, **o):
    return diff_parts(parts_from_pieces(student), parts_from_pieces(target), MatchOptions(**o))


def test_reversed_led():
    t = loop()
    s = [p.model_copy(update={"a": 4, "b": 3}) if p.id == "led" else p for p in t]
    assert classify(issues(s, t)) == Category.REVERSED_POLARITY


def test_missing_jumper_is_missing_connection():
    t = loop()
    assert classify(issues([p for p in t if p.id != "j"], t)) == Category.MISSING_CONNECTION


def test_missing_led_is_missing_component():
    t = loop()
    assert classify(issues([p for p in t if p.id != "led"], t)) == Category.MISSING_COMPONENT


def test_extra_part_is_excess():
    t = loop()
    s = t + [P("j2", "jumper_curto", 8, 9, 4)]
    assert classify(issues(s, t)) == Category.EXCESS_CONNECTION


def test_moved_jumper_is_incorrect_connection():
    t = loop()
    s = [P("j", "jumper_longo", 5, 7, 3) if p.id == "j" else p for p in t]
    assert classify(issues(s, t)) == Category.INCORRECT_CONNECTION


def test_wrong_component_and_wrong_value():
    t = loop()
    s = [P("r", "capacitor", 2, 3, 1) if p.id == "r" else p for p in t]
    assert classify(issues(s, t)) == Category.WRONG_COMPONENT
    s2 = [P("r", "resistor_220", 2, 3, 1) if p.id == "r" else p for p in t]
    assert classify(issues(s2, t, match_values=True)) == Category.WRONG_VALUE


def test_diff_aligns_a_shifted_build():
    t = loop()
    s = [p.model_copy(update={"a": p.a + 4, "b": p.b + 4}) for p in t if p.id != "j"]
    iss = issues(s, t)
    assert [i.category for i in iss] == [Category.MISSING_CONNECTION]


def test_default_messages_exist_and_are_ptbr():
    for c in Category:
        assert message_for(c)


def test_override_only_for_named_component():
    ov = {"reversed_polarity": {"led": "Vire o LED!"}}
    assert message_for(Category.REVERSED_POLARITY, "led", ov) == "Vire o LED!"
    assert message_for(Category.REVERSED_POLARITY, "bateria", ov) != "Vire o LED!"
    iss = issues([p.model_copy(update={"a": 4, "b": 3}) if p.id == "led" else p for p in loop()], loop())
    assert feedback(iss, ov) == (Category.REVERSED_POLARITY, "Vire o LED!")
