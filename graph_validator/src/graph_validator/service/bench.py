"""What the teacher's phone carries between the server and the bench (SFR41-45, SFR55-59).

- POST /bench/session: a signed token the bench checks offline before it unlocks (SFR43, SFR57).
- GET  /bench/package/{module_id}?class_id=&student_id=: module + lesson documents + the student the teacher
  picked for this bench (no tags: the teacher chooses who uses the bench).
- POST /bench/sync: bench events, stored once per event_id (SFR59).
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import Me
from .security import sign_bench_token
from .storage import ProgressEvent, SavedLesson, SchoolClass, Student, get_session, student_uid
from .workspace import own_class, own_module, own_student

router = APIRouter(prefix="/bench")
Db = Annotated[Session, Depends(get_session)]
PACKAGE_FORMAT = 1
EventKind = Literal["session", "step_done", "lesson_done", "quiz_answer", "challenge_score"]


def lesson_version(document: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(document, sort_keys=True).encode()).hexdigest()[:16]


@router.post("/session")
def bench_session(me: Me) -> dict:
    return {**sign_bench_token(me.id, me.name), "teacher": {"id": me.id, "name": me.name}}


@router.get("/package/{module_id}")
def bench_package(module_id: int, class_id: int, student_id: int, db: Db, me: Me) -> dict:
    module = own_module(db, me, module_id)
    school_class = own_class(db, me, class_id)
    student = own_student(db, me, student_id)
    if student.class_id != school_class.id:
        raise HTTPException(422, "O aluno não é desta turma.")
    if not student.active:
        raise HTTPException(422, "O aluno está inativo.")
    if not module.lessons:
        raise HTTPException(422, "O módulo não tem lições.")
    documents = {lesson.id: lesson.document for lesson in db.scalars(
        select(SavedLesson).where(SavedLesson.id.in_([link.lesson_id for link in module.lessons]))).all()}
    lessons = []
    for link in module.lessons:
        document = dict(documents[link.lesson_id])
        document.pop("audio", None)  # audio travels as files, not over Bluetooth
        document.pop("teacherNotes", None)  # teacher-only prose is not needed by the offline player
        lessons.append({**document, "lessonVersion": lesson_version(document)})
    body = {
        "module": {"id": module.id, "title": module.title, "description": module.description,
                   "lesson_ids": [link.lesson_id for link in module.lessons]},
        "class": {"id": school_class.id, "name": school_class.name},
        "lessons": lessons,
        "student": {"id": student.id, "uid": student.uid, "name": student.name, "nickname": student.nickname},
    }
    version_id = hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()[:16]
    return {"format": PACKAGE_FORMAT, "version_id": version_id, "teacher": {"id": me.id, "name": me.name},
            "created_at": datetime.now(timezone.utc).isoformat(), **body}


class EventIn(BaseModel):
    event_id: str = Field(min_length=8, max_length=64)
    student_id: int
    student_uid: str = Field(min_length=1, max_length=36)  # SNFR8: the student by both ids
    kind: EventKind
    seq: int
    at: datetime
    lesson_id: str | None = None
    module_id: int | None = None
    lesson_version: str | None = None
    step_idx: int | None = None
    score: int | None = None
    duration_s: float | None = Field(default=None, ge=0)


class SyncInput(BaseModel):
    bench_id: str = Field(min_length=1, max_length=64)
    events: list[EventIn] = Field(max_length=2000)


@router.post("/sync")
def bench_sync(body: SyncInput, db: Db, me: Me) -> dict:
    """Acks every event that is now stored, including ones already stored by an earlier upload."""
    student_ids = {e.student_id for e in body.events}
    mine = {sid: student_uid(sid) for sid in db.scalars(
        select(Student.id).join(SchoolClass).where(Student.id.in_(student_ids), SchoolClass.teacher_id == me.id))}
    known = set(db.scalars(select(ProgressEvent.event_id)
                           .where(ProgressEvent.event_id.in_([e.event_id for e in body.events]))).all())
    acked, rejected, inserted = [], [], 0
    received = datetime.now(timezone.utc).replace(tzinfo=None)
    for event in body.events:
        if event.event_id in known:
            acked.append(event.event_id)
            continue
        if event.student_id not in mine:
            rejected.append({"event_id": event.event_id, "reason": "Aluno não pertence a este professor."})
            continue
        if mine[event.student_id] != event.student_uid:
            # Same integer id, different student (e.g. a bench loaded from another database): never mix them up.
            rejected.append({"event_id": event.event_id, "reason": "O uid do aluno não confere."})
            continue
        at = event.at.astimezone(timezone.utc).replace(tzinfo=None) if event.at.tzinfo else event.at
        db.add(ProgressEvent(**event.model_dump(exclude={"at"}), at=at, bench_id=body.bench_id, received_at=received))
        known.add(event.event_id)
        acked.append(event.event_id)
        inserted += 1
    db.commit()
    return {"acked": acked, "rejected": rejected, "inserted": inserted}
