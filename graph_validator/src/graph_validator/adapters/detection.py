"""Camera detection output / teacher pieces -> list[Part]."""
from __future__ import annotations

from ..graph import Part, parts_from_detected, parts_from_pieces
from ..models import DetectedBoard, Piece


def load_board(raw: dict) -> list[Part]:
    """Accepts {"components": [...]} (camera), {"pieces": [...]} or a teacher lesson's {"board": {"pieces": [...]}}."""
    if "components" in raw:  # an empty list is a valid, empty board
        return parts_from_detected(DetectedBoard.model_validate(raw))
    pieces = raw["pieces"] if "pieces" in raw else (raw.get("board") or {}).get("pieces")
    if pieces is None:
        raise ValueError("board needs `components` (camera) or `pieces`")
    return parts_from_pieces([Piece.model_validate(p) for p in pieces])
