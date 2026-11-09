"""HELLO refusals say why: a bench secret that differs from the server's, a bench with no secret, or a stale clock."""
from graph_validator.service import security
from graph_validator.service.security import check_bench_token, sign_bench_token

from bench_service.protocol import Session
from bench_service.store import BenchStore


def hello(tmp_path, token):
    return Session(BenchStore(str(tmp_path / "bench.sqlite3"))).handle({"id": "h1", "type": "HELLO", "token": token})


def test_check_bench_token_reasons():
    token = sign_bench_token(7, "Ana", ttl_s=10, now=1000)["token"]
    assert check_bench_token(token, now=1005)[0]["tid"] == 7
    assert check_bench_token(token, now=2000) == (None, "expired")
    assert check_bench_token(token + "x", now=1005) == (None, "signature")
    assert check_bench_token("sem-ponto") == (None, "malformed")


def test_hello_reports_secret_mismatch(tmp_path, monkeypatch):
    monkeypatch.setenv("TEDTRONICS_BENCH_SECRET", "segredo-do-servidor")
    token = sign_bench_token(7, "Ana")["token"]
    monkeypatch.setenv("TEDTRONICS_BENCH_SECRET", "outro-segredo")
    reply = hello(tmp_path, token)
    assert reply["code"] == "bad_token" and "diferente do segredo do servidor" in reply["message"]


def test_hello_reports_missing_secret(tmp_path, monkeypatch):
    monkeypatch.setenv("TEDTRONICS_BENCH_SECRET", "segredo-do-servidor")
    token = sign_bench_token(7, "Ana")["token"]
    monkeypatch.delenv("TEDTRONICS_BENCH_SECRET")
    assert security.bench_secret_is_default()
    assert "sem o segredo configurado" in hello(tmp_path, token)["message"]


def test_hello_reports_expired_token(tmp_path):
    token = sign_bench_token(7, "Ana", ttl_s=1, now=1000)["token"]
    assert "relógio da bancada" in hello(tmp_path, token)["message"]


def test_hello_accepts_good_token(tmp_path):
    assert hello(tmp_path, sign_bench_token(7, "Ana")["token"])["type"] == "WELCOME"
