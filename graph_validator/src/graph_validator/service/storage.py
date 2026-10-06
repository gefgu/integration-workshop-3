"""Database models and request-scoped sessions for the teacher workspace."""
from __future__ import annotations

import os
from collections.abc import Iterator
from datetime import datetime
from pathlib import Path

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker


class Base(DeclarativeBase):
    pass


class Teacher(Base):
    __tablename__ = "teachers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)


class SchoolClass(Base):
    __tablename__ = "school_classes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    students: Mapped[list[Student]] = relationship(back_populates="school_class", cascade="all, delete-orphan")
    assignments: Mapped[list[ClassLesson]] = relationship(back_populates="school_class", cascade="all, delete-orphan")


class Student(Base):
    __tablename__ = "students"
    __table_args__ = (UniqueConstraint("class_id", "nickname", name="uq_student_class_nickname"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("school_classes.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    nickname: Mapped[str] = mapped_column(String(255), nullable=False)
    nfc_code: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    school_class: Mapped[SchoolClass] = relationship(back_populates="students")


class SavedLesson(Base):
    __tablename__ = "saved_lessons"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    document: Mapped[dict] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    assignments: Mapped[list[ClassLesson]] = relationship(back_populates="lesson")


class ClassLesson(Base):
    __tablename__ = "class_lessons"
    __table_args__ = (UniqueConstraint("class_id", "position", name="uq_class_lesson_position"),)

    class_id: Mapped[int] = mapped_column(ForeignKey("school_classes.id", ondelete="CASCADE"), primary_key=True)
    lesson_id: Mapped[str] = mapped_column(ForeignKey("saved_lessons.id"), primary_key=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    school_class: Mapped[SchoolClass] = relationship(back_populates="assignments")
    lesson: Mapped[SavedLesson] = relationship(back_populates="assignments")


_engine = None


def database_url() -> str:
    default_file = Path(__file__).resolve().parents[3] / "tedtronics.sqlite3"
    return os.getenv("TEDTRONICS_DATABASE_URL") or f"sqlite:///{default_file}"


def get_engine():
    global _engine
    if _engine is None:
        url = database_url()
        _engine = create_engine(url, pool_pre_ping=True)
        if _engine.dialect.name == "sqlite":
            @event.listens_for(_engine, "connect")
            def enable_foreign_keys(connection, _record):
                cursor = connection.cursor()
                cursor.execute("PRAGMA foreign_keys=ON")
                cursor.close()
    return _engine


def get_session() -> Iterator[Session]:
    with sessionmaker(bind=get_engine())() as session:
        yield session
