"""What the teacher's phone carries between the server and the bench (SFR41-45, SFR55-59).

- POST /bench/session: a signed token the bench checks offline before it unlocks (SFR43, SFR57).
- GET  /bench/package/{module_id}?class_id=: module + lesson documents + the class's tagged students.
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
from .storage import ProgressEvent, SavedLesson, SchoolClass, Student, get_session
from .workspace import own_class, own_module

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
def bench_package(module_id: int, class_id: int, db: Db, me: Me) -> dict:
    module = own_module(db, me, module_id)
    school_class = own_class(db, me, class_id)
    if not module.lessons:
        raise HTTPException(422, "O módulo não tem lições.")
    documents = {lesson.id: lesson.document for lesson in db.scalars(
        select(SavedLesson).where(SavedLesson.id.in_([link.lesson_id for link in module.lessons]))).all()}
    lessons = []
    for link in module.lessons:
        document = dict(documents[link.lesson_id])
        document.pop("audio", None)  # audio travels as files, not over Bluetooth
        lessons.append({**document, "lessonVersion": lesson_version(document)})
    students = [{"id": s.id, "name": s.name, "nickname": s.nickname, "nfc_code": s.nfc_code}
                for s in sorted(school_class.students, key=lambda s: s.name) if s.active and s.nfc_code]
    body = {
        "module": {"id": module.id, "title": module.title, "description": module.description,
                   "lesson_ids": [link.lesson_id for link in module.lessons]},
        "class": {"id": school_class.id, "name": school_class.name},
        "lessons": lessons,
        "students": students,
    }
    version_id = hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()[:16]
    return {"format": PACKAGE_FORMAT, "version_id": version_id, "teacher": {"id": me.id, "name": me.name},
            "created_at": datetime.now(timezone.utc).isoformat(), **body}


class EventIn(BaseModel):
    event_id: str = Field(min_length=8, max_length=64)
    student_id: int
    nfc_code: str = Field(min_length=1, max_length=255)  # SNFR8: always both ids, never the tag alone
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
    mine = set(db.scalars(select(Student.id).join(SchoolClass)
                          .where(Student.id.in_(student_ids), SchoolClass.teacher_id == me.id)).all())
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
        at = event.at.astimezone(timezone.utc).replace(tzinfo=None) if event.at.tzinfo else event.at
        db.add(ProgressEvent(**event.model_dump(exclude={"at"}), at=at, bench_id=body.bench_id, received_at=received))
        known.add(event.event_id)
        acked.append(event.event_id)
        inserted += 1
    db.commit()
    return {"acked": acked, "rejected": rejected, "inserted": inserted}
