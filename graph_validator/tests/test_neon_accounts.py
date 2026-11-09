"""One account for the site and the phone: with Neon Auth configured, the site checks passwords there."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from graph_validator.service.app import app
from graph_validator.service.neon_auth import NeonAuthUnavailable, Reply, neon_auth
from graph_validator.service.security import hash_password, verify_password
from graph_validator.service.storage import Base, Teacher, get_session

COOKIE = "__Secure-neon-auth.session_token=abc"


class FakeNeonAuth:
    """Neon Auth stand-in: e-mail → (name, password); sessions are just the e-mail."""

    def __init__(self):
        self.users: dict[str, tuple[str, str]] = {}
        self.down = False
        self.open_sessions = 0
        self.delete_allowed = True

    def _check(self):
        if self.down:
            raise NeonAuthUnavailable("offline")

    def sign_in(self, email, password):
        self._check()
        user = self.users.get(email)
        if not user or user[1] != password:
            return Reply(401, {"code": "INVALID_EMAIL_OR_PASSWORD"}, None)
        self.open_sessions += 1
        return Reply(200, {"user": {"email": email, "name": user[0]}}, f"{COOKIE}|{email}")

    def sign_up(self, email, password, name):
        self._check()
        if email in self.users:
            return Reply(422, {"code": "USER_ALREADY_EXISTS"}, None)
        if len(password) < 8:
            return Reply(400, {"code": "PASSWORD_TOO_SHORT", "message": "Password too short"}, None)
        self.users[email] = (name, password)
        self.open_sessions += 1
        return Reply(200, {"user": {"email": email}}, f"{COOKIE}|{email}")

    def change_password(self, cookie, current, new):
        email = cookie.split("|")[1]
        if self.users[email][1] != current:
            return Reply(400, {"code": "INVALID_PASSWORD"}, None)
        self.users[email] = (self.users[email][0], new)
        return Reply(200, {}, None)

    def delete_user(self, cookie, password):
        if not self.delete_allowed:
            return Reply(400, {"message": "Delete user is disabled"}, None)
        self.users.pop(cookie.split("|")[1], None)
        return Reply(200, {}, None)

    def sign_out(self, cookie):
        self.open_sessions -= 1


@pytest.fixture
def env():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    make = sessionmaker(bind=engine)

    def session():
        with make() as db:
            yield db

    fake = FakeNeonAuth()
    app.dependency_overrides[get_session] = session
    app.dependency_overrides[neon_auth] = lambda: fake
    try:
        yield TestClient(app), fake, make
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def login(client, email, password):
    return client.post("/auth/login", json={"email": email, "password": password})


def test_signup_on_site_creates_the_phone_account_with_the_same_password(env):
    client, fake, _ = env
    response = client.post("/auth/register", json={"name": "Ana", "email": "Ana@Escola.br", "password": "segredo12"})
    assert response.status_code == 201
    assert fake.users["ana@escola.br"] == ("Ana", "segredo12")
    assert login(client, "ana@escola.br", "segredo12").status_code == 200
    assert fake.open_sessions == 0  # the site never keeps Neon Auth sessions open


def test_account_made_on_the_phone_signs_in_on_the_site(env):
    client, fake, make = env
    fake.users["bia@escola.br"] = ("Bia", "celular123")
    assert login(client, "bia@escola.br", "outra-senha").status_code == 401
    response = login(client, " Bia@escola.br ", "celular123")
    assert response.status_code == 200 and response.json()["teacher"]["name"] == "Bia"
    # registering on the site with the phone's password links the same account instead of failing
    fake.users["caio@escola.br"] = ("Caio", "celular123")
    linked = client.post("/auth/register", json={"name": "C", "email": "caio@escola.br", "password": "celular123"})
    assert linked.status_code == 201
    wrong = client.post("/auth/register", json={"name": "D", "email": "caio2@escola.br", "password": "x" * 8})
    assert wrong.status_code == 201


def test_old_site_password_moves_to_neon_or_points_to_the_phone_password(env):
    client, fake, make = env
    with make() as db:
        db.add_all([Teacher(email="velho@escola.br", name="Velho", password_hash=hash_password("antiga123")),
                    Teacher(email="dois@escola.br", name="Dois", password_hash=hash_password("dosite123"))])
        db.commit()
    # no Neon Auth account yet: the site password becomes the one password
    assert login(client, "velho@escola.br", "antiga123").status_code == 200
    assert fake.users["velho@escola.br"][1] == "antiga123"
    # the phone already has another password: that one wins, and the site says so
    fake.users["dois@escola.br"] = ("Dois", "docelular1")
    refused = login(client, "dois@escola.br", "dosite123")
    assert refused.status_code == 401 and "celular" in refused.json()["detail"]
    assert login(client, "dois@escola.br", "docelular1").status_code == 200
    with make() as db:  # the local copy follows, so the site works the same if it falls back to it
        stored = db.scalar(select(Teacher.password_hash).where(Teacher.email == "dois@escola.br"))
        assert verify_password("docelular1", stored)


def test_password_change_reaches_the_phone_and_email_stays(env):
    client, fake, _ = env
    token = client.post("/auth/register", json={"name": "Ana", "email": "ana@escola.br",
                                                "password": "segredo12"}).json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    bad = client.put("/auth/me", headers=headers, json={"name": "Ana", "email": "ana@escola.br",
                                                         "current_password": "errada99", "new_password": "nova12345"})
    assert bad.status_code == 403
    ok = client.put("/auth/me", headers=headers, json={"name": "Ana P", "email": "ana@escola.br",
                                                       "current_password": "segredo12", "new_password": "nova12345"})
    assert ok.status_code == 200 and fake.users["ana@escola.br"][1] == "nova12345"
    moved = client.put("/auth/me", headers=headers, json={"name": "Ana", "email": "outra@escola.br"})
    assert moved.status_code == 409


def test_short_password_rejected_and_neon_outage_is_503(env):
    client, fake, _ = env
    short = client.post("/auth/register", json={"name": "A", "email": "a@escola.br", "password": "1234567"})
    assert short.status_code == 422
    fake.down = True
    assert login(client, "a@escola.br", "qualquer1").status_code == 503


def test_delete_account_removes_the_phone_account_when_allowed(env):
    client, fake, _ = env
    token = client.post("/auth/register", json={"name": "Ana", "email": "ana@escola.br",
                                                "password": "segredo12"}).json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.request("DELETE", "/auth/me", headers=headers, json={"password": "errada99"}).status_code == 403
    assert client.request("DELETE", "/auth/me", headers=headers, json={"password": "segredo12"}).status_code == 204
    assert "ana@escola.br" not in fake.users


def test_config_tells_the_login_screen_where_accounts_live(env):
    client, _, _ = env
    assert client.get("/auth/config").json() == {"database": "sqlite", "accounts": "neon"}
    app.dependency_overrides[neon_auth] = lambda: None
    assert client.get("/auth/config").json()["accounts"] == "local"
