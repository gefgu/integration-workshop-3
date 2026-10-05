"""python -m graph_validator.cli lint|validate ..."""
from __future__ import annotations

import argparse
import json
import sys

from .adapters.detection import load_board
from .adapters.teacher_lesson import lesson_from_teacher
from .models import InvalidBoard, Lesson
from .steps import evaluate_step, lint


def _load_lesson(path: str, teacher: bool) -> Lesson:
    raw = json.load(open(path, encoding="utf-8"))
    return lesson_from_teacher(raw) if teacher else Lesson.model_validate(raw)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="graph_validator")
    sub = ap.add_subparsers(dest="cmd", required=True)
    l = sub.add_parser("lint", help="check a lesson against the step rules")
    l.add_argument("lesson")
    l.add_argument("--teacher", action="store_true", help="lesson is teacher-app JSON v1")
    v = sub.add_parser("validate", help="validate a board against a step")
    v.add_argument("lesson")
    v.add_argument("board")
    v.add_argument("--teacher", action="store_true")
    v.add_argument("--step", type=int, default=None, help="0-based step (default: last)")
    v.add_argument("--previous-hash")
    v.add_argument("--answer")
    a = ap.parse_args(argv)

    lesson = _load_lesson(a.lesson, a.teacher)
    if a.cmd == "lint":
        problems = lint(lesson)
        print(json.dumps({"problems": problems}, ensure_ascii=False, indent=2))
        return 1 if problems else 0
    idx = len(lesson.steps) - 1 if a.step is None else a.step
    try:
        parts = load_board(json.load(open(a.board, encoding="utf-8")))
        res = evaluate_step(lesson, idx, parts, a.previous_hash, a.answer)
    except InvalidBoard as e:
        print(json.dumps({"error": "invalid_board", "problems": e.problems}, ensure_ascii=False, indent=2))
        return 2
    print(res.model_dump_json(indent=2))
    return 0 if res.approved else 1


if __name__ == "__main__":
    sys.exit(main())
