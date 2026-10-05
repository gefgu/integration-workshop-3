"""Stateless HTTP wrapper around the validator."""
from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ValidationError

from ..adapters.detection import load_board
from ..adapters.teacher_lesson import lesson_from_teacher
from ..models import InvalidBoard, Lesson
from ..steps import StepResult, evaluate_step, lint

app = FastAPI(title="TedTronics graph validator")


class StepRequest(BaseModel):
    lesson: Lesson
    board: dict[str, Any]
    step_idx: int | None = None  # omitted on /validate/final
    previous_graph_hash: str | None = None
    answer: str | None = None


def _run(req: StepRequest, idx: int) -> StepResult:
    if not 0 <= idx < len(req.lesson.steps):
        raise HTTPException(422, f"step_idx out of range 0..{len(req.lesson.steps) - 1}")
    try:
        parts = load_board(req.board)
        return evaluate_step(req.lesson, idx, parts, req.previous_graph_hash, req.answer)
    except InvalidBoard as e:
        raise HTTPException(422, {"error": "invalid_board", "problems": e.problems})
    except (ValueError, ValidationError) as e:
        raise HTTPException(422, {"error": "invalid_input", "detail": str(e)})


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/lessons/lint")
def lessons_lint(lesson: Lesson) -> dict[str, list[str]]:
    return {"problems": lint(lesson)}


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
