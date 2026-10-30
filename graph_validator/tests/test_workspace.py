"""Teacher workspace persistence and assignment rules using an isolated SQL database."""
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from graph_validator.service.storage import Base, Teacher
from graph_validator.service.workspace import (
    ClassInput, LessonInput, LessonOrder, StudentInput, create_class, create_student,
    delete_class, delete_lesson, get_class, list_lessons, save_lesson,
    set_class_lessons, update_student,
)


def lesson(id_):
    return LessonInput.model_validate({
        "version": 3, "id": id_, "title": f"Lesson {id_}", "instruction": "Build it",
        "kind": "guided", "board": {"cols": 11, "rows": 6, "pieces": []},
        "steps": [], "quizzes": [], "timeLimitS": None,
    })


def test_workspace_crud_and_assignments(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'workspace.db'}")
    Base.metadata.create_all(engine)
    try:
        with Session(engine) as db:
            me = Teacher(id=1, email="teacher@example.test", name="Demo")
            db.add(me)
            db.commit()
            first = create_class(ClassInput(name="7A", description="Morning"), db, me)
            second = create_class(ClassInput(name="7B", description="Afternoon"), db, me)
            student = StudentInput(name="Ana", nickname="ana", nfc_code="NFC-1", active=True)
            created = create_student(first["id"], student, db, me)
            assert isinstance(created["id"], int)
            with pytest.raises(HTTPException) as duplicate:
                create_student(first["id"], student, db, me)
            assert duplicate.value.status_code == 409
            with pytest.raises(HTTPException) as duplicate_nfc:
                create_student(second["id"], student, db, me)
            assert duplicate_nfc.value.status_code == 409

            for id_ in ("a", "b"):
                assert save_lesson(id_, lesson(id_), db, me)["id"] == id_
            assert len(list_lessons(db, me)) == 2
            set_class_lessons(first["id"], LessonOrder(lesson_ids=["a", "b"]), db, me)
            set_class_lessons(second["id"], LessonOrder(lesson_ids=["a"]), db, me)
            set_class_lessons(first["id"], LessonOrder(lesson_ids=["b", "a"]), db, me)
            assert get_class(first["id"], db, me)["lesson_ids"] == ["b", "a"]

            with pytest.raises(HTTPException) as assigned:
                delete_lesson("a", db, me)
            assert assigned.value.status_code == 409
            with pytest.raises(HTTPException) as duplicate_order:
                set_class_lessons(first["id"], LessonOrder(lesson_ids=["b", "b"]), db, me)
            assert duplicate_order.value.status_code == 422
            with pytest.raises(HTTPException) as missing_lesson:
                set_class_lessons(first["id"], LessonOrder(lesson_ids=["missing"]), db, me)
            assert missing_lesson.value.status_code == 404
            assert get_class(first["id"], db, me)["lesson_ids"] == ["b", "a"]

            inactive = student.model_copy(update={"active": False})
            assert update_student(created["id"], inactive, db, me)["active"] is False
            delete_class(first["id"], db, me)
            with pytest.raises(HTTPException) as missing_class:
                get_class(first["id"], db, me)
            assert missing_class.value.status_code == 404
            delete_class(second["id"], db, me)
            delete_lesson("a", db, me)
    finally:
        engine.dispose()


def test_v4_fields_are_kept_and_older_lessons_stay_clean(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'v4.db'}")
    Base.metadata.create_all(engine)
    try:
        with Session(engine) as db:
            me = Teacher(id=1, email="teacher@example.test", name="Demo")
            db.add(me)
            db.commit()
            plain = save_lesson("plain", lesson("plain"), db, me)
            assert not {"start", "settings", "teacherNotes", "tags"} & plain.keys()
            rich = lesson("rich").model_copy(update={
                "version": 4,
                "start": {"pieces": [], "removeOneOf": ["w1"]},
                "settings": {"requireLit": True, "hintAfter": 2},
                "teacherNotes": "Objetivo: ...",
                "tags": ["exemplo"],
                "steps": [{"id": "s1", "action": "experiment", "title": "Lab",
                           "experiment": {"goals": [{"id": "g", "label": "Veja", "seen": ["lit"]}]}}],
            })
            saved = save_lesson("rich", rich, db, me)
            assert saved["settings"] == {"requireLit": True, "hintAfter": 2}
            assert saved["start"]["removeOneOf"] == ["w1"]
            assert saved["tags"] == ["exemplo"] and saved["teacherNotes"].startswith("Objetivo")
            assert saved["steps"][0]["experiment"]["goals"][0]["seen"] == ["lit"]
            assert [d["id"] for d in list_lessons(db, me)] == ["rich", "plain"]
    finally:
        engine.dispose()
