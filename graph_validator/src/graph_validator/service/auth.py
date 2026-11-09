"""Teacher accounts: sign-up, sign-in and the `current_teacher` dependency (SFR25, SFR28)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .neon_auth import MIN_PASSWORD, NeonAuth, NeonAuthUnavailable, Reply, neon_auth
from .security import hash_password, new_token, token_digest, verify_password
from .storage import (
    AuthToken, ClassLesson, Module, SavedLesson, SchoolClass, Teacher, database_url, get_session,
)

router = APIRouter(prefix="/auth")
Db = Annotated[Session, Depends(get_session)]
# Set when the site runs on Neon: one password for the site and the phone app (see neon_auth.py).
Accounts = Annotated[NeonAuth | None, Depends(neon_auth)]
TOKEN_TTL = timedelta(days=30)
EXISTS = {"USER_ALREADY_EXISTS", "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"}
WRONG_PASSWORD = "E-mail ou senha incorretos."
PHONE_PASSWORD = ("Este e-mail já tem conta no app do celular. Entre com a senha que você usa no celular: "
                  "agora ela vale também para o site.")


def ask(call, *args) -> Reply:
    try:
        return call(*args)
    except NeonAuthUnavailable as error:
        raise HTTPException(503, "Não foi possível falar com o serviço de contas (Neon Auth). Tente de novo.") \
            from error


def end_session(accounts: NeonAuth, reply: Reply) -> None:
    """The site keeps its own bearer token; the Neon Auth session opened to check the password is closed."""
    if reply.cookie:
        accounts.sign_out(reply.cookie)


def find_teacher(db: Session, email: str) -> Teacher | None:
    return db.scalar(select(Teacher).where(func.lower(Teacher.email) == email))


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
    password: str = Field(min_length=MIN_PASSWORD, max_length=128)

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
    new_password: str | None = Field(default=None, min_length=MIN_PASSWORD, max_length=128)

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
def register(body: RegisterInput, db: Db, accounts: Accounts) -> dict:
    if find_teacher(db, body.email):
        raise HTTPException(409, "Já existe uma conta com este e-mail.")
    name = body.name
    if accounts is not None:
        created = ask(accounts.sign_up, body.email, body.password, body.name)
        if created.code in EXISTS:
            # Made on the phone first: the same e-mail and password link it to this new site account.
            created = ask(accounts.sign_in, body.email, body.password)
            if created.status != 200:
                raise HTTPException(409, PHONE_PASSWORD)
            name = (created.body.get("user") or {}).get("name") or name
        elif created.status != 200:
            raise HTTPException(400, created.body.get("message") or "Não foi possível criar a conta.")
        end_session(accounts, created)
    teacher = Teacher(name=name, email=body.email, password_hash=hash_password(body.password),
                      created_at=utcnow())
    db.add(teacher)
    try:
        db.flush()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, "Já existe uma conta com este e-mail.") from error
    return issue_token(db, teacher)


@router.post("/login")
def login(body: LoginInput, db: Db, accounts: Accounts) -> dict:
    email = body.email.strip().lower()
    teacher = find_teacher(db, email)
    if accounts is None:
        if teacher is None or not verify_password(body.password, teacher.password_hash):
            raise HTTPException(401, WRONG_PASSWORD)
    else:
        teacher = neon_login(db, accounts, email, body.password, teacher)
    db.execute(delete(AuthToken).where(AuthToken.teacher_id == teacher.id, AuthToken.expires_at < utcnow()))
    return issue_token(db, teacher)


def neon_login(db: Session, accounts: NeonAuth, email: str, password: str, teacher: Teacher | None) -> Teacher:
    """Neon Auth decides; the local hash is kept equal to that password (and moves old site passwords over)."""
    checked = ask(accounts.sign_in, email, password)
    if checked.status == 200:
        end_session(accounts, checked)
        if teacher is None:  # account made on the phone: the site gets its teacher row on the first sign-in
            name = (checked.body.get("user") or {}).get("name") or email.split("@")[0]
            teacher = Teacher(name=name, email=email, password_hash="", created_at=utcnow())
            db.add(teacher)
        teacher.password_hash = hash_password(password)
        db.flush()
        return teacher
    if teacher is None or not verify_password(password, teacher.password_hash):
        raise HTTPException(401, WRONG_PASSWORD)
    # A site password from before the accounts were unified: give it to Neon Auth, unless the phone already has one.
    if len(password) < MIN_PASSWORD:
        return teacher  # too short for Neon Auth; a new password in the profile moves the account over
    created = ask(accounts.sign_up, email, password, teacher.name)
    if created.code in EXISTS:
        raise HTTPException(401, PHONE_PASSWORD)
    if created.status != 200:
        raise HTTPException(400, created.body.get("message") or "Não foi possível entrar.")
    end_session(accounts, created)
    return teacher


@router.get("/config")
def config(accounts: Accounts) -> dict[str, str]:
    """For the login screen: "sqlite" = the local file, whose accounts and classes never reach the phone app."""
    return {"database": "postgres" if database_url().startswith("postgresql") else "sqlite",
            "accounts": "neon" if accounts is not None else "local"}


@router.post("/logout", status_code=204)
def logout(db: Db, me: Me, authorization: Annotated[str | None, Header()] = None) -> None:
    db.execute(delete(AuthToken).where(AuthToken.token_hash == token_digest(authorization[7:].strip())))
    db.commit()


@router.get("/me")
def get_me(me: Me) -> dict:
    return teacher_out(me)


@router.put("/me")
def update_me(body: ProfileInput, db: Db, me: Me, accounts: Accounts) -> dict:
    if body.email != me.email.lower():
        if accounts is not None:
            # The phone finds the teacher by this e-mail in Neon Auth, which has no e-mail change without verification.
            raise HTTPException(409, "O e-mail é o mesmo no site e no app do celular e não pode ser trocado aqui.")
        if db.scalar(select(Teacher).where(func.lower(Teacher.email) == body.email, Teacher.id != me.id)):
            raise HTTPException(409, "Já existe uma conta com este e-mail.")
    if body.new_password:
        if not body.current_password:
            raise HTTPException(403, "Senha atual incorreta.")
        if accounts is None:
            if not verify_password(body.current_password, me.password_hash):
                raise HTTPException(403, "Senha atual incorreta.")
        else:
            neon_change_password(accounts, me, body.current_password, body.new_password)
        me.password_hash = hash_password(body.new_password)
    me.name = body.name.strip()
    me.email = body.email
    db.commit()
    return teacher_out(me)


def neon_change_password(accounts: NeonAuth, me: Teacher, current: str, new: str) -> None:
    email = me.email.lower()
    session = ask(accounts.sign_in, email, current)
    if session.status == 200:
        changed = ask(accounts.change_password, session.cookie, current, new)
        end_session(accounts, session)
        if changed.status != 200:
            raise HTTPException(400, changed.body.get("message") or "Não foi possível trocar a senha.")
        return
    # Not in Neon Auth yet (old site account): the new password creates it there.
    if not verify_password(current, me.password_hash):
        raise HTTPException(403, "Senha atual incorreta.")
    created = ask(accounts.sign_up, email, new, me.name)
    if created.code in EXISTS:
        raise HTTPException(403, "Senha atual incorreta. Use a senha do app do celular.")
    if created.status != 200:
        raise HTTPException(400, created.body.get("message") or "Não foi possível trocar a senha.")
    end_session(accounts, created)


@router.delete("/me", status_code=204)
def delete_me(body: DeleteInput, db: Db, me: Me, accounts: Accounts) -> None:
    """Deletes the account and everything it owns (classes, students and their history, modules, lessons)."""
    session = ask(accounts.sign_in, me.email.lower(), body.password) if accounts is not None else None
    if session is not None and session.status == 200:
        # Best effort: the phone account goes too (Neon Auth may refuse it when user deletion is disabled).
        ask(accounts.delete_user, session.cookie, body.password)
        end_session(accounts, session)
    elif not verify_password(body.password, me.password_hash):
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
