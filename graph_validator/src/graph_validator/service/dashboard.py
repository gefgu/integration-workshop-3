"""Student performance for the teacher: score, progress and time spent (SFR29, SFR29.1)."""
from __future__ import annotations

from collections import defaultdict
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import Me
from .storage import ClassLesson, ClassModule, ModuleLesson, ProgressEvent, SavedLesson, Student, get_session
from .workspace import own_class, own_student

router = APIRouter(prefix="/dashboard")
Db = Annotated[Session, Depends(get_session)]


def class_lesson_ids(db: Session, class_id: int) -> list[str]:
    """Lessons of the class's modules in order, then lessons assigned on their own, without repeats."""
    ordered: list[str] = []
    module_ids = db.scalars(select(ClassModule.module_id).where(ClassModule.class_id == class_id)
                            .order_by(ClassModule.position)).all()
    for module_id in module_ids:
        ordered += db.scalars(select(ModuleLesson.lesson_id).where(ModuleLesson.module_id == module_id)
                              .order_by(ModuleLesson.position)).all()
    ordered += db.scalars(select(ClassLesson.lesson_id).where(ClassLesson.class_id == class_id)
                          .order_by(ClassLesson.position)).all()
    return list(dict.fromkeys(ordered))


def iso(value) -> str | None:
    return value.isoformat() + "Z" if value else None


def summarize(events: list[ProgressEvent], lesson_ids: list[str]) -> dict[str, Any]:
    done = {e.lesson_id for e in events if e.kind == "lesson_done" and e.lesson_id in lesson_ids}
    scores = [e for e in events if e.kind == "challenge_score" and e.score is not None]
    sessions = [e.duration_s or 0 for e in events if e.kind == "session"]
    # Without session events (older benches) fall back to the time of finished lessons.
    time_spent = sum(sessions) if sessions else sum(e.duration_s or 0 for e in events if e.kind == "lesson_done")
    last = max((e.at for e in events), default=None)
    latest_score = max(scores, key=lambda e: (e.at, e.seq)) if scores else None
    return {
        "lessons_done": len(done),
        "lessons_total": len(lesson_ids),
        "progress": round(len(done) / len(lesson_ids), 3) if lesson_ids else 0.0,
        "best_score": max((e.score for e in scores), default=None),
        "last_score": latest_score.score if latest_score else None,
        "challenges": len(scores),
        "time_spent_s": round(time_spent, 1),
        "last_activity": iso(last),
    }


@router.get("/classes/{class_id}")
def class_dashboard(class_id: int, db: Db, me: Me) -> dict:
    school_class = own_class(db, me, class_id)
    lesson_ids = class_lesson_ids(db, class_id)
    students = db.scalars(select(Student).where(Student.class_id == class_id).order_by(Student.name)).all()
    by_student: dict[int, list[ProgressEvent]] = defaultdict(list)
    for event in db.scalars(select(ProgressEvent).where(ProgressEvent.student_id.in_([s.id for s in students]))):
        by_student[event.student_id].append(event)
    rows = [{"student": {"id": s.id, "name": s.name, "nickname": s.nickname, "nfc_code": s.nfc_code,
                         "active": s.active}, **summarize(by_student[s.id], lesson_ids)} for s in students]
    scored = [r["best_score"] for r in rows if r["best_score"] is not None]
    return {
        "class": {"id": school_class.id, "name": school_class.name},
        "lesson_ids": lesson_ids,
        "summary": {
            "students": len(rows),
            "avg_progress": round(sum(r["progress"] for r in rows) / len(rows), 3) if rows else 0.0,
            "avg_best_score": round(sum(scored) / len(scored), 1) if scored else None,
            "time_spent_s": round(sum(r["time_spent_s"] for r in rows), 1),
        },
        "students": rows,
    }


@router.get("/students/{student_id}")
def student_dashboard(student_id: int, db: Db, me: Me) -> dict:
    student = own_student(db, me, student_id)
    lesson_ids = class_lesson_ids(db, student.class_id)
    events = db.scalars(select(ProgressEvent).where(ProgressEvent.student_id == student_id)
                        .order_by(ProgressEvent.at.desc(), ProgressEvent.seq.desc())).all()
    titles = dict(db.execute(select(SavedLesson.id, SavedLesson.title)
                             .where(SavedLesson.id.in_({*lesson_ids, *(e.lesson_id for e in events if e.lesson_id)})))
                  .all())
    lessons = []
    for lesson_id in lesson_ids:
        mine = [e for e in events if e.lesson_id == lesson_id]
        done = any(e.kind == "lesson_done" for e in mine)
        steps = [e.step_idx for e in mine if e.kind == "step_done" and e.step_idx is not None]
        scores = [e.score for e in mine if e.kind == "challenge_score" and e.score is not None]
        lessons.append({
            "lesson_id": lesson_id,
            "title": titles.get(lesson_id, lesson_id),
            "status": "done" if done else "in_progress" if mine else "not_started",
            "steps_done": max(steps) + 1 if steps else 0,
            "best_score": max(scores, default=None),
            "time_spent_s": round(sum(e.duration_s or 0 for e in mine if e.kind == "lesson_done"), 1),
        })
    return {
        "student": {"id": student.id, "name": student.name, "nickname": student.nickname,
                    "nfc_code": student.nfc_code, "class_id": student.class_id},
        **summarize(list(events), lesson_ids),
        "lessons": lessons,
        "events": [{"event_id": e.event_id, "kind": e.kind, "lesson_id": e.lesson_id,
                    "lesson_title": titles.get(e.lesson_id) if e.lesson_id else None, "step_idx": e.step_idx,
                    "score": e.score, "duration_s": e.duration_s, "at": iso(e.at), "bench_id": e.bench_id}
                   for e in events[:100]],
    }
