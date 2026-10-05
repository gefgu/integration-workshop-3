from graph_validator.graph import build_graph, parts_from_pieces
from graph_validator.models import Piece


def P(id, type, a, b, row=0, **kw):
    return Piece(id=id, type=type, a=a, b=b, row=row, **kw)


def loop():
    """Battery -> 470 ohm -> LED -> long jumper back (same loop as the JS tests)."""
    return [
        P("bat", "bateria", 1, 2, 0),
        P("r", "resistor_470", 2, 3, 1),
        P("led", "led", 3, 4, 2),
        P("j", "jumper_longo", 4, 2, 3),
    ]


def G(pieces):
    return build_graph(parts_from_pieces(pieces))
