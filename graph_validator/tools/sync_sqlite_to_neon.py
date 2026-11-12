"""Bring teachers (and what they own) from the local SQLite database into Neon, without overwriting anything.

Usage (from the repository root):
    graph_validator/.venv/Scripts/python graph_validator/tools/sync_sqlite_to_neon.py              # dry run
    graph_validator/.venv/Scripts/python graph_validator/tools/sync_sqlite_to_neon.py --apply      # writes
Options: --email ADDR (repeatable: only these teachers), --sqlite FILE, --into-existing.

The target is TEDTRONICS_DATABASE_URL, else DATABASE_URL_UNPOOLED / DATABASE_URL from the repository's .env.local
(written by `neon link`). The URL is never printed. The target must be migrated (`npm run migrate`).

Rules (so running it twice changes nothing the second time):
- a teacher is matched by e-mail (case-insensitive). A teacher missing in the target is created with the same
  name and password hash, so the site password keeps working. A teacher already in the target is left alone and
  reported; with --into-existing only the items it does not have yet are added. Nothing in the target is ever
  updated or deleted.
- lessons keep their id, except curriculum copies ("curriculo-…-p<old id>"), renamed to the new teacher id the way
  the site names them. A lesson id held by another teacher in the target is skipped and reported.
- modules are matched by title, classes by name, students by nickname inside their class. A copied student keeps
  its uid (a new one is drawn if the target already uses it, reported). Progress events are matched by their event
  id and take the target student's id and uid.
- login sessions (auth_tokens) are not copied: sign in again on the site.

Everything runs in one transaction; the dry run rolls it back, so its report is exactly what --apply would do.
"""
from __future__ import annotations

import argparse
import copy
import os
import re
import sys
from pathlib import Path

from sqlalchemy import create_engine, func, select
from sqlalchemy.engine import Connection

from graph_validator.service.storage import (
    ClassLesson, ClassModule, Module, ModuleLesson, ProgressEvent, SavedLesson, SchoolClass, Student, Teacher,
    student_uid,
)

REPO = Path(__file__).resolve().parents[2]
DEFAULT_SQLITE = REPO / "graph_validator" / "tedtronics.sqlite3"
CURRICULUM_COPY = re.compile(r"^(curriculo-.+)-p\d+$")

T, L, M, ML = Teacher.__table__, SavedLesson.__table__, Module.__table__, ModuleLesson.__table__
C, CL, CM, S = SchoolClass.__table__, ClassLesson.__table__, ClassModule.__table__, Student.__table__
EV = ProgressEvent.__table__


def read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        match = re.match(r"^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=\s*(.*?)\s*$", line)
        if match and not line.lstrip().startswith("#"):
            value = match.group(2)
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            values[match.group(1)] = value
    return values


def target_url() -> str:
    env = read_env_file(REPO / ".env.local")
    url = (os.getenv("TEDTRONICS_DATABASE_URL") or env.get("DATABASE_URL_UNPOOLED") or env.get("DATABASE_URL")
           or env.get("TEDTRONICS_DATABASE_URL") or "")
    for prefix in ("postgresql://", "postgres://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


class Sync:
    def __init__(self, src: Connection, dst: Connection, into_existing: bool) -> None:
        self.src, self.dst, self.into_existing = src, dst, into_existing
        self.lines: list[str] = []
        self.counts: dict[str, int] = {}

    def say(self, text: str) -> None:
        self.lines.append(text)

    def added(self, what: str, n: int = 1) -> None:
        self.counts[what] = self.counts.get(what, 0) + n

    def insert(self, table, row: dict) -> int | None:
        result = self.dst.execute(table.insert().values(**row))
        pk = result.inserted_primary_key
        return pk[0] if pk else None

    def teacher(self, row) -> None:
        email = row.email.strip().lower()
        found = self.dst.execute(select(T).where(func.lower(T.c.email) == email)).first()
        if found is None:
            new_id = self.insert(T, {"email": email, "name": row.name, "password_hash": row.password_hash,
                                     "created_at": row.created_at})
            self.say(f"+ professor {email}: criado no destino (mesma senha do site)")
            self.added("professores")
        elif self.into_existing:
            new_id = found.id
            self.say(f"= professor {email}: já existe no destino; nome e senha do destino mantidos, "
                     "só itens que faltam serão adicionados")
        else:
            self.say(f"! professor {email}: JÁ EXISTE no destino; nada foi alterado "
                     "(use --into-existing para adicionar só o que falta)")
            return
        self.owned(row.id, new_id, email)

    def lesson_id(self, old_id: str, new_teacher: int) -> str:
        match = CURRICULUM_COPY.match(old_id)
        return f"{match.group(1)}-p{new_teacher}" if match else old_id

    def owned(self, old_t: int, new_t: int, email: str) -> None:
        src, dst = self.src, self.dst
        lessons: dict[str, str] = {}
        for row in src.execute(select(L).where(L.c.teacher_id == old_t).order_by(L.c.id)):
            new_id = self.lesson_id(row.id, new_t)
            held = dst.execute(select(L.c.teacher_id).where(L.c.id == new_id)).scalar()
            if held is not None and held != new_t:
                self.say(f"! {email}: lição {new_id} pertence a outro professor no destino; não copiada")
                continue
            lessons[row.id] = new_id
            if held is None:
                document = copy.deepcopy(row.document)
                if isinstance(document, dict) and "id" in document:
                    document["id"] = new_id
                self.insert(L, {"id": new_id, "teacher_id": new_t, "title": row.title, "document": document,
                                "updated_at": row.updated_at})
                self.added("lições")

        modules: dict[int, int] = {}
        for row in src.execute(select(M).where(M.c.teacher_id == old_t).order_by(M.c.id)):
            have = dst.execute(select(M.c.id).where(M.c.teacher_id == new_t, M.c.title == row.title)).scalar()
            if have is not None:
                modules[row.id] = have
                continue
            modules[row.id] = self.insert(M, {"teacher_id": new_t, "title": row.title,
                                              "description": row.description, "updated_at": row.updated_at})
            self.added("módulos")
            for link in src.execute(select(ML).where(ML.c.module_id == row.id).order_by(ML.c.position)):
                if link.lesson_id in lessons:
                    self.insert(ML, {"module_id": modules[row.id], "lesson_id": lessons[link.lesson_id],
                                     "position": link.position})

        classes: dict[int, int] = {}
        students: dict[int, int] = {}
        uids: dict[int, str] = {}  # source student id -> the target student's uid
        for row in src.execute(select(C).where(C.c.teacher_id == old_t).order_by(C.c.id)):
            have = dst.execute(select(C.c.id).where(C.c.teacher_id == new_t, C.c.name == row.name)).scalar()
            fresh = have is None
            classes[row.id] = have if have is not None else self.insert(
                C, {"teacher_id": new_t, "name": row.name, "description": row.description})
            if fresh:
                self.added("turmas")
                for link in src.execute(select(CL).where(CL.c.class_id == row.id)):
                    if link.lesson_id in lessons:
                        self.insert(CL, {"class_id": classes[row.id], "lesson_id": lessons[link.lesson_id],
                                         "position": link.position})
                for link in src.execute(select(CM).where(CM.c.class_id == row.id)):
                    if link.module_id in modules:
                        self.insert(CM, {"class_id": classes[row.id], "module_id": modules[link.module_id],
                                         "position": link.position})
            for st in src.execute(select(S).where(S.c.class_id == row.id).order_by(S.c.id)):
                have_st = dst.execute(select(S.c.id).where(S.c.class_id == classes[row.id],
                                                         S.c.nickname == st.nickname)).scalar()
                if have_st is not None:
                    students[st.id] = have_st
                else:
                    # No tag is copied: tags are gone, and the legacy column stays empty.
                    students[st.id] = self.insert(S, {"class_id": classes[row.id], "name": st.name,
                                                      "nickname": st.nickname, "active": st.active})
                    self.added("alunos")
                # The uid is the student's id, which is new in the destination: events get it rewritten below.
                uids[st.id] = student_uid(students[st.id])

        if students:
            for ev in src.execute(select(EV).where(EV.c.student_id.in_(list(students))).order_by(EV.c.at)):
                if dst.execute(select(EV.c.event_id).where(EV.c.event_id == ev.event_id)).first():
                    continue
                row = dict(ev._mapping)
                row["student_id"] = students[ev.student_id]
                row[EV.c.nfc_code.key] = uids[ev.student_id]  # ProgressEvent.student_uid lives in nfc_code
                if row["lesson_id"]:
                    row["lesson_id"] = lessons.get(row["lesson_id"], self.lesson_id(row["lesson_id"], new_t))
                if row["module_id"] is not None:
                    row["module_id"] = modules.get(row["module_id"])
                self.insert(EV, row)
                self.added("eventos de progresso")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--sqlite", type=Path, default=DEFAULT_SQLITE)
    parser.add_argument("--email", action="append", default=[], help="só este professor (pode repetir)")
    parser.add_argument("--into-existing", action="store_true",
                        help="para professor que já existe no destino, adiciona só os itens que faltam")
    parser.add_argument("--apply", action="store_true", help="grava no destino (sem isto é só simulação)")
    parser.add_argument("--target", help=argparse.SUPPRESS)  # tests: any SQLAlchemy URL
    args = parser.parse_args(argv)

    url = args.target or target_url()
    if not url:
        print("Sem destino: crie .env.local na raiz do repositório com DATABASE_URL (Neon) ou defina "
              "TEDTRONICS_DATABASE_URL.", file=sys.stderr)
        return 2
    if not args.sqlite.is_file():
        print(f"SQLite não encontrado: {args.sqlite}", file=sys.stderr)
        return 2
    src_engine = create_engine(f"sqlite:///{args.sqlite}")
    dst_engine = create_engine(url)
    if dst_engine.dialect.name == "sqlite" and Path(dst_engine.url.database or "").resolve() == args.sqlite.resolve():
        print("O destino é o próprio SQLite de origem.", file=sys.stderr)
        return 2
    print(f"origem: {args.sqlite}")
    print(f"destino: {dst_engine.dialect.name} @ {dst_engine.url.host or 'arquivo local'}")

    wanted = {e.strip().lower() for e in args.email}
    with src_engine.connect() as src, dst_engine.connect() as dst:
        transaction = dst.begin()
        sync = Sync(src, dst, args.into_existing)
        teachers = src.execute(select(T).order_by(T.c.id)).all()
        for row in teachers:
            if not wanted or row.email.strip().lower() in wanted:
                sync.teacher(row)
        missing = wanted - {r.email.strip().lower() for r in teachers}
        for email in sorted(missing):
            sync.say(f"! {email}: não está no SQLite")
        for line in sync.lines:
            print(line)
        summary = ", ".join(f"{n} {what}" for what, n in sync.counts.items()) or "nada"
        if args.apply:
            transaction.commit()
            print(f"Gravado no destino: {summary}.")
        else:
            transaction.rollback()
            print(f"Simulação (nada gravado). Com --apply seriam adicionados: {summary}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
