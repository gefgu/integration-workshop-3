import json

import pytest
from fastapi.testclient import TestClient

from graph_validator.cli import main
from graph_validator.service.app import app

from helpers import loop

client = TestClient(app)

TEACHER = {
    "version": 1, "id": "lesson-1", "title": "Acender um LED", "instruction": "", "kind": "guided",
    "board": {"cols": 11, "rows": 12, "pieces": [p.model_dump(exclude_none=True) for p in loop()]},
    "quizzes": [], "updatedAt": "2026-10-05T00:00:00Z",
}


def camera(skip=None):
    comps = [
        {"id": "bat", "type": "bateria", "terminals": {"+": {"col": 1, "row": 0}, "-": {"col": 2, "row": 0}}},
        {"id": "r", "type": "resistor_470", "terminals": {"x": {"col": 2, "row": 1}, "y": {"col": 3, "row": 1}}},
        {"id": "led", "type": "led", "terminals": {"anode": {"col": 3, "row": 2}, "cathode": {"col": 4, "row": 2}}},
        {"id": "j", "type": "jumper_longo", "terminals": {"a": {"col": 4, "row": 3}, "b": {"col": 2, "row": 3}}},
    ]
    return {"components": [c for c in comps if c["id"] != skip]}


def lesson():
    r = client.post("/lessons/import-teacher", json=TEACHER)
    assert r.status_code == 200
    return r.json()


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_final_complete_and_missing_jumper():
    l = lesson()
    ok = client.post("/validate/final", json={"lesson": l, "board": camera()}).json()
    assert ok["approved"] and ok["category"] == "complete"
    bad = client.post("/validate/final", json={"lesson": l, "board": camera(skip="j")}).json()
    assert not bad["approved"] and bad["category"] == "missing_connection" and bad["hint"]


def test_hint_suppressed_when_graph_unchanged():
    l = lesson()
    first = client.post("/validate/final", json={"lesson": l, "board": camera(skip="j")}).json()
    again = client.post("/validate/final", json={"lesson": l, "board": camera(skip="j"), "previous_graph_hash": first["graph_hash"]}).json()
    assert again["hint"] is None and not again["approved"]


def test_invalid_board_is_422():
    l = lesson()
    board = camera()
    board["components"].append({"id": "x", "type": "led", "terminals": {"anode": {"col": 99, "row": 0}, "cathode": {"col": 100, "row": 0}}})
    r = client.post("/validate/final", json={"lesson": l, "board": board})
    assert r.status_code == 422 and r.json()["detail"]["error"] == "invalid_board"


def test_lint_endpoint():
    assert client.post("/lessons/lint", json={"lesson": None}).status_code == 422
    assert client.post("/lessons/lint", json=lesson()).json() == {"problems": [], "byStep": []}


def test_lint_by_step_pins_error_to_step():
    l = lesson()
    l["kind"] = "guided"
    l["steps"] = [{"id": "s1", "action": "place_component", "pieces": l["steps"][0]["pieces"]}]  # 4 pieces at once
    out = client.post("/lessons/lint", json=l).json()
    assert out["byStep"][0]["stepId"] == "s1" and "exactly one action" in out["byStep"][0]["message"]
    assert out["problems"][0].startswith("step 1 (s1):")


def test_feedback_catalog():
    r = client.get("/feedback/categories").json()
    cats = {c["category"]: c["defaultMessage"] for c in r["categories"]}
    assert set(cats) >= {"complete", "reversed_polarity", "missing_connection"} and all(cats.values())
    assert {"family": "led", "name": "o LED"} in r["families"]


def test_cli_roundtrip(tmp_path, capsys):
    lp, bp = tmp_path / "l.json", tmp_path / "b.json"
    lp.write_text(json.dumps(TEACHER)); bp.write_text(json.dumps(camera()))
    assert main(["validate", str(lp), str(bp), "--teacher"]) == 0
    bp.write_text(json.dumps(camera(skip="j")))
    assert main(["validate", str(lp), str(bp), "--teacher"]) == 1
    assert "missing_connection" in capsys.readouterr().out


def test_empty_board_is_a_valid_board():
    l = lesson()
    for board in ({"pieces": []}, {"components": []}):
        r = client.post("/validate/final", json={"lesson": l, "board": board})
        assert r.status_code == 200
        assert r.json()["category"] in ("missing_component", "missing_connection") and not r.json()["approved"]
