"""Password hashing, bearer tokens and bench session tokens, using only the standard library."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time

PBKDF2_ITERATIONS = 200_000
DEMO_PASSWORD = "tedtronics"


def hash_password(password: str, salt: bytes | None = None, iterations: int = PBKDF2_ITERATIONS) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iterations, salt, digest = stored.split("$")
    except ValueError:
        return False
    if scheme != "pbkdf2_sha256":
        return False
    candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iterations))
    return hmac.compare_digest(candidate.hex(), digest)


def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def bench_secret() -> bytes:
    """Shared with the bench (TEDTRONICS_BENCH_SECRET) so it can check a phone's session offline (SFR57)."""
    return (os.getenv("TEDTRONICS_BENCH_SECRET") or DEV_BENCH_SECRET).encode()


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def sign_bench_token(teacher_id: int, teacher_name: str, ttl_s: int = 12 * 3600, now: float | None = None) -> dict:
    expires = int((now or time.time()) + ttl_s)
    payload = _b64(json.dumps({"tid": teacher_id, "name": teacher_name, "exp": expires}, separators=(",", ":")).encode())
    signature = _b64(hmac.new(bench_secret(), payload.encode(), hashlib.sha256).digest())
    return {"token": f"{payload}.{signature}", "expires_at": expires}


DEV_BENCH_SECRET = "tedtronics-dev-bench-secret"


def bench_secret_is_default() -> bool:
    """True when TEDTRONICS_BENCH_SECRET is unset, so tokens signed with a real server secret cannot verify."""
    return bench_secret() == DEV_BENCH_SECRET.encode()


def check_bench_token(token: str, now: float | None = None) -> tuple[dict | None, str | None]:
    """(payload, None) for a good token, else (None, reason) with reason "malformed", "signature" or "expired"."""
    try:
        payload, signature = token.split(".")
    except ValueError:
        return None, "malformed"
    expected = _b64(hmac.new(bench_secret(), payload.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(expected, signature):
        return None, "signature"
    try:
        data = json.loads(_unb64(payload))
    except ValueError:
        return None, "malformed"
    if not isinstance(data, dict):
        return None, "malformed"
    return (data, None) if data.get("exp", 0) > (now or time.time()) else (None, "expired")


def read_bench_token(token: str, now: float | None = None) -> dict | None:
    """The payload if the signature is valid and the token has not expired, else None."""
    return check_bench_token(token, now)[0]
