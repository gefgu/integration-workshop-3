"""Bench service: HTTP for the bench screen, the teacher-app protocol over WebSocket, local validation.

Run on the Raspberry Pi (or a laptop for the demo):
    python -m bench_service --db bench.sqlite3 --port 8765
"""
from __future__ import annotations

import os
import threading
import sys
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from graph_validator.service.app import app as validator_app

from .camera_debug import CAMERA_DEBUG_HTML
from .controls import KEYS, ControlsHub, SerialControls
from .protocol import FrameAssembler, Session, encode_frames
from .store import BenchStore
from .vision import VisionSource

NOT_RECOGNIZED = "Tag não reconhecida — chame seu professor."
LOCKED = "Conecte o app do professor para liberar a bancada."


_speech_lock = threading.Lock()


def synthesize_speech(phrase: str) -> Path:
    """Reuse the project's Piper cache; synthesize new phrases offline as needed."""
    from graph_validator.tts import audio_dir, default_synth, ensure_audio, normalize
    with _speech_lock:
        files = ensure_audio([phrase], default_synth())
        return audio_dir() / files[normalize(phrase)]


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


def create_app(store: BenchStore, dev_unlock: bool = False, vision: VisionSource | None = None,
               controls: ControlsHub | None = None, ui_dir: Path | None = None) -> FastAPI:
    app = FastAPI(title="TedTronics bench")
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
    app.mount("/validator", validator_app)  # /validator/validate/step works offline on the bench
    controls = controls or ControlsHub()
    app.state.store = store
    app.state.vision = vision
    app.state.controls = controls

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

    @app.get("/tts/speak")
    def speak(text: str = Query(min_length=1, max_length=3000)) -> Response:
        """Speak lesson and feedback text locally, without a network or prebuilt manifest."""
        from graph_validator.tts.synth import normalize
        phrase = normalize(text)
        if not phrase:
            raise HTTPException(422, "Texto vazio.")
        try:
            audio = synthesize_speech(phrase)
        except Exception as error:
            raise HTTPException(503, "Voz Piper indisponível; confira a instalação e o modelo.") from error
        return FileResponse(audio, media_type="audio/mpeg", headers={"Cache-Control": "private, max-age=86400"})

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

    @app.get("/ranking/overall")
    def ranking_overall() -> list[dict]:
        """SFR40 for the whole module: best score per challenge, added up per student."""
        return store.overall_ranking()

    @app.get("/ranking")
    def ranking(lesson_id: str | None = None) -> list[dict]:
        return store.ranking(lesson_id)

    # Camera board (SFR17.1): pieces the vision pipeline sees, for the lesson and the camera screen.
    @app.get("/camera-debug", response_class=HTMLResponse, include_in_schema=False)
    def camera_debug() -> HTMLResponse:
        return HTMLResponse(CAMERA_DEBUG_HTML, headers={"Cache-Control": "no-store"})

    @app.get("/vision/state")
    def vision_state() -> dict:
        if vision is None:
            return {"available": False, "reason": "Visão desligada (inicie o serviço com --camera ou --vision-image)."}
        return vision.state()

    @app.get("/vision/frame.jpg")
    def vision_frame() -> Response:
        frame = vision.frame() if vision else None
        if frame is None:
            raise HTTPException(404, "Ainda não há imagem da câmera.")
        return Response(frame, media_type="image/jpeg", headers={"Cache-Control": "no-store"})

    @app.post("/vision/recalibrate")
    def vision_recalibrate() -> dict:
        if vision is None:
            raise HTTPException(404, "Visão desligada.")
        vision.recalibrate()
        return {"ok": True}

    # Physical controls (ESP32 joystick + Energizar over the GPIO serial port, bench_service/controls.py).
    @app.get("/controls/state")
    def controls_state() -> dict:
        return controls.state()

    @app.websocket("/controls")
    async def controls_socket(socket: WebSocket) -> None:
        """Pushes {seq, key} for every physical press; the bench screen turns it into a key press."""
        import asyncio

        await socket.accept()
        seq = controls.seq  # only presses from now on
        try:
            while True:
                for event in controls.since(seq):
                    seq = event["seq"]
                    await socket.send_json({"seq": seq, "key": event["key"]})
                await asyncio.sleep(0.02)
        except (WebSocketDisconnect, RuntimeError):
            return

    if dev_unlock:
        @app.post("/dev/controls/{name}")
        def dev_controls_press(name: str) -> dict:
            """Demo only: simulate an ESP32 line (UP, DOWN, LEFT, RIGHT, OK, VOLTAR, ENERGIZAR)."""
            if name.upper() not in KEYS:
                raise HTTPException(422, f"Use um destes: {', '.join(KEYS)}")
            return controls.push(KEYS[name.upper()])

        @app.post("/dev/unlock")
        def dev_unlock_endpoint() -> dict:
            """Demo only (TEDTRONICS_BENCH_DEV=1): unlock without the phone."""
            import time
            store.unlock({"id": 0, "name": "Modo demonstração"}, time.time() + 3600)
            return store.status()

        @app.post("/dev/demo")
        def dev_demo_endpoint(package: dict[str, Any]) -> dict:
            """Demo only: unlock and load a package built by the bench screen (curriculum + demo students).
            It is marked `demo`, so its events are never queued for the teacher's server."""
            import time
            if not package.get("lessons") or not package.get("students") or not package.get("module"):
                raise HTTPException(422, "Pacote de demonstração incompleto.")
            store.load_package({
                "teacher": {"id": 0, "name": "Modo demonstração"},
                "class": {"id": 0, "name": "Turma de demonstração"},
                "created_at": "",
                **package,
                "demo": True,
            })
            store.unlock({"id": 0, "name": "Modo demonstração"}, time.time() + 3 * 3600)
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

    # The bench screen itself (the built bench.html + assets), so one program runs the whole bench.
    if ui_dir and (ui_dir / "bench.html").is_file():
        if (ui_dir / "assets").is_dir():
            app.mount("/assets", StaticFiles(directory=ui_dir / "assets"), name="assets")

        @app.get("/", include_in_schema=False)
        def bench_screen() -> FileResponse:
            return FileResponse(ui_dir / "bench.html", headers={"Cache-Control": "no-cache"})

    return app


def find_ui_dir() -> Path | None:
    """The built bench screen: TEDTRONICS_BENCH_UI, the folder bundled in an executable, or the site's dist/."""
    candidates = [os.getenv("TEDTRONICS_BENCH_UI")]
    if getattr(sys, "frozen", False):
        candidates.append(str(Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent)) / "bench_ui"))
    candidates.append(str(Path(__file__).resolve().parents[3] / "teacher_authoring_app" / "dist"))
    for candidate in candidates:
        if candidate and (Path(candidate) / "bench.html").is_file():
            return Path(candidate)
    return None


def default_app() -> FastAPI:
    store = BenchStore(os.getenv("TEDTRONICS_BENCH_DB", "bench.sqlite3"), os.getenv("TEDTRONICS_BENCH_ID"))
    camera, image = os.getenv("TEDTRONICS_BENCH_CAMERA"), os.getenv("TEDTRONICS_BENCH_VISION_IMAGE")
    profile = os.getenv("TEDTRONICS_BENCH_VISION_PROFILE", "current")
    calibration = os.getenv("TEDTRONICS_BENCH_CALIBRATION") or None
    vision = (VisionSource(int(camera) if camera else None, image, profile, calibration).start()
              if camera or image else None)
    controls = ControlsHub()
    port = os.getenv("TEDTRONICS_BENCH_CONTROLS")  # "auto" (USB or GPIO), /dev/ttyUSB0, /dev/serial0, COM4
    if port:
        SerialControls(port, controls).start()
    return create_app(store, dev_unlock=os.getenv("TEDTRONICS_BENCH_DEV") == "1", vision=vision,
                      controls=controls, ui_dir=find_ui_dir())
