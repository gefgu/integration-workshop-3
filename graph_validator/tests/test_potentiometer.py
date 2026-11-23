import pytest

from graph_validator.graph import build_graph, part_from_detected, part_from_piece, parts_from_pieces
from graph_validator.catalog import CATALOG
from graph_validator.equiv import equivalent
from graph_validator.match import graph_hash, is_match
from graph_validator.models import DetectedComponent, MatchOptions, Piece, board_problems
from graph_validator.validate import parts_problems


def pot(**changes):
    return Piece(id='pot', type='potenciometro', a=3, b=5, row=2, **changes)


def test_potentiometer_has_two_ends_and_one_middle_wiper_with_legacy_geometry():
    p = part_from_piece(pot())
    assert CATALOG['potenciometro'].terminals == ('A', 'B', 'W')
    assert [(t.name, t.col) for t in p.terms] == [('A', 3), ('B', 5), ('W', 4)]
    assert board_problems([pot()]) == parts_problems([p]) == []
    assert board_problems([pot(c=3)])
    assert board_problems([pot(value=10001)])
    assert board_problems([pot(c=4, value=0)]) == []
    explicit = build_graph([part_from_piece(pot(c=4))])
    legacy = build_graph([p])
    options = MatchOptions(strict_positions=True)
    assert is_match(explicit, legacy, options)
    assert graph_hash(explicit, options) == graph_hash(legacy, options)


def test_named_camera_terminals_require_the_wiper_instead_of_guessing_it():
    raw = dict(type='potenciometro', terminals={'A': {'col': 3, 'row': 2},
                'B': {'col': 5, 'row': 2}, 'wiper': {'col': 4, 'row': 2}})
    p = part_from_detected(DetectedComponent.model_validate(raw), 0)
    assert [t.name for t in p.terms] == ['A', 'B', 'W']
    assert parts_problems([p]) == []
    del raw['terminals']['wiper']
    with pytest.raises(ValueError, match="terminal 'W'"):
        part_from_detected(DetectedComponent.model_validate(raw), 0)


def test_reversed_ends_preserve_topology_but_wiper_and_value_roles_remain_distinct():
    target = [pot(c=4, value=1000), Piece(id='bat', type='bateria', a=1, b=2, row=0),
              Piece(id='led', type='led', a=4, b=5, row=3),
              Piece(id='plus', type='jumper_longo', a=1, b=3, row=4),
              Piece(id='return', type='jumper_3', a=5, b=2, row=5)]
    reversed_ends = [target[0].model_copy(update={'a': 5, 'b': 3}), *target[1:]]
    a, b = parts_from_pieces(target), parts_from_pieces(reversed_ends)
    assert equivalent(a, b)
    assert is_match(build_graph(a), build_graph(b))
    assert not equivalent(a, b, MatchOptions(match_values=True))
    wrong_wiper = [target[0].model_copy(update={'c': 6}), *target[1:]]
    assert not equivalent(a, parts_from_pieces(wrong_wiper))
