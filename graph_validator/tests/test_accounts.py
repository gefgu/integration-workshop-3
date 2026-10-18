"""Teacher accounts, modules, NFC tags, bench sync and the dashboard, over HTTP with real tokens."""
import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from graph_validator.service.app import app
from graph_validator.service.security import (
    hash_password, read_bench_token, sign_bench_token, verify_password,
)
from graph_validator.service.storage import Base, get_session


@pytest.fixture
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _record):
        connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)

    def session():
        with sessionmaker(bind=engine)() as db:
            yield db

    app.dependency_overrides[get_session] = session
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def signup(client, email="ana@escola.test", name="Ana"):
    response = client.post("/auth/register", json={"name": name, "email": email, "password": "segredo1"})
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def lesson(id_, kind="guided"):
    return {"version": 3, "id": id_, "title": f"Lição {id_}", "instruction": "Monte", "kind": kind,
            "board": {"cols": 11, "rows": 6, "pieces": []}, "steps": [{"id": "s1", "action": "place_component"}],
            "quizzes": [], "timeLimitS": None}


def ev(student_id, nfc, kind, **kw):
    return {"event_id": str(uuid.uuid4()), "student_id": student_id, "nfc_code": nfc, "kind": kind,
            "seq": kw.pop("seq", 1), "at": kw.pop("at", datetime.now(timezone.utc).isoformat()), **kw}


def test_password_and_bench_token_helpers():
    stored = hash_password("abc123", iterations=1000)
    assert verify_password("abc123", stored) and not verify_password("abc124", stored)
    assert not verify_password("x", "")
    token = sign_bench_token(7, "Ana", ttl_s=60, now=1000)["token"]
    assert read_bench_token(token, now=1010)["tid"] == 7
    assert read_bench_token(token, now=2000) is None
    assert read_bench_token(token.replace(".", ".x"), now=1010) is None


def test_auth_flow(client):
    assert client.get("/workspace/classes").status_code == 401
    headers = signup(client)
    assert client.post("/auth/register", json={"name": "B", "email": "ANA@escola.test",
                                               "password": "segredo1"}).status_code == 409
    assert client.post("/auth/register", json={"name": "B", "email": "sem-arroba",
                                               "password": "segredo1"}).status_code == 422
    assert client.get("/auth/me", headers=headers).json()["email"] == "ana@escola.test"
    assert client.post("/auth/login", json={"email": "ana@escola.test", "password": "errada"}).status_code == 401
    login = client.post("/auth/login", json={"email": " Ana@Escola.test ", "password": "segredo1"})
    assert login.status_code == 200

    changed = client.put("/auth/me", headers=headers, json={"name": "Ana Paula", "email": "ana@escola.test",
                                                            "current_password": "segredo1",
                                                            "new_password": "novasenha"})
    assert changed.json()["name"] == "Ana Paula"
    assert client.post("/auth/login", json={"email": "ana@escola.test", "password": "novasenha"}).status_code == 200
    assert client.put("/auth/me", headers=headers, json={"name": "A", "email": "ana@escola.test",
                                                         "current_password": "errada",
                                                         "new_password": "outra123"}).status_code == 403

    client.post("/auth/logout", headers=headers)
    assert client.get("/auth/me", headers=headers).status_code == 401


def test_teachers_only_see_their_own_data(client):
    ana, bia = signup(client), signup(client, "bia@escola.test", "Bia")
    turma = client.post("/workspace/classes", headers=ana, json={"name": "7A"}).json()
    client.put("/workspace/lessons/l1", headers=ana, json=lesson("l1"))
    assert client.get("/workspace/classes", headers=bia).json() == []
    assert client.get(f"/workspace/classes/{turma['id']}", headers=bia).status_code == 404
    assert client.get("/workspace/lessons", headers=bia).json() == []
    assert client.put("/workspace/lessons/l1", headers=bia, json=lesson("l1")).status_code == 404
    assert client.post("/workspace/modules", headers=bia, json={"title": "M", "lesson_ids": ["l1"]}).status_code == 404


def test_lesson_shape_is_checked(client):
    ana = signup(client)
    bad = {**lesson("x"), "kind": "outro"}
    assert client.put("/workspace/lessons/x", headers=ana, json=bad).status_code == 422
    bad = {**lesson("x"), "steps": [{"action": "place_component"}]}
    assert client.put("/workspace/lessons/x", headers=ana, json=bad).status_code == 422


def test_modules_crud_and_class_assignment(client):
    ana = signup(client)
    for id_ in ("a", "b", "c"):
        client.put(f"/workspace/lessons/{id_}", headers=ana, json=lesson(id_))
    module = client.post("/workspace/modules", headers=ana,
                         json={"title": "Eletricidade básica", "lesson_ids": ["a", "b"]}).json()
    assert module["lesson_ids"] == ["a", "b"]
    assert client.post("/workspace/modules", headers=ana,
                       json={"title": "Dup", "lesson_ids": ["a", "a"]}).status_code == 422
    reordered = client.put(f"/workspace/modules/{module['id']}/lessons", headers=ana,
                           json={"lesson_ids": ["c", "a"]}).json()
    assert reordered["lesson_ids"] == ["c", "a"]
    edited = client.put(f"/workspace/modules/{module['id']}", headers=ana,
                        json={"title": "Circuitos", "description": "LEDs"}).json()
    assert edited["title"] == "Circuitos" and edited["lesson_ids"] == ["c", "a"]

    turma = client.post("/workspace/classes", headers=ana, json={"name": "7A"}).json()
    client.put(f"/workspace/classes/{turma['id']}/modules", headers=ana, json={"module_ids": [module["id"]]})
    assert client.get(f"/workspace/classes/{turma['id']}", headers=ana).json()["module_ids"] == [module["id"]]
    assert client.get(f"/workspace/modules/{module['id']}", headers=ana).json()["class_ids"] == [turma["id"]]

    assert client.delete("/workspace/lessons/a", headers=ana).status_code == 409
    assert client.delete("/workspace/lessons/b", headers=ana).status_code == 204
    assert client.delete(f"/workspace/modules/{module['id']}", headers=ana).status_code == 204
    assert client.get(f"/workspace/classes/{turma['id']}", headers=ana).json()["module_ids"] == []
    assert client.delete("/workspace/lessons/a", headers=ana).status_code == 204


def test_tags_link_unlink_keeps_history_and_audit(client):
    ana = signup(client)
    turma = client.post("/workspace/classes", headers=ana, json={"name": "7A"}).json()
    outra = client.post("/workspace/classes", headers=ana, json={"name": "7B"}).json()
    s1 = client.post(f"/workspace/classes/{turma['id']}/students", headers=ana,
                     json={"name": "Caio", "nickname": "caio", "nfc_code": "TAG-1"}).json()
    s2 = client.post(f"/workspace/classes/{turma['id']}/students", headers=ana,
                     json={"name": "Duda", "nickname": "duda"}).json()

    assert client.post(f"/workspace/students/{s2['id']}/tag", headers=ana,
                       json={"nfc_code": "TAG-1"}).status_code == 409
    assert client.post(f"/workspace/students/{s1['id']}/tag", headers=ana,
                       json={"nfc_code": "TAG-9"}).status_code == 409

    client.post("/bench/sync", headers=ana, json={"bench_id": "b1", "events": [
        ev(s1["id"], "TAG-1", "lesson_done", lesson_id="l1", duration_s=60)]})
    assert client.delete(f"/workspace/students/{s1['id']}/tag", headers=ana).json()["nfc_code"] is None
    assert client.delete(f"/workspace/students/{s1['id']}/tag", headers=ana).status_code == 409
    relinked = client.post(f"/workspace/students/{s1['id']}/tag", headers=ana, json={"nfc_code": "TAG-2"}).json()
    assert relinked["nfc_code"] == "TAG-2"
    history = client.get(f"/workspace/students/{s1['id']}/tag-history", headers=ana).json()
    assert [(h["action"], h["nfc_code"]) for h in history] == [("link", "TAG-2"), ("unlink", "TAG-1"),
                                                              ("link", "TAG-1")]
    # SAR3: the old tag's progress still belongs to the student
    assert client.get(f"/dashboard/students/{s1['id']}", headers=ana).json()["events"][0]["kind"] == "lesson_done"

    moved = client.put(f"/workspace/students/{s2['id']}", headers=ana,
                       json={"name": "Duda", "nickname": "duda", "nfc_code": "TAG-1", "class_id": outra["id"]})
    assert moved.json()["class_id"] == outra["id"] and moved.json()["nfc_code"] == "TAG-1"
    everyone = client.get("/workspace/students", headers=ana).json()
    assert {s["class_name"] for s in everyone} == {"7A", "7B"}
    assert len(client.get(f"/workspace/students?class_id={outra['id']}", headers=ana).json()) == 1


def test_bench_package_sync_is_idempotent_and_dashboard(client):
    ana, bia = signup(client), signup(client, "bia@escola.test", "Bia")
    for id_, kind in (("l1", "guided"), ("l2", "challenge")):
        client.put(f"/workspace/lessons/{id_}", headers=ana, json=lesson(id_, kind))
    module = client.post("/workspace/modules", headers=ana, json={"title": "M1", "lesson_ids": ["l1", "l2"]}).json()
    turma = client.post("/workspace/classes", headers=ana, json={"name": "7A"}).json()
    client.put(f"/workspace/classes/{turma['id']}/modules", headers=ana, json={"module_ids": [module["id"]]})
    caio = client.post(f"/workspace/classes/{turma['id']}/students", headers=ana,
                       json={"name": "Caio", "nickname": "caio", "nfc_code": "TAG-1"}).json()
    client.post(f"/workspace/classes/{turma['id']}/students", headers=ana,
                json={"name": "Sem Tag", "nickname": "st"})

    session = client.post("/bench/session", headers=ana).json()
    assert read_bench_token(session["token"])["tid"] == session["teacher"]["id"]

    package = client.get(f"/bench/package/{module['id']}?class_id={turma['id']}", headers=ana).json()
    assert [l["id"] for l in package["lessons"]] == ["l1", "l2"]
    assert [s["nickname"] for s in package["students"]] == ["caio"]
    assert all("audio" not in l and l["lessonVersion"] for l in package["lessons"])
    again = client.get(f"/bench/package/{module['id']}?class_id={turma['id']}", headers=ana).json()
    assert again["version_id"] == package["version_id"]
    assert client.get(f"/bench/package/{module['id']}?class_id={turma['id']}", headers=bia).status_code == 404

    events = [
        ev(caio["id"], "TAG-1", "step_done", lesson_id="l1", step_idx=0, seq=1),
        ev(caio["id"], "TAG-1", "lesson_done", lesson_id="l1", duration_s=120, seq=2),
        ev(caio["id"], "TAG-1", "challenge_score", lesson_id="l2", score=80, duration_s=90, seq=3),
        ev(caio["id"], "TAG-1", "session", duration_s=300, seq=4),
    ]
    first = client.post("/bench/sync", headers=ana, json={"bench_id": "b1", "events": events}).json()
    assert first["inserted"] == 4 and len(first["acked"]) == 4
    second = client.post("/bench/sync", headers=ana, json={"bench_id": "b1", "events": events}).json()
    assert second["inserted"] == 0 and sorted(second["acked"]) == sorted(first["acked"])
    stranger = client.post("/bench/sync", headers=bia, json={"bench_id": "b2", "events": [
        ev(caio["id"], "TAG-1", "session", duration_s=5)]}).json()
    assert stranger["inserted"] == 0 and len(stranger["rejected"]) == 1
    assert client.post("/bench/sync", headers=ana, json={"bench_id": "b1", "events": [
        {**ev(caio["id"], "TAG-1", "session"), "nfc_code": ""}]}).status_code == 422

    board = client.get(f"/dashboard/classes/{turma['id']}", headers=ana).json()
    row = next(r for r in board["students"] if r["student"]["id"] == caio["id"])
    assert row["lessons_done"] == 1 and row["lessons_total"] == 2 and row["progress"] == 0.5
    assert row["best_score"] == 80 and row["time_spent_s"] == 300
    assert board["summary"]["students"] == 2
    detail = client.get(f"/dashboard/students/{caio['id']}", headers=ana).json()
    assert [l["status"] for l in detail["lessons"]] == ["done", "in_progress"]
    assert detail["lessons"][0]["steps_done"] == 1 and detail["lessons"][1]["best_score"] == 80
    assert client.get(f"/dashboard/classes/{turma['id']}", headers=bia).status_code == 404


def test_delete_account_removes_owned_data(client):
    ana = signup(client)
    client.put("/workspace/lessons/l1", headers=ana, json=lesson("l1"))
    turma = client.post("/workspace/classes", headers=ana, json={"name": "7A"}).json()
    client.put(f"/workspace/classes/{turma['id']}/lessons", headers=ana, json={"lesson_ids": ["l1"]})
    client.post("/workspace/modules", headers=ana, json={"title": "M", "lesson_ids": ["l1"]})
    assert client.request("DELETE", "/auth/me", headers=ana, json={"password": "errada"}).status_code == 403
    assert client.request("DELETE", "/auth/me", headers=ana, json={"password": "segredo1"}).status_code == 204
    assert client.post("/auth/login", json={"email": "ana@escola.test", "password": "segredo1"}).status_code == 401
    signup(client)  # the e-mail is free again
