from graph_validator.catalog import DIRECTED
from graph_validator.graph import build_graph, parts_from_detected, parts_from_pieces
from graph_validator.match import graph_hash, is_match
from graph_validator.models import DetectedBoard, MatchOptions

from helpers import G, P, loop


def test_graph_has_terminal_nodes_and_edge_kinds():
    g = G(loop())
    assert g.number_of_nodes() == 8
    assert g.nodes["led.0:anode"]["terminal"] == "anode"
    assert g.nodes["led.1:cathode"]["terminal"] == "cathode"
    assert g.nodes["r.0:pin"]["ctype"] == "resistor"
    assert g["led.0:anode"]["led.1:cathode"]["kind"] == "component"
    assert g["bat.1:-"]["j.1:pin"]["kind"] == "column"  # both on column 2
    assert g["r.0:pin"]["bat.1:-"]["kind"] == "column"


def test_row_does_not_create_edges_or_break_match():
    t = loop()
    assert is_match(G([p.model_copy(update={"row": 5}) for p in t]), G(t))


def test_js_parity_matchesTarget():
    t = loop()
    flip = lambda i, **k: [p.model_copy(update=k) if p.id == i else p for p in t]
    assert is_match(G(flip("r", a=3, b=2)), G(t))        # resistor legs interchangeable
    assert not is_match(G(flip("led", a=4, b=3)), G(t))  # LED polarity matters
    assert not is_match(G(t[1:]), G(t))                  # missing battery


def test_relabelled_columns_are_same_circuit():
    t = loop()
    moved = [P("bat", "bateria", 6, 7), P("r", "resistor_470", 7, 8, 1), P("led", "led", 8, 9, 2), P("j", "jumper_longo", 9, 7, 3)]
    assert is_match(G(moved), G(t))


def test_values_only_matter_when_requested():
    a = G([P("bat", "bateria", 1, 2), P("r", "resistor_220", 2, 3)])
    b = G([P("bat", "bateria", 1, 2), P("r", "resistor_470", 2, 3)])
    assert is_match(a, b)
    assert not is_match(a, b, MatchOptions(match_values=True))


def test_pot_value_matching():
    a = G([P("p", "potenciometro", 1, 2, value=100)])
    b = G([P("p", "potenciometro", 1, 2, value=4700)])
    assert is_match(a, b)
    assert not is_match(a, b, MatchOptions(match_values=True))


def test_short_and_long_jumper_same_family():
    a = G([P("j", "jumper_curto", 1, 2)])
    b = G([P("j", "jumper_longo", 1, 3)])
    assert is_match(a, b)


def test_strict_positions_are_translation_invariant_but_shape_sensitive():
    t = loop()
    opts = MatchOptions(strict_positions=True)
    shifted = [p.model_copy(update={"a": p.a + 3, "b": p.b + 3, "row": p.row + 2}) for p in t]
    assert is_match(G(shifted), G(t), opts)
    # same topology, different layout -> differs only under strict positions
    spread = [P("bat", "bateria", 1, 2, 0), P("r", "resistor_470", 2, 3, 1), P("led", "led", 3, 4, 5), P("j", "jumper_longo", 4, 2, 3)]
    assert is_match(G(spread), G(t))
    assert not is_match(G(spread), G(t), opts)


def test_hash_is_invariant_and_changes_with_circuit():
    t = loop()
    assert graph_hash(G(t)) == graph_hash(G([p.model_copy(update={"row": 7}) for p in t]))
    assert graph_hash(G(t)) != graph_hash(G(t[:3]))


def test_detected_board_matches_piece_board():
    det = DetectedBoard.model_validate({"components": [
        {"id": "bat", "type": "bateria", "terminals": {"+": {"col": 1, "row": 0}, "-": {"col": 2, "row": 0}}},
        {"id": "r", "type": "resistor_470", "terminals": {"x": {"col": 3, "row": 1}, "y": {"col": 2, "row": 1}}},
        {"id": "led", "type": "led", "terminals": {"anode": {"col": 3, "row": 2}, "cathode": {"col": 4, "row": 2}}},
        {"id": "j", "type": "jumper_longo", "terminals": {"a": {"col": 4, "row": 3}, "b": {"col": 2, "row": 3}}},
    ]})
    assert is_match(build_graph(parts_from_detected(det)), G(loop()))
