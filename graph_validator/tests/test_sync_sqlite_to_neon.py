"""tools/sync_sqlite_to_neon.py: non-destructive, idempotent copy of local teachers into another database."""
import importlib.util
from datetime import datetime
from pathlib import Path

from sqlalchemy import create_engine, func, select

from graph_validator.service.security import hash_password, verify_password
from graph_validator.service.storage import (
    Base, ClassModule, Module, ModuleLesson, ProgressEvent, SavedLesson, SchoolClass, Student, Teacher,
)

TOOL = Path(__file__).resolve().parents[1] / "tools" / "sync_sqlite_to_neon.py"
spec = importlib.util.spec_from_file_location("sync_sqlite_to_neon", TOOL)
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)

NOW = datetime(2026, 11, 4, 12, 0, 0)


def fresh(path: Path):
    engine = create_engine(f"sqlite:///{path}")
    Base.metadata.create_all(engine)
    return engine


def seed_source(path: Path) -> None:
    with fresh(path).begin() as db:
        db.execute(Teacher.__table__.insert(), [
            {"id": 1, "email": "professor@tedtronics.local", "name": "Demo", "password_hash": "", "created_at": None},
            {"id": 4, "email": "Teacher@TedTronics.com", "name": "Professor",
             "password_hash": hash_password("segredo1"), "created_at": NOW},
        ])
        doc = {"id": "curriculo-01-guiada-p4", "title": "Luz", "steps": []}
        db.execute(SavedLesson.__table__.insert(), [
            {"id": "curriculo-01-guiada-p4", "teacher_id": 4, "title": "Luz", "document": doc, "updated_at": NOW},
            {"id": "lesson-abc", "teacher_id": 4, "title": "Minha", "document": {"id": "lesson-abc"}, "updated_at": NOW},
        ])
        db.execute(Module.__table__.insert(), [{"id": 9, "teacher_id": 4, "title": "Módulo 1", "description": "",
                                                "updated_at": NOW}])
        db.execute(ModuleLesson.__table__.insert(), [
            {"module_id": 9, "lesson_id": "curriculo-01-guiada-p4", "position": 0},
            {"module_id": 9, "lesson_id": "lesson-abc", "position": 1},
        ])
        db.execute(SchoolClass.__table__.insert(), [{"id": 4, "teacher_id": 4, "name": "6A", "description": ""}])
        db.execute(ClassModule.__table__.insert(), [{"class_id": 4, "module_id": 9, "position": 0}])
        db.execute(Student.__table__.insert(), [
            {"id": 5, "class_id": 4, "name": "Ana", "nickname": "ana", "active": True},
            {"id": 6, "class_id": 4, "name": "Bia", "nickname": "bia", "active": True},
        ])
        db.execute(ProgressEvent.__table__.insert(), [
            {"event_id": "ev-1", "student_id": 5, "nfc_code": "5", "lesson_id": "curriculo-01-guiada-p4",
             "module_id": 9, "lesson_version": None, "kind": "lesson_done", "step_idx": 0, "score": 100,
             "duration_s": 3.0, "seq": 1, "at": NOW, "bench_id": "b1", "received_at": NOW},
        ])


def seed_target(path: Path) -> None:
    with fresh(path).begin() as db:
        db.execute(Teacher.__table__.insert(), [
            {"id": 1, "email": "professor@tedtronics.local", "name": "Demo no Neon", "password_hash": "x",
             "created_at": None},
            {"id": 2, "email": "outra@escola.br", "name": "Outra", "password_hash": "y", "created_at": None},
        ])
        db.execute(SchoolClass.__table__.insert(), [{"id": 1, "teacher_id": 2, "name": "T", "description": ""}])
        db.execute(Student.__table__.insert(), [{"id": 1, "class_id": 1, "name": "Zé", "nickname": "ze",
                                                 "active": True}])


def counts(path: Path) -> dict[str, int]:
    with create_engine(f"sqlite:///{path}").connect() as db:
        return {t.name: db.scalar(select(func.count()).select_from(t)) for t in Base.metadata.sorted_tables}


def test_dry_run_writes_nothing_and_apply_is_idempotent(tmp_path, capsys):
    src, dst = tmp_path / "local.sqlite3", tmp_path / "neon.sqlite3"
    seed_source(src)
    seed_target(dst)
    before = counts(dst)
    args = ["--sqlite", str(src), "--target", f"sqlite:///{dst}"]

    assert sync.main(args) == 0
    assert counts(dst) == before
    out = capsys.readouterr().out
    assert "Simulação" in out and "teacher@tedtronics.com: criado" in out
    assert "professor@tedtronics.local: JÁ EXISTE" in out

    assert sync.main([*args, "--apply"]) == 0
    capsys.readouterr()
    engine = create_engine(f"sqlite:///{dst}")
    with engine.connect() as db:
        teacher = db.execute(select(Teacher.__table__).where(Teacher.email == "teacher@tedtronics.com")).one()
        assert verify_password("segredo1", teacher.password_hash)
        demo = db.execute(select(Teacher.__table__).where(Teacher.email == "professor@tedtronics.local")).one()
        assert demo.name == "Demo no Neon"  # existing teacher left alone
        lesson_ids = set(db.scalars(select(SavedLesson.id).where(SavedLesson.teacher_id == teacher.id)))
        assert lesson_ids == {f"curriculo-01-guiada-p{teacher.id}", "lesson-abc"}
        doc = db.scalar(select(SavedLesson.document).where(SavedLesson.id == f"curriculo-01-guiada-p{teacher.id}"))
        assert doc["id"] == f"curriculo-01-guiada-p{teacher.id}"
        module = db.execute(select(Module.__table__).where(Module.teacher_id == teacher.id)).one()
        links = db.scalars(select(ModuleLesson.lesson_id).where(ModuleLesson.module_id == module.id)
                           .order_by(ModuleLesson.position)).all()
        assert links == [f"curriculo-01-guiada-p{teacher.id}", "lesson-abc"]
        klass = db.execute(select(SchoolClass.__table__).where(SchoolClass.teacher_id == teacher.id)).one()
        assert db.scalar(select(ClassModule.module_id).where(ClassModule.class_id == klass.id)) == module.id
        ids = dict(db.execute(select(Student.nickname, Student.id).where(Student.class_id == klass.id)).all())
        assert set(ids) == {"ana", "bia"} and ids["ana"] != 5  # the copy gets new ids in the target
        event = db.execute(select(ProgressEvent.__table__).where(ProgressEvent.event_id == "ev-1")).one()
        assert event.module_id == module.id and event.lesson_id == f"curriculo-01-guiada-p{teacher.id}"
        # the event's uid (stored in the legacy nfc_code column) follows the student's new id
        assert event.student_id == ids["ana"] and event.nfc_code == str(ids["ana"])

    after = counts(dst)
    assert sync.main([*args, "--apply"]) == 0
    assert counts(dst) == after  # second run adds nothing
    assert "teacher@tedtronics.com: JÁ EXISTE" in capsys.readouterr().out


def test_into_existing_adds_only_missing_items_and_email_filter(tmp_path, capsys):
    src, dst = tmp_path / "local.sqlite3", tmp_path / "neon.sqlite3"
    seed_source(src)
    seed_target(dst)
    with create_engine(f"sqlite:///{dst}").begin() as db:
        db.execute(Teacher.__table__.insert(), [{"id": 7, "email": "teacher@tedtronics.com", "name": "No Neon",
                                                 "password_hash": hash_password("outra123"), "created_at": NOW}])
        db.execute(Module.__table__.insert(), [{"id": 3, "teacher_id": 7, "title": "Módulo 1", "description": "",
                                                "updated_at": NOW}])
    args = ["--sqlite", str(src), "--target", f"sqlite:///{dst}", "--email", "TEACHER@tedtronics.com"]
    assert sync.main([*args, "--into-existing", "--apply"]) == 0
    out = capsys.readouterr().out
    assert "professor@tedtronics.local" not in out
    with create_engine(f"sqlite:///{dst}").connect() as db:
        teacher = db.execute(select(Teacher.__table__).where(Teacher.id == 7)).one()
        assert teacher.name == "No Neon" and verify_password("outra123", teacher.password_hash)
        assert db.scalar(select(func.count()).select_from(Module).where(Module.teacher_id == 7)) == 1
        assert db.scalar(select(func.count()).select_from(SavedLesson).where(SavedLesson.teacher_id == 7)) == 2


def test_without_target_explains_env_local(tmp_path, monkeypatch, capsys):
    monkeypatch.delenv("TEDTRONICS_DATABASE_URL", raising=False)
    monkeypatch.setattr(sync, "REPO", tmp_path)
    assert sync.main(["--sqlite", str(tmp_path / "x.sqlite3")]) == 2
    assert ".env.local" in capsys.readouterr().err
