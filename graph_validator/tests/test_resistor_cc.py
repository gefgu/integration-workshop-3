"""Color-code resistor capsule (EFR12): a resistor whose value comes from three discs."""
from graph_validator.catalog import CC_DEFAULT, CC_VALUES, piece_value
from graph_validator.match import is_match
from graph_validator.models import MatchOptions, board_problems

from helpers import G, P

VALUES = MatchOptions(match_values=True)


def circuit(resistor):
    return [P("bat", "bateria", 1, 2, 0), resistor, P("led", "led", 3, 4, 2), P("j", "jumper_longo", 4, 2, 3)]


def test_disc_values():
    assert {220, 470, 1000, 2200, 4700, 10000} <= CC_VALUES
    assert piece_value("resistor_cc", None) == CC_DEFAULT
    assert piece_value("resistor_cc", 4700) == 4700


def test_impossible_value_is_a_board_problem():
    assert board_problems([P("r", "resistor_cc", 2, 3, value=470)]) == []
    assert board_problems([P("r", "resistor_cc", 2, 3, value=333)])


def test_matches_a_fixed_resistor_of_the_same_value():
    fixed = G(circuit(P("r", "resistor_470", 2, 3, 1)))
    assert is_match(G(circuit(P("r", "resistor_cc", 2, 3, 1, value=470))), fixed, VALUES)
    assert not is_match(G(circuit(P("r", "resistor_cc", 2, 3, 1, value=220))), fixed, VALUES)
    assert is_match(G(circuit(P("r", "resistor_cc", 2, 3, 1, value=220))), fixed, MatchOptions())
