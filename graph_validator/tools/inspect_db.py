"""Read-only summary of a TedTronics database: row counts, teachers and the curriculum lessons.

Usage: TEDTRONICS_DATABASE_URL=<url> python graph_validator/tools/inspect_db.py [--lessons]

Never writes. Prints no credentials and no password hashes.
"""
import sys

from sqlalchemy import func, select

from graph_validator.service.storage import (
    Base, ClassModule, Module, ModuleLesson, ProgressEvent, SavedLesson, SchoolClass, Student, Teacher, database_url,
    get_engine,
)


def main(show_lessons: bool) -> None:
    engine = get_engine()
    host = engine.url.host or "local file"
    print(f"database: {engine.dialect.name} @ {host}")
    from sqlalchemy.orm import Session
    with Session(engine) as db:
        for table in Base.metadata.sorted_tables:
            count = db.scalar(select(func.count()).select_from(table))
            print(f"  {table.name:<18}{count}")
        print("teachers:")
        for t in db.scalars(select(Teacher).order_by(Teacher.id)):
            lessons = db.scalar(select(func.count()).select_from(SavedLesson).where(SavedLesson.teacher_id == t.id))
            mods = db.scalar(select(func.count()).select_from(Module).where(Module.teacher_id == t.id))
            classes = db.scalar(select(func.count()).select_from(SchoolClass).where(SchoolClass.teacher_id == t.id))
            print(f"  #{t.id} {t.email} ({t.name}) lessons={lessons} modules={mods} classes={classes} "
                  f"password={'set' if t.password_hash else 'none'}")
        if show_lessons:
            print("lessons:")
            for item in db.scalars(select(SavedLesson).order_by(SavedLesson.teacher_id, SavedLesson.id)):
                d = item.document
                print(f"  t{item.teacher_id} {item.id} v{d.get('version')} {d.get('kind')} steps={len(d.get('steps') or [])}")


if __name__ == "__main__":
    main("--lessons" in sys.argv)
