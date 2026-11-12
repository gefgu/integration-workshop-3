"""Bench service: framing, the protocol over the WebSocket simulator, and the full sync cycle
server → phone → bench → phone → server, with the student's session in between."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from bench_service.protocol import FrameAssembler, encode_frames
from bench_service.server import NO_STUDENT, create_app
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
                       json={"name": "Caio", "nickname": "caio"}).json()
    # In the app the teacher picks the class, then the student who will use this bench; it goes with the module.
    package = server.get(f"/bench/package/{module.json()['id']}?class_id={turma['id']}&student_id={caio['id']}",
                         headers=teacher).json()
    bench_token = server.post("/bench/session", headers=teacher).json()["token"]

    store = BenchStore(tmp_path / "bench.sqlite3", bench_id="b1")
    bench = TestClient(create_app(store))
    assert bench.post("/login").status_code == 423  # locked until the phone

    with bench.websocket_connect("/ble") as socket:
        phone = Phone(socket)
        assert phone.send({"type": "STATUS"})["code"] == "locked"
        assert phone.send({"type": "HELLO", "token": bench_token + "x", "protocol": 1})["code"] == "bad_token"
        welcome = phone.send({"type": "HELLO", "token": bench_token, "protocol": 1})
        assert welcome["type"] == "WELCOME" and welcome["teacher"]["name"] == "Ana"
        assert bench.post("/login").json()["detail"] == NO_STUDENT  # unlocked, but nobody picked yet
        no_student = {k: v for k, v in package.items() if k != "student"}
        assert phone.send({"type": "LOAD_PACKAGE", "package": no_student})["code"] == "bad_package"
        assert phone.send({"type": "LOAD_PACKAGE", "package": package})["version_id"] == package["version_id"]
        status = phone.send({"type": "STATUS"})
        assert status["package"]["student_nickname"] == "caio"

    login = bench.post("/login").json()
    assert login["student"] == {"id": caio["id"], "uid": caio["uid"], "name": "Caio", "nickname": "caio"}
    assert login["resume"] == {"lesson_id": "l1", "step_idx": 0}

    sid = login["student"]["id"]
    bench.post(f"/students/{sid}/step", json={"lesson_id": "l1", "step_idx": 0})
    # Leaves mid-lesson, comes back at the exact step (SFR37.1)
    assert bench.post("/login").json()["resume"] == {"lesson_id": "l1", "step_idx": 1}
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
        assert all(e["student_id"] == caio["id"] and e["student_uid"] == caio["uid"] for e in events)
        assert all("nfc_code" not in e for e in events)
        synced = server.post("/bench/sync", headers=teacher, json={"bench_id": "b1", "events": events}).json()
        assert synced["inserted"] == 6
        acked = phone.send({"type": "ACK_EVENTS", "event_ids": synced["acked"]})
        assert acked["deleted"] == 6 and acked["pending_events"] == 0

    row = server.get(f"/dashboard/classes/{turma['id']}", headers=teacher).json()["students"][0]
    assert row["lessons_done"] == 1 and row["best_score"] == 90 and row["time_spent_s"] == 400


def test_validator_is_served_offline(tmp_path):
    bench = TestClient(create_app(BenchStore(tmp_path / "b.sqlite3")))
    assert bench.get("/validator/health").json() == {"status": "ok"}


def test_dev_demo_loads_a_package_and_keeps_events_local(tmp_path):
    store = BenchStore(tmp_path / "demo.sqlite3")
    bench = TestClient(create_app(store, dev_unlock=True))
    demo = {
        "format": 1,
        "version_id": "demo-1",
        "module": {"id": 0, "title": "Currículo completo", "description": "", "lesson_ids": ["l1"]},
        "lessons": [lesson("l1", "guided")],
        "student": {"id": 9001, "uid": "demo-ana", "name": "Ana", "nickname": "ana"},
    }
    status = bench.post("/dev/demo", json=demo).json()
    assert status["unlocked"] is True
    assert bench.get("/package").json()["demo"] is True

    login = bench.post("/login")
    assert login.status_code == 200 and login.json()["student"]["nickname"] == "ana"
    saved = bench.post("/students/9001/step", json={"lesson_id": "l1", "step_idx": 0}).json()
    assert saved["resume"]["step_idx"] == 1  # progress is kept on the bench
    assert store.pending_count() == 0  # but nothing is queued for the teacher's server


def test_dev_demo_needs_dev_mode(tmp_path):
    bench = TestClient(create_app(BenchStore(tmp_path / "b.sqlite3")))
    assert bench.post("/dev/demo", json={}).status_code == 404


def test_another_teacher_does_not_inherit_the_loaded_student(tmp_path):
    from graph_validator.service.security import sign_bench_token

    store = BenchStore(tmp_path / "b.sqlite3", bench_id="b1")
    store.load_package({
        "format": 1, "version_id": "v1", "teacher": {"id": 1, "name": "A"}, "class": {"id": 1, "name": "7A"},
        "module": {"id": 1, "title": "Luz", "description": "", "lesson_ids": ["l1"]},
        "lessons": [lesson("l1", "guided")],
        "student": {"id": 1, "uid": "uid-caio", "name": "Caio", "nickname": "caio"},
    })
    bench = TestClient(create_app(store))
    with bench.websocket_connect("/ble") as socket:
        phone = Phone(socket)
        same = phone.send({"type": "HELLO", "token": sign_bench_token(1, "A")["token"], "protocol": 1})
        assert same["package"]["version_id"] == "v1"  # the same teacher keeps the module
        other = phone.send({"type": "HELLO", "token": sign_bench_token(2, "B")["token"], "protocol": 1})
        assert other["package"] is None  # another teacher: the bench waits for their module
    assert bench.post("/login").status_code == 404


def test_a_new_student_takes_the_bench_and_the_previous_one_can_still_leave(tmp_path):
    """The teacher sends the module again with another student: the bench switches, and the student who was
    still on it can finish (their events keep their own id and uid)."""
    store = BenchStore(tmp_path / "b.sqlite3", bench_id="b1")
    base = {"format": 1, "teacher": {"id": 1, "name": "A"}, "class": {"id": 1, "name": "7A"},
            "module": {"id": 1, "title": "Luz", "description": "", "lesson_ids": ["l1"]},
            "lessons": [lesson("l1", "guided")]}
    store.load_package({**base, "version_id": "v1", "student": {"id": 1, "uid": "uid-ana", "name": "Ana",
                                                                 "nickname": "ana"}})
    store.unlock({"id": 1, "name": "A"}, 4_000_000_000)
    bench = TestClient(create_app(store))
    assert bench.post("/login").json()["student"]["nickname"] == "ana"
    store.load_package({**base, "version_id": "v2", "student": {"id": 2, "uid": "uid-bia", "name": "Bia",
                                                                 "nickname": "bia"}})
    assert bench.post("/login").json()["student"]["nickname"] == "bia"
    assert bench.post("/students/1/logout", json={"duration_s": 30}).status_code == 200
    assert bench.post("/students/3/logout", json={"duration_s": 30}).status_code == 404  # never on this bench
    events = store.pending_events()
    assert [(e["student_id"], e["student_uid"]) for e in events] == [(1, "uid-ana")]


# --- camera board (vision pipeline → lesson pieces) ---------------------------------------------

from pathlib import Path  # noqa: E402

from bench_service.vision import VisionSource, to_pieces  # noqa: E402
from graph_validator.adapters.detection import load_board  # noqa: E402

REPO = Path(__file__).resolve().parents[3]


def comp(tipo, metade, linha, colunas, cor="verde"):
    return {"id": f"{tipo}@{metade}{linha}:{colunas[0]}-{colunas[-1]}", "tipo": tipo, "cor": cor,
            "posicao": {"metade": metade, "linha": linha, "colunas": colunas}}


def test_vision_components_become_editor_pieces():
    pieces, unknown = to_pieces({"componentes": [
        comp("led", "C", 0, [2, 3]),
        comp("jumper_longo", "B", 5, [0, 1, 2], "branco"),
        comp("vermelho_2", "C", 0, [0, 1], "vermelho"),
        comp("resistor", "B", 1, [4, 5], "azul"),
        comp("led_ou_buzzer", "B", 1, [2, 3]),
        comp("potenciometro", "C", 3, [6, 7, 8], "amarelo"),
        comp("desconhecido_azul_1", "B", 2, [0], "azul"),
    ]})
    assert [(p["type"], p["a"], p["b"], p["row"]) for p in pieces] == [
        ("led", 3, 4, 0), ("jumper_longo", 1, 3, 11), ("bateria", 1, 2, 0),
    ]
    assert [u["type"] for u in unknown] == ["resistor", "led_ou_buzzer", "potenciometro", "desconhecido_azul_1"]
    assert all(u["reason"] for u in unknown)
    # the validator accepts them as a board
    assert len(load_board({"pieces": pieces})) == 3


class FakeVision:
    def __init__(self):
        self.recalibrated = False

    def state(self):
        return {"available": True, "valid": True, "version": 3, "pieces": [{"id": "x"}], "unknown": []}

    def frame(self):
        return b"\xff\xd8jpeg"

    def recalibrate(self):
        self.recalibrated = True


def test_vision_endpoints(tmp_path):
    off = TestClient(create_app(BenchStore(str(tmp_path / "a.sqlite3"))))
    debug = off.get("/camera-debug")
    assert debug.status_code == 200 and "Diagnóstico da câmera" in debug.text
    assert debug.headers["cache-control"] == "no-store"
    assert off.get("/vision/state").json()["available"] is False
    assert off.get("/vision/frame.jpg").status_code == 404
    fake = FakeVision()
    on = TestClient(create_app(BenchStore(str(tmp_path / "b.sqlite3")), vision=fake))
    assert on.get("/vision/state").json()["version"] == 3
    frame = on.get("/vision/frame.jpg")
    assert frame.headers["content-type"] == "image/jpeg" and frame.content == b"\xff\xd8jpeg"
    assert on.post("/vision/recalibrate").json() == {"ok": True} and fake.recalibrated


def test_vision_source_reads_a_real_photo():
    pytest.importorskip("cv2")
    photo = REPO / "real_img" / "pecas2.jpeg"
    if not photo.exists():
        pytest.skip("photo not in this checkout")
    source = VisionSource(image=str(photo), profile="legacy").start()
    try:
        import time
        deadline = time.time() + 20
        while time.time() < deadline and not source.state()["pieces"]:
            time.sleep(0.2)
        state = source.state()
    finally:
        source.stop()
    assert state["available"] and state["valid"], state["reason"]
    assert ("bateria", 1, 2, 0) in [(p["type"], p["a"], p["b"], p["row"]) for p in state["pieces"]]
    assert source.frame()[:2] == b"\xff\xd8"


def test_overall_ranking_adds_each_students_best_per_challenge(tmp_path):
    store = BenchStore(str(tmp_path / "rank.sqlite3"))
    ana = {"id": 1, "nickname": "ana"}
    bia = {"id": 2, "nickname": "bia"}
    store.add_score(ana, "c1", 60, 30)
    store.add_score(ana, "c1", 90, 40)   # her best on c1 counts, not both
    store.add_score(ana, "c2", 50, 20)
    store.add_score(bia, "c1", 99, 10)
    store.add_score(bia, "c2", 41, 60)
    bench = TestClient(create_app(store))
    overall = bench.get("/ranking/overall").json()
    # tie on 140 points: ana's total time (40 + 20 s) beats bia's (10 + 60 s)
    assert [(r["nickname"], r["score"], r["challenges"]) for r in overall] == [("ana", 140, 2), ("bia", 140, 2)]


def test_service_serves_the_bench_screen(tmp_path):
    ui = tmp_path / "ui"
    (ui / "assets").mkdir(parents=True)
    (ui / "bench.html").write_text("<html>bancada</html>", encoding="utf-8")
    (ui / "assets" / "app.js").write_text("console.log(1)", encoding="utf-8")
    bench = TestClient(create_app(BenchStore(str(tmp_path / "b.sqlite3")), ui_dir=ui))
    assert "bancada" in bench.get("/").text
    assert bench.get("/assets/app.js").status_code == 200
    assert bench.get("/status").status_code == 200  # the API still answers next to the screen
