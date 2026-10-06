"""Teacher workspace API. Authentication is intentionally a seeded demo teacher."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .storage import ClassLesson, SavedLesson, SchoolClass, Student, get_session

router = APIRouter(prefix="/workspace")
Db = Annotated[Session, Depends(get_session)]
DEMO_TEACHER_ID = 1


class ClassInput(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = ""

    @field_validator("name")
    @classmethod
    def name_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Informe o nome da turma")
        return value


class StudentInput(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    nickname: str = Field(min_length=1, max_length=255)
    nfc_code: str | None = Field(default=None, max_length=255)
    active: bool = True

    @field_validator("name", "nickname")
    @classmethod
    def required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Este campo é obrigatório")
        return value

    @field_validator("nfc_code")
    @classmethod
    def blank_nfc_is_null(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None


class LessonInput(BaseModel):
    version: int
    id: str = Field(min_length=1, max_length=128)
    title: str = Field(min_length=1, max_length=255)
    instruction: str
    kind: str
    board: dict[str, Any]
    steps: list[dict[str, Any]]
    quizzes: list[dict[str, Any]]
    timeLimitS: int | None = None
    updatedAt: str | None = None

    @field_validator("title")
    @classmethod
    def title_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Informe o título da lição")
        return value


class LessonOrder(BaseModel):
    lesson_ids: list[str]


def own_class(db: Session, class_id: int) -> SchoolClass:
    result = db.scalar(select(SchoolClass).where(SchoolClass.id == class_id, SchoolClass.teacher_id == DEMO_TEACHER_ID))
    if result is None:
        raise HTTPException(404, "Turma não encontrada.")
    return result


def own_lesson(db: Session, lesson_id: str) -> SavedLesson:
    result = db.scalar(select(SavedLesson).where(SavedLesson.id == lesson_id, SavedLesson.teacher_id == DEMO_TEACHER_ID))
    if result is None:
        raise HTTPException(404, "Lição não encontrada.")
    return result


def own_student(db: Session, student_id: int) -> Student:
    result = db.scalar(select(Student).join(SchoolClass).where(Student.id == student_id, SchoolClass.teacher_id == DEMO_TEACHER_ID))
    if result is None:
        raise HTTPException(404, "Aluno não encontrado.")
    return result


def commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, "Já existe um registro com este apelido ou código NFC.") from error


def class_out(item: SchoolClass) -> dict[str, Any]:
    return {"id": item.id, "name": item.name, "description": item.description}


def student_out(item: Student) -> dict[str, Any]:
    return {"id": item.id, "class_id": item.class_id, "name": item.name, "nickname": item.nickname,
            "nfc_code": item.nfc_code, "active": item.active}


@router.get("/lessons")
def list_lessons(db: Db) -> list[dict]:
    lessons = db.scalars(select(SavedLesson).where(SavedLesson.teacher_id == DEMO_TEACHER_ID)
                         .order_by(SavedLesson.updated_at.desc())).all()
    return [item.document for item in lessons]


@router.post("/lessons", status_code=201)
def create_lesson(body: LessonInput, db: Db) -> dict:
    if db.get(SavedLesson, body.id):
        raise HTTPException(409, "Já existe uma lição com este ID.")
    return save_lesson(body.id, body, db)


@router.put("/lessons/{lesson_id}")
def save_lesson(lesson_id: str, body: LessonInput, db: Db) -> dict:
    if body.id != lesson_id:
        raise HTTPException(422, "O ID da URL deve ser igual ao ID da lição.")
    item = db.get(SavedLesson, lesson_id)
    if item and item.teacher_id != DEMO_TEACHER_ID:
        raise HTTPException(404, "Lição não encontrada.")
    if item is None:
        item = SavedLesson(id=lesson_id, teacher_id=DEMO_TEACHER_ID)
        db.add(item)
    updated = datetime.now(timezone.utc)
    document = body.model_dump()
    document["updatedAt"] = updated.isoformat()
    item.title = body.title
    item.document = document
    item.updated_at = updated.replace(tzinfo=None)
    commit(db)
    return document


@router.delete("/lessons/{lesson_id}", status_code=204)
def delete_lesson(lesson_id: str, db: Db) -> None:
    item = own_lesson(db, lesson_id)
    if db.scalar(select(ClassLesson).where(ClassLesson.lesson_id == lesson_id)):
        raise HTTPException(409, "Remova esta lição das turmas antes de excluí-la.")
    db.delete(item)
    commit(db)


@router.get("/classes")
def list_classes(db: Db) -> list[dict]:
    items = db.scalars(select(SchoolClass).where(SchoolClass.teacher_id == DEMO_TEACHER_ID)
                       .order_by(SchoolClass.name)).all()
    return [class_out(item) for item in items]


@router.post("/classes", status_code=201)
def create_class(body: ClassInput, db: Db) -> dict:
    item = SchoolClass(teacher_id=DEMO_TEACHER_ID, name=body.name, description=body.description.strip())
    db.add(item)
    commit(db)
    db.refresh(item)
    return class_out(item)


@router.get("/classes/{class_id}")
def get_class(class_id: int, db: Db) -> dict:
    item = own_class(db, class_id)
    students = db.scalars(select(Student).where(Student.class_id == class_id).order_by(Student.name)).all()
    assignments = db.scalars(select(ClassLesson).where(ClassLesson.class_id == class_id)
                             .order_by(ClassLesson.position)).all()
    return {**class_out(item), "students": [student_out(s) for s in students],
            "lesson_ids": [a.lesson_id for a in assignments]}


@router.put("/classes/{class_id}")
def update_class(class_id: int, body: ClassInput, db: Db) -> dict:
    item = own_class(db, class_id)
    item.name = body.name
    item.description = body.description.strip()
    commit(db)
    return class_out(item)


@router.delete("/classes/{class_id}", status_code=204)
def delete_class(class_id: int, db: Db) -> None:
    db.delete(own_class(db, class_id))
    commit(db)


@router.put("/classes/{class_id}/lessons")
def set_class_lessons(class_id: int, body: LessonOrder, db: Db) -> dict:
    own_class(db, class_id)
    if len(set(body.lesson_ids)) != len(body.lesson_ids):
        raise HTTPException(422, "Uma lição aparece mais de uma vez na turma.")
    for lesson_id in body.lesson_ids:
        own_lesson(db, lesson_id)
    for assignment in db.scalars(select(ClassLesson).where(ClassLesson.class_id == class_id)).all():
        db.delete(assignment)
    db.flush()
    db.add_all(ClassLesson(class_id=class_id, lesson_id=lesson_id, position=position)
               for position, lesson_id in enumerate(body.lesson_ids))
    commit(db)
    return {"lesson_ids": body.lesson_ids}


@router.post("/classes/{class_id}/students", status_code=201)
def create_student(class_id: int, body: StudentInput, db: Db) -> dict:
    own_class(db, class_id)
    item = Student(class_id=class_id, **body.model_dump())
    db.add(item)
    commit(db)
    db.refresh(item)
    return student_out(item)


@router.put("/students/{student_id}")
def update_student(student_id: int, body: StudentInput, db: Db) -> dict:
    item = own_student(db, student_id)
    for name, value in body.model_dump().items():
        setattr(item, name, value)
    commit(db)
    return student_out(item)


@router.delete("/students/{student_id}", status_code=204)
def delete_student(student_id: int, db: Db) -> None:
    db.delete(own_student(db, student_id))
    commit(db)
