"""Bench service: framing, the protocol over the WebSocket simulator, and the full sync cycle
server → phone → bench → phone → server, with the student's session in between."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from bench_service.protocol import FrameAssembler, encode_frames
from bench_service.server import NOT_RECOGNIZED, create_app
from bench_service.store import BenchStore
from graph_validator.service.app import app as server_app
from graph_validator.service.storage import Base, get_session


def test_frames_roundtrip_and_interleave():
    big = {"type": "X", "text": "ção" * 200}
    a, b = encode_frames(big, "a", chunk=50), encode_frames({"type": "Y"}, "b")
    assert len(a) > 1 and all(len(f.split("|", 3)[3]) <= 50 for f in a)
    assembler = FrameAssembler()
    assert assembler.push(a[0]) is None
    assert assembler.push(b[0]) == {"type": "Y"}
    for frame in a[1:-1]:
        assert assembler.push(frame) is None
    assert assembler.push(a[-1]) == big
    with pytest.raises(ValueError):
        assembler.push("sem-cabecalho")


@pytest.fixture
def server():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)

    def session():
        with sessionmaker(bind=engine)() as db:
            yield db

    server_app.dependency_overrides[get_session] = session
    try:
        yield TestClient(server_app)
    finally:
        server_app.dependency_overrides.clear()
        engine.dispose()


class Phone:
    """What the teacher app does, over the WebSocket simulator."""

    def __init__(self, socket):
        self.socket, self.assembler, self.n = socket, FrameAssembler(), 0

    def send(self, message: dict) -> dict:
        self.n += 1
        message = {**message, "id": f"q{self.n}"}
        for frame in encode_frames(message, f"p{self.n}", chunk=60):
            self.socket.send_text(frame)
        while True:
            reply = self.assembler.push(self.socket.receive_text())
            if reply is not None:
                assert reply["re"] == message["id"]
                return reply


def lesson(id_, kind):
    return {"version": 3, "id": id_, "title": f"Lição {id_}", "instruction": "Monte", "kind": kind,
            "board": {"cols": 11, "rows": 6, "pieces": []},
            "steps": [{"id": "s1", "action": "place_component"}, {"id": "s2", "action": "place_component"}],
            "quizzes": [], "timeLimitS": 300 if kind == "challenge" else None}


def test_full_cycle(server, tmp_path):
    token = server.post("/auth/register", json={"name": "Ana", "email": "ana@e.test", "password": "segredo1"})
    teacher = {"Authorization": f"Bearer {token.json()['token']}"}
    for id_, kind in (("l1", "guided"), ("l2", "challenge")):
        server.put(f"/workspace/lessons/{id_}", headers=teacher, json=lesson(id_, kind))
    module = server.post("/workspace/modules", headers=teacher, json={"title": "Luz", "lesson_ids": ["l1", "l2"]})
    turma = server.post("/workspace/classes", headers=teacher, json={"name": "7A"}).json()
    server.put(f"/workspace/classes/{turma['id']}/modules", headers=teacher, json={"module_ids": [module.json()["id"]]})
    caio = server.post(f"/workspace/classes/{turma['id']}/students", headers=teacher,
                       json={"name": "Caio", "nickname": "caio", "nfc_code": "TAG-1"}).json()
    package = server.get(f"/bench/package/{module.json()['id']}?class_id={turma['id']}", headers=teacher).json()
    bench_token = server.post("/bench/session", headers=teacher).json()["token"]

    store = BenchStore(tmp_path / "bench.sqlite3", bench_id="b1")
    bench = TestClient(create_app(store))
    assert bench.post("/login", json={"nfc_code": "TAG-1"}).status_code == 423  # locked until the phone

    with bench.websocket_connect("/ble") as socket:
        phone = Phone(socket)
        assert phone.send({"type": "STATUS"})["code"] == "locked"
        assert phone.send({"type": "HELLO", "token": bench_token + "x", "protocol": 1})["code"] == "bad_token"
        welcome = phone.send({"type": "HELLO", "token": bench_token, "protocol": 1})
        assert welcome["type"] == "WELCOME" and welcome["teacher"]["name"] == "Ana"
        assert phone.send({"type": "LOAD_PACKAGE", "package": package})["version_id"] == package["version_id"]

    assert bench.post("/login", json={"nfc_code": "TAG-X"}).json()["detail"] == NOT_RECOGNIZED
    login = bench.post("/login", json={"nfc_code": "TAG-1"}).json()
    assert login["student"]["name"] == "Caio" and login["resume"] == {"lesson_id": "l1", "step_idx": 0}

    sid = login["student"]["id"]
    bench.post(f"/students/{sid}/step", json={"lesson_id": "l1", "step_idx": 0})
    # Leaves mid-lesson, comes back at the exact step (SFR37.1)
    assert bench.post("/login", json={"nfc_code": "TAG-1"}).json()["resume"] == {"lesson_id": "l1", "step_idx": 1}
    done = bench.post(f"/students/{sid}/step", json={"lesson_id": "l1", "step_idx": 1, "lesson_done": True,
                                                     "duration_s": 95}).json()
    assert done["resume"] == {"lesson_id": "l2", "step_idx": 0}
    ranking = bench.post(f"/students/{sid}/score", json={"lesson_id": "l2", "score": 70, "duration_s": 120}).json()
    assert ranking["ranking"][0]["nickname"] == "caio"
    bench.post(f"/students/{sid}/score", json={"lesson_id": "l2", "score": 90, "duration_s": 150})
    assert [r["score"] for r in bench.get("/ranking?lesson_id=l2").json()] == [90]
    bench.post(f"/students/{sid}/logout", json={"duration_s": 400})
    assert store.pending_count() == 6

    with bench.websocket_connect("/ble") as socket:
        phone = Phone(socket)
        phone.send({"type": "HELLO", "token": bench_token, "protocol": 1})
        pulled = phone.send({"type": "PULL_EVENTS", "max": 5})
        assert len(pulled["events"]) == 5 and pulled["remaining"] == 1
        rest = phone.send({"type": "PULL_EVENTS", "max": 50, "after_seq": pulled["events"][-1]["seq"]})["events"]
        assert len(rest) == 1
        events = pulled["events"] + rest
        assert [e["seq"] for e in events] == sorted(e["seq"] for e in events)
        assert all(e["student_id"] == caio["id"] and e["nfc_code"] == "TAG-1" for e in events)
        synced = server.post("/bench/sync", headers=teacher, json={"bench_id": "b1", "events": events}).json()
        assert synced["inserted"] == 6
        acked = phone.send({"type": "ACK_EVENTS", "event_ids": synced["acked"]})
        assert acked["deleted"] == 6 and acked["pending_events"] == 0

    row = server.get(f"/dashboard/classes/{turma['id']}", headers=teacher).json()["students"][0]
    assert row["lessons_done"] == 1 and row["best_score"] == 90 and row["time_spent_s"] == 400


def test_validator_is_served_offline(tmp_path):
    bench = TestClient(create_app(BenchStore(tmp_path / "b.sqlite3")))
    assert bench.get("/validator/health").json() == {"status": "ok"}
