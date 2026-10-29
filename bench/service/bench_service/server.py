"""Bench service: HTTP for the bench screen, the teacher-app protocol over WebSocket, local validation.

Run on the Raspberry Pi (or a laptop for the demo):
    python -m bench_service --db bench.sqlite3 --port 8765
"""
from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from graph_validator.service.app import app as validator_app

from .protocol import FrameAssembler, Session, encode_frames
from .store import BenchStore

NOT_RECOGNIZED = "Tag não reconhecida — chame seu professor."
LOCKED = "Conecte o app do professor para liberar a bancada."


class LoginInput(BaseModel):
    nfc_code: str = Field(min_length=1)


class StepInput(BaseModel):
    lesson_id: str
    step_idx: int = Field(ge=0)
    lesson_done: bool = False
    duration_s: float | None = Field(default=None, ge=0)


class QuizInput(BaseModel):
    lesson_id: str
    quiz_id: str
    correct: bool


class ScoreInput(BaseModel):
    lesson_id: str
    score: int = Field(ge=0, le=100)
    duration_s: float = Field(ge=0)


class LogoutInput(BaseModel):
    duration_s: float = Field(ge=0)


def create_app(store: BenchStore, dev_unlock: bool = False) -> FastAPI:
    app = FastAPI(title="TedTronics bench")
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
    app.mount("/validator", validator_app)  # /validator/validate/step works offline on the bench
    app.state.store = store

    def student(student_id: int) -> dict[str, Any]:
        package = store.package()
        found = next((s for s in (package or {}).get("students", []) if s["id"] == student_id), None)
        if found is None:
            raise HTTPException(404, "Aluno não está no pacote carregado.")
        return found

    def lesson_version(lesson_id: str) -> str | None:
        package = store.package() or {}
        return next((l.get("lessonVersion") for l in package.get("lessons", []) if l["id"] == lesson_id), None)

    @app.get("/status")
    def status() -> dict:
        return store.status()

    @app.get("/package")
    def package() -> dict:
        if not store.is_unlocked():
            raise HTTPException(423, LOCKED)
        loaded = store.package()
        if loaded is None:
            raise HTTPException(404, "Nenhum módulo carregado. Envie um módulo pelo app do professor.")
        return loaded

    @app.post("/login")
    def login(body: LoginInput) -> dict:
        """NFC tag → student, their saved progress and where to resume (SFR35-37)."""
        if not store.is_unlocked():
            raise HTTPException(423, LOCKED)
        found = store.student_by_tag(body.nfc_code)
        if found is None:
            raise HTTPException(404, NOT_RECOGNIZED)
        return {"student": found, "progress": store.progress(found["id"]), "resume": store.resume_point(found["id"])}

    @app.post("/students/{student_id}/step")
    def step(student_id: int, body: StepInput) -> dict:
        who = student(student_id)
        version = lesson_version(body.lesson_id)
        store.record("step_done", who, lesson_id=body.lesson_id, lesson_version=version, step_idx=body.step_idx)
        next_step = body.step_idx if body.lesson_done else body.step_idx + 1
        saved = store.save_progress(student_id, body.lesson_id, next_step, body.lesson_done, version)
        if body.lesson_done:
            store.record("lesson_done", who, lesson_id=body.lesson_id, lesson_version=version,
                         duration_s=body.duration_s)
        return {"progress": saved, "resume": store.resume_point(student_id)}

    @app.post("/students/{student_id}/quiz")
    def quiz(student_id: int, body: QuizInput) -> dict:
        event = store.record("quiz_answer", student(student_id), lesson_id=body.lesson_id,
                             lesson_version=lesson_version(body.lesson_id), score=100 if body.correct else 0)
        return {"event_id": event["event_id"]}

    @app.post("/students/{student_id}/score")
    def score(student_id: int, body: ScoreInput) -> dict:
        """Challenge result (SFR39) and the top-3 ranking to show next (SFR40)."""
        who = student(student_id)
        version = lesson_version(body.lesson_id)
        store.record("challenge_score", who, lesson_id=body.lesson_id, lesson_version=version,
                     score=body.score, duration_s=body.duration_s)
        store.add_score(who, body.lesson_id, body.score, body.duration_s)
        return {"ranking": store.ranking(body.lesson_id)}

    @app.post("/students/{student_id}/logout")
    def logout(student_id: int, body: LogoutInput) -> dict:
        store.record("session", student(student_id), duration_s=body.duration_s)
        return {"ok": True}

    @app.get("/ranking")
    def ranking(lesson_id: str | None = None) -> list[dict]:
        return store.ranking(lesson_id)

    if dev_unlock:
        @app.post("/dev/unlock")
        def dev_unlock_endpoint() -> dict:
            """Demo only (TEDTRONICS_BENCH_DEV=1): unlock without the phone."""
            import time
            store.unlock({"id": 0, "name": "Modo demonstração"}, time.time() + 3600)
            return store.status()

    @app.websocket("/ble")
    async def ble(socket: WebSocket) -> None:
        """Bluetooth simulator: the same frames the GATT RX/TX characteristics carry."""
        await socket.accept()
        session, assembler, counter = Session(store), FrameAssembler(), 0
        try:
            while True:
                frame = await socket.receive_text()
                try:
                    message = assembler.push(frame)
                except ValueError as error:
                    message, reply = None, {"type": "ERROR", "re": None, "code": "bad_message",
                                            "message": str(error)}
                    counter += 1
                    for out in encode_frames(reply, f"b{counter}"):
                        await socket.send_text(out)
                if message is None:
                    continue
                reply = session.handle(message)
                counter += 1
                for out in encode_frames(reply, f"b{counter}"):
                    await socket.send_text(out)
        except WebSocketDisconnect:
            return

    return app


def default_app() -> FastAPI:
    store = BenchStore(os.getenv("TEDTRONICS_BENCH_DB", "bench.sqlite3"), os.getenv("TEDTRONICS_BENCH_ID"))
    return create_app(store, dev_unlock=os.getenv("TEDTRONICS_BENCH_DEV") == "1")
