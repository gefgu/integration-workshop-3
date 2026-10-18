"""Teacher accounts: sign-up, sign-in and the `current_teacher` dependency (SFR25, SFR28)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .security import hash_password, new_token, token_digest, verify_password
from .storage import (
    AuthToken, ClassLesson, Module, SavedLesson, SchoolClass, Teacher, get_session,
)

router = APIRouter(prefix="/auth")
Db = Annotated[Session, Depends(get_session)]
TOKEN_TTL = timedelta(days=30)


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def current_teacher(db: Db, authorization: Annotated[str | None, Header()] = None) -> Teacher:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Faça login para continuar.")
    row = db.get(AuthToken, token_digest(authorization[7:].strip()))
    if row is None or row.expires_at < utcnow():
        raise HTTPException(401, "Sua sessão expirou. Faça login novamente.")
    teacher = db.get(Teacher, row.teacher_id)
    if teacher is None:
        raise HTTPException(401, "Conta não encontrada.")
    return teacher


Me = Annotated[Teacher, Depends(current_teacher)]


def clean_email(value: str) -> str:
    value = value.strip().lower()
    if "@" not in value or value.startswith("@") or value.endswith("@"):
        raise ValueError("Informe um e-mail válido")
    return value


class RegisterInput(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=6, max_length=128)

    @field_validator("name")
    @classmethod
    def name_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Informe seu nome")
        return value

    @field_validator("email")
    @classmethod
    def email_valid(cls, value: str) -> str:
        return clean_email(value)


class LoginInput(BaseModel):
    email: str
    password: str


class ProfileInput(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    current_password: str | None = None
    new_password: str | None = Field(default=None, min_length=6, max_length=128)

    @field_validator("email")
    @classmethod
    def email_valid(cls, value: str) -> str:
        return clean_email(value)


class DeleteInput(BaseModel):
    password: str


def teacher_out(item: Teacher) -> dict[str, Any]:
    return {"id": item.id, "name": item.name, "email": item.email}


def issue_token(db: Session, teacher: Teacher) -> dict[str, Any]:
    token = new_token()
    db.add(AuthToken(token_hash=token_digest(token), teacher_id=teacher.id, expires_at=utcnow() + TOKEN_TTL))
    db.commit()
    return {"token": token, "teacher": teacher_out(teacher)}


@router.post("/register", status_code=201)
def register(body: RegisterInput, db: Db) -> dict:
    if db.scalar(select(Teacher).where(func.lower(Teacher.email) == body.email)):
        raise HTTPException(409, "Já existe uma conta com este e-mail.")
    teacher = Teacher(name=body.name, email=body.email, password_hash=hash_password(body.password),
                      created_at=utcnow())
    db.add(teacher)
    try:
        db.flush()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, "Já existe uma conta com este e-mail.") from error
    return issue_token(db, teacher)


@router.post("/login")
def login(body: LoginInput, db: Db) -> dict:
    teacher = db.scalar(select(Teacher).where(func.lower(Teacher.email) == body.email.strip().lower()))
    if teacher is None or not verify_password(body.password, teacher.password_hash):
        raise HTTPException(401, "E-mail ou senha incorretos.")
    db.execute(delete(AuthToken).where(AuthToken.teacher_id == teacher.id, AuthToken.expires_at < utcnow()))
    return issue_token(db, teacher)


@router.post("/logout", status_code=204)
def logout(db: Db, me: Me, authorization: Annotated[str | None, Header()] = None) -> None:
    db.execute(delete(AuthToken).where(AuthToken.token_hash == token_digest(authorization[7:].strip())))
    db.commit()


@router.get("/me")
def get_me(me: Me) -> dict:
    return teacher_out(me)


@router.put("/me")
def update_me(body: ProfileInput, db: Db, me: Me) -> dict:
    if body.email != me.email.lower() and db.scalar(
            select(Teacher).where(func.lower(Teacher.email) == body.email, Teacher.id != me.id)):
        raise HTTPException(409, "Já existe uma conta com este e-mail.")
    if body.new_password:
        if not body.current_password or not verify_password(body.current_password, me.password_hash):
            raise HTTPException(403, "Senha atual incorreta.")
        me.password_hash = hash_password(body.new_password)
    me.name = body.name.strip()
    me.email = body.email
    db.commit()
    return teacher_out(me)


@router.delete("/me", status_code=204)
def delete_me(body: DeleteInput, db: Db, me: Me) -> None:
    """Deletes the account and everything it owns (classes, students and their history, modules, lessons)."""
    if not verify_password(body.password, me.password_hash):
        raise HTTPException(403, "Senha incorreta.")
    for item in db.scalars(select(SchoolClass).where(SchoolClass.teacher_id == me.id)).all():
        db.delete(item)
    for item in db.scalars(select(Module).where(Module.teacher_id == me.id)).all():
        db.delete(item)
    db.flush()
    lesson_ids = select(SavedLesson.id).where(SavedLesson.teacher_id == me.id)
    db.execute(delete(ClassLesson).where(ClassLesson.lesson_id.in_(lesson_ids)))
    db.execute(delete(SavedLesson).where(SavedLesson.teacher_id == me.id))
    db.execute(delete(AuthToken).where(AuthToken.teacher_id == me.id))
    db.delete(me)
    db.commit()
