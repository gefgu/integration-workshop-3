"""Teacher authoring app lesson JSON (v1) -> Lesson.

The app stores one board per lesson and no steps, so it maps to a final-target-only
lesson (SFR3): the saved board is the target, whatever the lesson's `kind`.
Guided, step-by-step lessons use the validator's own step schema (see steps.py).
"""
from __future__ import annotations

from pydantic import ValidationError

from ..models import Lesson, Piece, board_problems

TEACHER_LESSON_VERSION = 1


def lesson_from_teacher(raw: dict) -> Lesson:
    if not isinstance(raw, dict) or raw.get("version") != TEACHER_LESSON_VERSION:
        raise ValueError(f"unsupported teacher lesson version: {getattr(raw, 'get', lambda *_: None)('version')}")
    pieces_raw = (raw.get("board") or {}).get("pieces")
    if not isinstance(pieces_raw, list):
        raise ValueError("lesson has no board.pieces")
    try:
        pieces = [Piece.model_validate(p) for p in pieces_raw]
    except ValidationError as e:
        raise ValueError(str(e)) from e
    problems = board_problems(pieces)
    if problems:
        raise ValueError("; ".join(problems))
    return Lesson.model_validate({
        "id": str(raw["id"]),
        "kind": "challenge",
        "steps": [{"id": "final", "action": "place_component", "pieces": [p.model_dump() for p in pieces]}],
    })
