"""The production entry point serves the built website and mounts the API under /api."""
import importlib

from fastapi.testclient import TestClient


def test_site_and_api_in_one_service(tmp_path, monkeypatch):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<!doctype html><title>site</title>", encoding="utf-8")
    (tmp_path / "bench.html").write_text("<!doctype html><title>bench</title>", encoding="utf-8")
    (tmp_path / "assets" / "app.js").write_text("console.log(1)", encoding="utf-8")
    monkeypatch.setenv("TEDTRONICS_SITE_DIR", str(tmp_path))
    from graph_validator.service import web

    client = TestClient(importlib.reload(web).app)
    assert client.get("/healthz").json() == {"status": "ok", "site": "ok"}
    assert client.get("/api/health").json() == {"status": "ok"}
    assert "site" in client.get("/turmas/3").text  # website routes load the app shell
    assert "bench" in client.get("/bench.html").text
    assert client.get("/assets/app.js").text == "console.log(1)"
    assert "site" in client.get("/../secret").text  # no way out of the site folder
