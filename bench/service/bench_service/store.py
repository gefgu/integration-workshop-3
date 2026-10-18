"""Bench-local storage (SQLite): the loaded package, offline events, resume points and scores.

Everything here survives a reboot except the teacher unlock, which lasts one session (SFR43).
"""
from __future__ import annotations

import json
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events (event_id TEXT PRIMARY KEY, seq INTEGER NOT NULL, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS progress (
    student_id INTEGER NOT NULL, lesson_id TEXT NOT NULL, lesson_version TEXT,
    step_idx INTEGER NOT NULL DEFAULT 0, completed INTEGER NOT NULL DEFAULT 0,
    started_at REAL NOT NULL, updated_at REAL NOT NULL,
    PRIMARY KEY (student_id, lesson_id));
CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, nickname TEXT NOT NULL,
    lesson_id TEXT NOT NULL, score INTEGER NOT NULL, duration_s REAL NOT NULL, at TEXT NOT NULL);
"""

EVENT_KINDS = {"session", "step_done", "lesson_done", "quiz_answer", "challenge_score"}


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class BenchStore:
    def __init__(self, path: str | Path = ":memory:", bench_id: str | None = None) -> None:
        self._db = sqlite3.connect(str(path), check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        self._unlocked: tuple[dict[str, Any], float] | None = None
        with self._lock, self._db:
            self._db.executescript(SCHEMA)
        if bench_id:
            self._set("bench_id", bench_id)
        elif self._get("bench_id") is None:
            self._set("bench_id", f"bancada-{uuid.uuid4().hex[:6]}")

    # meta ------------------------------------------------------------------------------------------
    def _get(self, key: str) -> str | None:
        row = self._db.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
        return row["value"] if row else None

    def _set(self, key: str, value: str) -> None:
        with self._lock, self._db:
            self._db.execute("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", (key, value))

    @property
    def bench_id(self) -> str:
        return self._get("bench_id")

    # teacher unlock (SFR43, SFR57) -----------------------------------------------------------------
    def unlock(self, teacher: dict[str, Any], expires_at: float) -> None:
        self._unlocked = (teacher, expires_at)

    def is_unlocked(self) -> bool:
        return self._unlocked is not None and self._unlocked[1] > time.time()

    def teacher(self) -> dict[str, Any] | None:
        return self._unlocked[0] if self.is_unlocked() else None

    # package ---------------------------------------------------------------------------------------
    def load_package(self, package: dict[str, Any]) -> None:
        self._set("package", json.dumps(package, ensure_ascii=False))

    def package(self) -> dict[str, Any] | None:
        raw = self._get("package")
        return json.loads(raw) if raw else None

    def student_by_tag(self, nfc_code: str) -> dict[str, Any] | None:
        package = self.package()
        if not package:
            return None
        code = nfc_code.strip()
        return next((s for s in package["students"] if s.get("nfc_code") == code), None)

    def status(self) -> dict[str, Any]:
        package = self.package()
        return {
            "bench_id": self.bench_id,
            "unlocked": self.is_unlocked(),
            "teacher": self.teacher(),
            "package": {"version_id": package["version_id"], "module_title": package["module"]["title"],
                        "class_name": package["class"]["name"]} if package else None,
            "pending_events": self.pending_count(),
        }

    # events (SFR56) --------------------------------------------------------------------------------
    def record(self, kind: str, student: dict[str, Any], **fields: Any) -> dict[str, Any]:
        if kind not in EVENT_KINDS:
            raise ValueError(f"tipo de evento desconhecido: {kind}")
        package = self.package() or {}
        with self._lock, self._db:
            seq = int(self._db.execute("SELECT COALESCE(MAX(CAST(value AS INTEGER)), 0) FROM meta "
                                       "WHERE key = 'seq'").fetchone()[0]) + 1
            self._db.execute("INSERT OR REPLACE INTO meta (key, value) VALUES ('seq', ?)", (str(seq),))
            event = {"event_id": str(uuid.uuid4()), "student_id": student["id"], "nfc_code": student["nfc_code"],
                     "kind": kind, "seq": seq, "at": iso_now(),
                     "module_id": (package.get("module") or {}).get("id"), **fields}
            self._db.execute("INSERT INTO events (event_id, seq, body) VALUES (?, ?, ?)",
                             (event["event_id"], seq, json.dumps(event, ensure_ascii=False)))
        return event

    def pending_events(self, limit: int = 50, after_seq: int = 0) -> list[dict[str, Any]]:
        rows = self._db.execute("SELECT body FROM events WHERE seq > ? ORDER BY seq LIMIT ?",
                                (after_seq, limit)).fetchall()
        return [json.loads(row["body"]) for row in rows]

    def pending_count(self, after_seq: int = 0) -> int:
        return int(self._db.execute("SELECT COUNT(*) FROM events WHERE seq > ?", (after_seq,)).fetchone()[0])

    def ack_events(self, event_ids: list[str]) -> int:
        if not event_ids:
            return 0
        with self._lock, self._db:
            marks = ",".join("?" * len(event_ids))
            return self._db.execute(f"DELETE FROM events WHERE event_id IN ({marks})", event_ids).rowcount

    # resume points (SFR37, SFR37.1, SFR38) ---------------------------------------------------------
    def progress(self, student_id: int) -> dict[str, dict[str, Any]]:
        rows = self._db.execute("SELECT * FROM progress WHERE student_id = ?", (student_id,)).fetchall()
        return {row["lesson_id"]: dict(row) for row in rows}

    def save_progress(self, student_id: int, lesson_id: str, step_idx: int, completed: bool,
                      lesson_version: str | None) -> dict[str, Any]:
        now = time.time()
        with self._lock, self._db:
            row = self._db.execute("SELECT * FROM progress WHERE student_id = ? AND lesson_id = ?",
                                   (student_id, lesson_id)).fetchone()
            if row is None or (row["lesson_version"] != lesson_version and not row["completed"]):
                started = now if row is None else row["started_at"]
                self._db.execute("INSERT OR REPLACE INTO progress VALUES (?, ?, ?, ?, ?, ?, ?)",
                                 (student_id, lesson_id, lesson_version, step_idx, int(completed), started, now))
            else:
                self._db.execute("UPDATE progress SET step_idx = ?, completed = MAX(completed, ?), updated_at = ? "
                                 "WHERE student_id = ? AND lesson_id = ?",
                                 (step_idx, int(completed), now, student_id, lesson_id))
        return self.progress(student_id)[lesson_id]

    def resume_point(self, student_id: int) -> dict[str, Any] | None:
        """First lesson of the package the student has not finished, and the step to resume at."""
        package = self.package()
        if not package:
            return None
        done = self.progress(student_id)
        for lesson in package["lessons"]:
            row = done.get(lesson["id"])
            if not row or not row["completed"]:
                return {"lesson_id": lesson["id"], "step_idx": row["step_idx"] if row else 0}
        return {"lesson_id": None, "step_idx": 0}

    # scores (SFR39, SFR40) -------------------------------------------------------------------------
    def add_score(self, student: dict[str, Any], lesson_id: str, score: int, duration_s: float) -> None:
        with self._lock, self._db:
            self._db.execute("INSERT INTO scores (student_id, nickname, lesson_id, score, duration_s, at) "
                             "VALUES (?, ?, ?, ?, ?, ?)",
                             (student["id"], student["nickname"], lesson_id, score, duration_s, iso_now()))

    def ranking(self, lesson_id: str | None = None, limit: int = 3) -> list[dict[str, Any]]:
        """Best score per student (ties: faster time first)."""
        where, args = ("WHERE lesson_id = ?", [lesson_id]) if lesson_id else ("", [])
        rows = self._db.execute(
            f"SELECT student_id, nickname, score, duration_s, at FROM scores {where} "
            "ORDER BY score DESC, duration_s ASC, at ASC", args).fetchall()
        best: dict[int, dict[str, Any]] = {}
        for row in rows:
            best.setdefault(row["student_id"], dict(row))
        return list(best.values())[:limit]
