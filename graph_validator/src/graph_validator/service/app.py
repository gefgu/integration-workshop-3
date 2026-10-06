"""Stateless HTTP wrapper around the validator."""
from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ValidationError

from ..adapters.detection import load_board
from ..adapters.teacher_lesson import lesson_from_teacher
from ..models import InvalidBoard, Lesson, Piece
from ..feedback import DEFAULT_MESSAGES, NAMES
from ..models import Category
from ..equiv import describe_canonical, describe_nets
from ..graph import parts_from_pieces
from ..steps import StepDebug, StepResult, evaluate_step, lint, lint_issues, resolve_targets
from .workspace import router as workspace_router

app = FastAPI(title="TedTronics graph validator")
app.include_router(workspace_router)


class StepRequest(BaseModel):
    lesson: Lesson
    board: dict[str, Any]
    step_idx: int | None = None  # omitted on /validate/final
    previous_graph_hash: str | None = None
    answer: str | None = None
    debug: bool = False


def _run(req: StepRequest, idx: int) -> StepResult:
    if not 0 <= idx < len(req.lesson.steps):
        raise HTTPException(422, f"step_idx out of range 0..{len(req.lesson.steps) - 1}")
    try:
        parts = load_board(req.board)
        result = evaluate_step(req.lesson, idx, parts, req.previous_graph_hash, req.answer)
        if req.debug:
            step = req.lesson.steps[idx]
            actual = [Piece.model_validate(piece) for piece in req.board.get("pieces", [])]
            expected_parts = parts_from_pieces(resolve_targets(req.lesson)[idx])
            result.debug = StepDebug(
                step_id=step.id,
                action=step.action,
                expected_pieces=resolve_targets(req.lesson)[idx],
                actual_pieces=actual,
                match_values=step.options.match_values,
                strict_positions=step.options.strict_positions,
                expected_nets=describe_nets(expected_parts),
                actual_nets=describe_nets(parts),
                expected_circuit=describe_canonical(expected_parts, step.options),
                actual_circuit=describe_canonical(parts, step.options),
            )
        return result
    except InvalidBoard as e:
        raise HTTPException(422, {"error": "invalid_board", "problems": e.problems})
    except (ValueError, ValidationError) as e:
        raise HTTPException(422, {"error": "invalid_input", "detail": str(e)})


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/lessons/lint")
def lessons_lint(lesson: Lesson) -> dict[str, Any]:
    return {
        "problems": lint(lesson),
        "byStep": [{"stepId": sid, "message": m} for sid, m in lint_issues(lesson)],
    }


@app.get("/feedback/categories")
def feedback_categories() -> dict[str, Any]:
    """Default pt-BR messages and component families, for the teacher's override UI (SFR15.1)."""
    return {
        "categories": [{"category": c.value, "defaultMessage": DEFAULT_MESSAGES[c]} for c in Category],
        "families": [{"family": f, "name": n} for f, n in NAMES.items()],
    }


@app.post("/lessons/import-teacher")
def import_teacher(raw: dict[str, Any]) -> Lesson:
    try:
        return lesson_from_teacher(raw)
    except ValueError as e:
        raise HTTPException(422, str(e))


@app.post("/validate/step")
def validate_step(req: StepRequest) -> StepResult:
    if req.step_idx is None:
        raise HTTPException(422, "step_idx is required")
    return _run(req, req.step_idx)


@app.post("/validate/final")
def validate_final(req: StepRequest) -> StepResult:
    return _run(req, len(req.lesson.steps) - 1)
