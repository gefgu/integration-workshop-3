"""Teacher workspace API: lessons, modules, classes, students and their NFC tags.

Every query is scoped to the signed-in teacher (SFR28), so another teacher's rows answer 404.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..tts import lesson_audio, lesson_phrases
from . import tts
from .auth import Me
from .storage import (
    ClassLesson, ClassModule, Module, ModuleLesson, SavedLesson, SchoolClass, Student, TagLinkEvent, Teacher,
    get_session,
)

router = APIRouter(prefix="/workspace")
Db = Annotated[Session, Depends(get_session)]


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def required(message: str):
    def check(value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError(message)
        return value
    return check


class ClassInput(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = ""

    @field_validator("name")
    @classmethod
    def name_required(cls, value: str) -> str:
        return required("Informe o nome da turma")(value)


class StudentInput(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    nickname: str = Field(min_length=1, max_length=255)
    nfc_code: str | None = Field(default=None, max_length=255)
    active: bool = True
    class_id: int | None = None  # set to move the student to another of the teacher's classes

    @field_validator("name", "nickname")
    @classmethod
    def required_text(cls, value: str) -> str:
        return required("Este campo é obrigatório")(value)

    @field_validator("nfc_code")
    @classmethod
    def blank_nfc_is_null(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None


class TagInput(BaseModel):
    nfc_code: str = Field(min_length=1, max_length=255)

    @field_validator("nfc_code")
    @classmethod
    def code_required(cls, value: str) -> str:
        return required("Informe o código da tag")(value)


class StepInput(BaseModel):
    """Only the fields the bench and the validator rely on are checked; the rest is kept as is."""
    model_config = {"extra": "allow"}
    id: str = Field(min_length=1)
    action: str


class QuizOption(BaseModel):
    model_config = {"extra": "allow"}
    id: str
    text: str


class QuizInput(BaseModel):
    model_config = {"extra": "allow"}
    id: str
    prompt: str
    options: list[QuizOption]
    correctId: str | None = None


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
    # v4: preassembled/faulty start bench, per-lesson behaviour, notes and labels for teachers.
    start: dict[str, Any] | None = None
    settings: dict[str, Any] | None = None
    teacherNotes: str | None = None
    tags: list[str] | None = None

    @field_validator("title")
    @classmethod
    def title_required(cls, value: str) -> str:
        return required("Informe o título da lição")(value)

    @field_validator("kind")
    @classmethod
    def known_kind(cls, value: str) -> str:
        if value not in ("guided", "challenge"):
            raise ValueError("O tipo da lição deve ser 'guided' ou 'challenge'")
        return value

    @field_validator("steps")
    @classmethod
    def steps_shape(cls, value: list[dict[str, Any]]) -> list[dict[str, Any]]:
        for step in value:
            StepInput.model_validate(step)
        return value

    @field_validator("quizzes")
    @classmethod
    def quizzes_shape(cls, value: list[dict[str, Any]]) -> list[dict[str, Any]]:
        for quiz in value:
            QuizInput.model_validate(quiz)
        return value


class LessonOrder(BaseModel):
    lesson_ids: list[str]


class ModuleInput(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    lesson_ids: list[str] | None = None

    @field_validator("title")
    @classmethod
    def title_required(cls, value: str) -> str:
        return required("Informe o título do módulo")(value)


class ModuleOrder(BaseModel):
    module_ids: list[int]


def own_class(db: Session, me: Teacher, class_id: int) -> SchoolClass:
    result = db.scalar(select(SchoolClass).where(SchoolClass.id == class_id, SchoolClass.teacher_id == me.id))
    if result is None:
        raise HTTPException(404, "Turma não encontrada.")
    return result


def own_lesson(db: Session, me: Teacher, lesson_id: str) -> SavedLesson:
    result = db.scalar(select(SavedLesson).where(SavedLesson.id == lesson_id, SavedLesson.teacher_id == me.id))
    if result is None:
        raise HTTPException(404, "Lição não encontrada.")
    return result


def own_student(db: Session, me: Teacher, student_id: int) -> Student:
    result = db.scalar(select(Student).join(SchoolClass).where(Student.id == student_id, SchoolClass.teacher_id == me.id))
    if result is None:
        raise HTTPException(404, "Aluno não encontrado.")
    return result


def own_module(db: Session, me: Teacher, module_id: int) -> Module:
    result = db.scalar(select(Module).where(Module.id == module_id, Module.teacher_id == me.id))
    if result is None:
        raise HTTPException(404, "Módulo não encontrado.")
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


def module_out(item: Module) -> dict[str, Any]:
    return {"id": item.id, "title": item.title, "description": item.description,
            "lesson_ids": [link.lesson_id for link in item.lessons],
            "class_ids": sorted(link.class_id for link in item.classes),
            "updated_at": item.updated_at.isoformat() + "Z"}


def log_tag(db: Session, me: Teacher, student: Student, code: str, action: str) -> None:
    db.add(TagLinkEvent(teacher_id=me.id, student_id=student.id, student_name=student.name, nfc_code=code,
                        action=action, at=utcnow()))


def tag_in_use(db: Session, code: str, student_id: int | None) -> bool:
    other = db.scalar(select(Student).where(Student.nfc_code == code))
    return other is not None and other.id != student_id


# Lessons ------------------------------------------------------------------------------------------

@router.get("/lessons")
def list_lessons(db: Db, me: Me) -> list[dict]:
    lessons = db.scalars(select(SavedLesson).where(SavedLesson.teacher_id == me.id)
                         .order_by(SavedLesson.updated_at.desc())).all()
    return [item.document for item in lessons]


@router.post("/lessons", status_code=201)
def create_lesson(body: LessonInput, db: Db, me: Me) -> dict:
    if db.get(SavedLesson, body.id):
        raise HTTPException(409, "Já existe uma lição com este ID.")
    return save_lesson(body.id, body, db, me)


@router.put("/lessons/{lesson_id}")
def save_lesson(lesson_id: str, body: LessonInput, db: Db, me: Me) -> dict:
    if body.id != lesson_id:
        raise HTTPException(422, "O ID da URL deve ser igual ao ID da lição.")
    item = db.get(SavedLesson, lesson_id)
    if item and item.teacher_id != me.id:
        raise HTTPException(404, "Lição não encontrada.")
    if item is None:
        item = SavedLesson(id=lesson_id, teacher_id=me.id)
        db.add(item)
    updated = datetime.now(timezone.utc)
    document = body.model_dump()
    for optional in ("start", "settings", "teacherNotes", "tags"):  # absent, not null, on older lessons
        if document.get(optional) is None:
            document.pop(optional, None)
    document["updatedAt"] = updated.isoformat()
    document["audio"] = speak(document)
    item.title = body.title
    item.document = document
    item.updated_at = updated.replace(tzinfo=None)
    commit(db)
    return document


def speak(document: dict[str, Any]) -> dict[str, Any]:
    """Tutor audio for everything the teacher wrote; the save never fails because of it."""
    synth = tts.synthesizer()
    if synth is None:
        return {"voice": None, "status": "unavailable", "detail": "TTS desligado.", "phrases": {}}
    return lesson_audio(lesson_phrases(document), synth)


@router.get("/lessons/{lesson_id}/export.zip")
def export_lesson(lesson_id: str, db: Db, me: Me) -> Response:
    """lesson.json plus audio/<hash>.mp3 for each of its phrases, for the workbench (Raspberry Pi)."""
    document = own_lesson(db, me, lesson_id).document
    phrases = (document.get("audio") or {}).get("phrases") or {}
    return tts.zip_response(f"licao-{lesson_id}", "lesson.json", document, {f: f for f in phrases.values()})


@router.delete("/lessons/{lesson_id}", status_code=204)
def delete_lesson(lesson_id: str, db: Db, me: Me) -> None:
    item = own_lesson(db, me, lesson_id)
    if db.scalar(select(ClassLesson).where(ClassLesson.lesson_id == lesson_id)):
        raise HTTPException(409, "Remova esta lição das turmas antes de excluí-la.")
    if db.scalar(select(ModuleLesson).where(ModuleLesson.lesson_id == lesson_id)):
        raise HTTPException(409, "Remova esta lição dos módulos antes de excluí-la.")
    db.delete(item)
    commit(db)


# Modules ------------------------------------------------------------------------------------------

def set_lessons(db: Session, me: Teacher, module: Module, lesson_ids: list[str]) -> None:
    if len(set(lesson_ids)) != len(lesson_ids):
        raise HTTPException(422, "Uma lição aparece mais de uma vez no módulo.")
    for lesson_id in lesson_ids:
        own_lesson(db, me, lesson_id)
    module.lessons.clear()
    db.flush()
    module.lessons.extend(ModuleLesson(lesson_id=lesson_id, position=position)
                          for position, lesson_id in enumerate(lesson_ids))
    module.updated_at = utcnow()


@router.get("/modules")
def list_modules(db: Db, me: Me) -> list[dict]:
    items = db.scalars(select(Module).where(Module.teacher_id == me.id).order_by(Module.title)).all()
    return [module_out(item) for item in items]


@router.post("/modules", status_code=201)
def create_module(body: ModuleInput, db: Db, me: Me) -> dict:
    item = Module(teacher_id=me.id, title=body.title, description=body.description.strip(), updated_at=utcnow())
    db.add(item)
    db.flush()
    set_lessons(db, me, item, body.lesson_ids or [])
    commit(db)
    db.refresh(item)
    return module_out(item)


@router.get("/modules/{module_id}")
def get_module(module_id: int, db: Db, me: Me) -> dict:
    return module_out(own_module(db, me, module_id))


@router.put("/modules/{module_id}")
def update_module(module_id: int, body: ModuleInput, db: Db, me: Me) -> dict:
    item = own_module(db, me, module_id)
    item.title = body.title
    item.description = body.description.strip()
    item.updated_at = utcnow()
    if body.lesson_ids is not None:
        set_lessons(db, me, item, body.lesson_ids)
    commit(db)
    db.refresh(item)
    return module_out(item)


@router.put("/modules/{module_id}/lessons")
def set_module_lessons(module_id: int, body: LessonOrder, db: Db, me: Me) -> dict:
    item = own_module(db, me, module_id)
    set_lessons(db, me, item, body.lesson_ids)
    commit(db)
    db.refresh(item)
    return module_out(item)


@router.delete("/modules/{module_id}", status_code=204)
def delete_module(module_id: int, db: Db, me: Me) -> None:
    db.delete(own_module(db, me, module_id))
    commit(db)


# Classes ------------------------------------------------------------------------------------------

@router.get("/classes")
def list_classes(db: Db, me: Me) -> list[dict]:
    items = db.scalars(select(SchoolClass).where(SchoolClass.teacher_id == me.id).order_by(SchoolClass.name)).all()
    return [{**class_out(item), "student_count": len(item.students)} for item in items]


@router.post("/classes", status_code=201)
def create_class(body: ClassInput, db: Db, me: Me) -> dict:
    item = SchoolClass(teacher_id=me.id, name=body.name, description=body.description.strip())
    db.add(item)
    commit(db)
    db.refresh(item)
    return class_out(item)


@router.get("/classes/{class_id}")
def get_class(class_id: int, db: Db, me: Me) -> dict:
    item = own_class(db, me, class_id)
    students = db.scalars(select(Student).where(Student.class_id == class_id).order_by(Student.name)).all()
    assignments = db.scalars(select(ClassLesson).where(ClassLesson.class_id == class_id)
                             .order_by(ClassLesson.position)).all()
    modules = db.scalars(select(ClassModule).where(ClassModule.class_id == class_id)
                         .order_by(ClassModule.position)).all()
    return {**class_out(item), "students": [student_out(s) for s in students],
            "lesson_ids": [a.lesson_id for a in assignments], "module_ids": [m.module_id for m in modules]}


@router.put("/classes/{class_id}")
def update_class(class_id: int, body: ClassInput, db: Db, me: Me) -> dict:
    item = own_class(db, me, class_id)
    item.name = body.name
    item.description = body.description.strip()
    commit(db)
    return class_out(item)


@router.delete("/classes/{class_id}", status_code=204)
def delete_class(class_id: int, db: Db, me: Me) -> None:
    db.delete(own_class(db, me, class_id))
    commit(db)


@router.put("/classes/{class_id}/lessons")
def set_class_lessons(class_id: int, body: LessonOrder, db: Db, me: Me) -> dict:
    own_class(db, me, class_id)
    if len(set(body.lesson_ids)) != len(body.lesson_ids):
        raise HTTPException(422, "Uma lição aparece mais de uma vez na turma.")
    for lesson_id in body.lesson_ids:
        own_lesson(db, me, lesson_id)
    for assignment in db.scalars(select(ClassLesson).where(ClassLesson.class_id == class_id)).all():
        db.delete(assignment)
    db.flush()
    db.add_all(ClassLesson(class_id=class_id, lesson_id=lesson_id, position=position)
               for position, lesson_id in enumerate(body.lesson_ids))
    commit(db)
    return {"lesson_ids": body.lesson_ids}


@router.put("/classes/{class_id}/modules")
def set_class_modules(class_id: int, body: ModuleOrder, db: Db, me: Me) -> dict:
    own_class(db, me, class_id)
    if len(set(body.module_ids)) != len(body.module_ids):
        raise HTTPException(422, "Um módulo aparece mais de uma vez na turma.")
    for module_id in body.module_ids:
        own_module(db, me, module_id)
    for link in db.scalars(select(ClassModule).where(ClassModule.class_id == class_id)).all():
        db.delete(link)
    db.flush()
    db.add_all(ClassModule(class_id=class_id, module_id=module_id, position=position)
               for position, module_id in enumerate(body.module_ids))
    commit(db)
    return {"module_ids": body.module_ids}


# Students and NFC tags ----------------------------------------------------------------------------

@router.get("/students")
def list_students(db: Db, me: Me, class_id: int | None = None) -> list[dict]:
    query = (select(Student, SchoolClass.name).join(SchoolClass).where(SchoolClass.teacher_id == me.id)
             .order_by(Student.name))
    if class_id is not None:
        query = query.where(Student.class_id == class_id)
    return [{**student_out(student), "class_name": name} for student, name in db.execute(query).all()]


@router.post("/classes/{class_id}/students", status_code=201)
def create_student(class_id: int, body: StudentInput, db: Db, me: Me) -> dict:
    own_class(db, me, class_id)
    if body.nfc_code and tag_in_use(db, body.nfc_code, None):
        raise HTTPException(409, "Esta tag já está vinculada a outro aluno.")
    item = Student(class_id=class_id, **body.model_dump(exclude={"class_id"}))
    db.add(item)
    try:
        db.flush()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, "Já existe um registro com este apelido ou código NFC.") from error
    if item.nfc_code:
        log_tag(db, me, item, item.nfc_code, "link")
    commit(db)
    db.refresh(item)
    return student_out(item)


@router.put("/students/{student_id}")
def update_student(student_id: int, body: StudentInput, db: Db, me: Me) -> dict:
    item = own_student(db, me, student_id)
    if body.class_id is not None and body.class_id != item.class_id:
        own_class(db, me, body.class_id)
        item.class_id = body.class_id
    if body.nfc_code != item.nfc_code:
        if body.nfc_code and tag_in_use(db, body.nfc_code, item.id):
            raise HTTPException(409, "Esta tag já está vinculada a outro aluno.")
        if item.nfc_code:
            log_tag(db, me, item, item.nfc_code, "unlink")
        if body.nfc_code:
            log_tag(db, me, item, body.nfc_code, "link")
    for name, value in body.model_dump(exclude={"class_id"}).items():
        setattr(item, name, value)
    commit(db)
    return student_out(item)


@router.delete("/students/{student_id}", status_code=204)
def delete_student(student_id: int, db: Db, me: Me) -> None:
    db.delete(own_student(db, me, student_id))
    commit(db)


@router.post("/students/{student_id}/tag")
def link_tag(student_id: int, body: TagInput, db: Db, me: Me) -> dict:
    """Links a fresh tag (SFR30.1, SFR33). The student's history stays tied to the student, not the tag."""
    item = own_student(db, me, student_id)
    if item.nfc_code:
        raise HTTPException(409, "Desvincule a tag atual antes de vincular outra.")
    if tag_in_use(db, body.nfc_code, item.id):
        raise HTTPException(409, "Esta tag já está vinculada a outro aluno.")
    item.nfc_code = body.nfc_code
    log_tag(db, me, item, body.nfc_code, "link")
    commit(db)
    return student_out(item)


@router.delete("/students/{student_id}/tag")
def unlink_tag(student_id: int, db: Db, me: Me) -> dict:
    """Unlinks the tag without touching progress (SFR32, SAR3) and logs it (SFR34)."""
    item = own_student(db, me, student_id)
    if not item.nfc_code:
        raise HTTPException(409, "Este aluno não tem tag vinculada.")
    log_tag(db, me, item, item.nfc_code, "unlink")
    item.nfc_code = None
    commit(db)
    return student_out(item)


@router.get("/students/{student_id}/tag-history")
def tag_history(student_id: int, db: Db, me: Me) -> list[dict]:
    own_student(db, me, student_id)
    events = db.scalars(select(TagLinkEvent).where(TagLinkEvent.student_id == student_id,
                                                   TagLinkEvent.teacher_id == me.id)
                        .order_by(TagLinkEvent.at.desc(), TagLinkEvent.id.desc())).all()
    return [{"nfc_code": e.nfc_code, "action": e.action, "at": e.at.isoformat() + "Z"} for e in events]
