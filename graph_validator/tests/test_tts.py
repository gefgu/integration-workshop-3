"""Tutor voice: which phrases a lesson needs, the MP3 cache, and the audio endpoints."""
import io
import json
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from graph_validator.feedback import DEFAULT_MESSAGES, NAMES
from graph_validator.service import tts as tts_service
from graph_validator.service.app import app
from graph_validator.service.auth import current_teacher
from graph_validator.service.storage import Base, Teacher, get_session
from graph_validator.tts import (PLAYER_PHRASES, PiperSynth, audio_file, build_system_pack, ensure_audio,
                                 lesson_audio, lesson_phrases, normalize, system_phrases)
from graph_validator.tts.phrases import CONNECT_TEXT
from graph_validator.tts.synth import TtsUnavailable, spoken, voice_path

VECTORS = json.loads((Path(__file__).parents[2] / "teacher_authoring_app/tests/tts_vectors.json").read_text("utf-8"))


class FakeSynth:
    voice = "fake"

    def __init__(self):
        self.calls = []

    def mp3(self, text):
        self.calls.append(text)
        return b"ID3" + text.encode()


def doc(**kw):
    base = {
        "version": 3, "id": "l1", "title": "Acender um LED", "instruction": "Monte o circuito com calma.",
        "kind": "guided",
        "board": {"cols": 11, "rows": 12, "pieces": [
            {"id": "bat", "type": "bateria", "a": 1, "b": 2, "row": 0},
            {"id": "led", "type": "led", "a": 3, "b": 4, "row": 1},
            {"id": "j", "type": "jumper_longo", "a": 4, "b": 2, "row": 2},
        ]},
        "steps": [
            {"id": "s1", "action": "place_component", "pieceId": "bat", "text": "Coloque a bateria.",
             "overrides": {"missing_component": {"*": "Cadê {nome}?"}, "reversed_polarity": {"led": "Vire {nome}!"}}},
        ],
        "quizzes": [
            {"id": "q1", "position": "before", "prompt": "O que acende?", "correctId": "a",
             "options": [{"id": "a", "text": "O LED", "feedback": "Isso!"}, {"id": "b", "text": "O fio", "feedback": ""}]},
        ],
    }
    return {**base, **kw}


def test_lesson_phrases_cover_what_the_teacher_wrote():
    out = lesson_phrases(doc())
    assert out[:2] == ["Acender um LED", "Monte o circuito com calma."]
    for text in ["O que acende?", "O LED", "Isso!", "O fio", "Coloque a bateria.", "Vire o LED!"]:
        assert text in out
    assert "" not in out and len(out) == len(set(out))
    # A "*" override is expanded for every family on the board (and the generic name).
    assert {"Cadê a bateria?", "Cadê o LED?", "Cadê o jumper?", "Cadê a peça?"} <= set(out)


def test_lesson_without_steps_uses_generated_step_texts():
    out = lesson_phrases(doc(steps=[]))
    assert "Coloque a bateria na bancada." in out and CONNECT_TEXT in out
    assert any(t.startswith("Coloque um jumper de 2 colunas") for t in out)
    assert CONNECT_TEXT not in lesson_phrases(doc(steps=[], kind="challenge"))


def test_system_phrases_cover_defaults_and_player_lines():
    out = set(system_phrases())
    assert DEFAULT_MESSAGES[next(iter(DEFAULT_MESSAGES))] in out
    assert "Falta uma peça. Pegue o LED na bandeja e coloque na bancada." in out
    assert set(PLAYER_PHRASES) <= out
    assert any("precisa ser conectado ao resistor de 470 Ω" in t for t in out)
    assert len(out) > len(DEFAULT_MESSAGES) * len(NAMES) // 2


def test_normalize_matches_the_app():
    for case in VECTORS:
        assert normalize(case["in"]) == case["out"]


def test_ensure_audio_caches_by_text(tmp_path):
    synth = FakeSynth()
    first = ensure_audio(["Olá  turma", "Olá turma", "Tchau"], synth, tmp_path)
    assert list(first) == ["Olá turma", "Tchau"] and synth.calls == ["Olá turma", "Tchau"]
    assert first["Tchau"] == audio_file("Tchau", "fake") and (tmp_path / first["Tchau"]).exists()
    assert ensure_audio(["Tchau", "Nova"], synth, tmp_path)["Tchau"] == first["Tchau"]
    assert synth.calls == ["Olá turma", "Tchau", "Nova"]  # cached phrases are not synthesized again
    assert audio_file("Tchau", "fake") != audio_file("Tchau", "other")


def test_lesson_audio_never_raises(tmp_path):
    class Broken(FakeSynth):
        def mp3(self, text):
            raise TtsUnavailable("sem voz")

    assert lesson_audio(["Oi"], Broken(), tmp_path)["status"] == "unavailable"
    assert lesson_audio(["Oi"], FakeSynth(), tmp_path)["status"] == "ok"


def test_spoken_forms_only_change_what_piper_reads():
    assert spoken("resistor de 470 Ω e 1 kΩ") == "resistor de 470 ohms e 1 quilo-ohms"
    assert audio_file("470 Ω") != audio_file("470 ohms")


@pytest.fixture
def client(tmp_path, monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine)() as db:
        db.add(Teacher(id=1, email="t@example.test", name="Demo"))
        db.commit()

    def session():
        with sessionmaker(bind=engine)() as db:
            yield db

    synth = FakeSynth()
    monkeypatch.setenv("TEDTRONICS_AUDIO_DIR", str(tmp_path))
    monkeypatch.setattr(tts_service, "synthesizer", lambda: synth)
    app.dependency_overrides[get_session] = session
    app.dependency_overrides[current_teacher] = lambda: Teacher(id=1, email="t@example.test", name="Demo")
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_save_stores_audio_and_exports_zip(client, tmp_path):
    saved = client.put("/workspace/lessons/l1", json=doc(audio={"phrases": {"forged": "../x.mp3"}})).json()
    audio = saved["audio"]
    assert audio["status"] == "ok" and "forged" not in audio["phrases"]
    name = audio["phrases"]["Acender um LED"]
    assert client.get(f"/tts/audio/{name}").content == b"ID3Acender um LED"

    z = zipfile.ZipFile(io.BytesIO(client.get("/workspace/lessons/l1/export.zip").content))
    lesson = json.loads(z.read("lesson.json"))
    assert lesson["id"] == "l1" and "missing" not in lesson
    assert {f"audio/{f}" for f in audio["phrases"].values()} | {"lesson.json"} == set(z.namelist())


def test_audio_route_rejects_other_paths(client):
    for name in ["..%2Fsecret.mp3", "abc.mp3", "0" * 64 + ".wav"]:
        assert client.get(f"/tts/audio/{name}").status_code == 404


def test_system_pack_roundtrip(client, tmp_path):
    assert client.get("/tts/system").json()["status"] == "missing"
    assert client.get("/tts/system.zip").status_code == 404
    build_system_pack(FakeSynth(), tmp_path)
    manifest = client.get("/tts/system").json()
    assert manifest["status"] == "ok" and manifest["player"] == PLAYER_PHRASES
    z = zipfile.ZipFile(io.BytesIO(client.get("/tts/system.zip").content))
    assert "system.json" in z.namelist() and len(z.namelist()) == len(set(manifest["phrases"].values())) + 1


@pytest.mark.skipif(not voice_path().exists(), reason="Piper voice not downloaded (tools/fetch_voice.sh)")
def test_real_piper_voice_makes_an_mp3(tmp_path):
    pytest.importorskip("piper")
    pytest.importorskip("lameenc")
    data = PiperSynth().mp3("Muito bem!")
    assert data[:3] == b"ID3" or data[0] == 0xFF  # ID3 tag or MPEG frame sync
    assert len(data) > 2000


def test_player_lines_are_in_the_system_pack():
    """LessonPlayer.tsx's fixed lines must stay in PLAYER_PHRASES, or the preview goes silent for them."""
    player = (Path(__file__).parents[2] / "teacher_authoring_app/src/player/LessonPlayer.tsx").read_text("utf-8")
    from graph_validator.tts.phrases import PRAISE
    for line in PLAYER_PHRASES:
        if line not in ("Agora responda à pergunta.", "Quase! Observe de novo e tente outra vez."):  # steps.py
            assert line in player, line
    assert "const PRAISE = [" + ", ".join(f"'{p}'" for p in PRAISE) + "];" in player
