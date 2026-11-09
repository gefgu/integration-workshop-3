"""Neon Auth (Better Auth) as the one password store for the site and the phone app.

When TEDTRONICS_NEON_AUTH_URL is set (e.g. https://ep-xxx.neonauth.<region>.aws.neon.tech/neondb/auth), the site's
sign-in, sign-up and password change go through Neon Auth, the same accounts the phone app (Neon build) uses, so a
teacher has a single e-mail and password everywhere. Without it the API keeps its own password hashes (local SQLite).
"""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from dataclasses import dataclass

# Neon Auth rejects calls without an Origin; localhost is always trusted (the phone app sends the same).
ORIGIN = "http://localhost"
SESSION_COOKIE = re.compile(r"__Secure-neon-auth\.session_token=[^;,\s]+")
MIN_PASSWORD = 8


class NeonAuthUnavailable(Exception):
    """Neon Auth could not be reached or answered with a server error."""


@dataclass
class Reply:
    status: int
    body: dict
    cookie: str | None

    @property
    def code(self) -> str:
        return str(self.body.get("code") or "")


class NeonAuth:
    def __init__(self, url: str, timeout_s: float = 10.0) -> None:
        self.url = url.rstrip("/")
        self.timeout_s = timeout_s

    def _post(self, path: str, body: dict, cookie: str | None = None) -> Reply:
        headers = {"Content-Type": "application/json", "Origin": ORIGIN}
        if cookie:
            headers["Cookie"] = cookie
        request = urllib.request.Request(f"{self.url}{path}", data=json.dumps(body).encode(), headers=headers,
                                         method="POST")
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_s) as response:
                status, raw, set_cookie = response.status, response.read(), response.headers.get_all("Set-Cookie")
        except urllib.error.HTTPError as error:
            status, raw, set_cookie = error.code, error.read(), error.headers.get_all("Set-Cookie")
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            raise NeonAuthUnavailable(str(error)) from error
        if status >= 500:
            raise NeonAuthUnavailable(f"HTTP {status}")
        try:
            data = json.loads(raw or b"{}")
        except ValueError:
            data = {}
        match = SESSION_COOKIE.search(", ".join(set_cookie or []))
        return Reply(status, data if isinstance(data, dict) else {}, match.group(0) if match else None)

    def sign_in(self, email: str, password: str) -> Reply:
        return self._post("/sign-in/email", {"email": email, "password": password})

    def sign_up(self, email: str, password: str, name: str) -> Reply:
        return self._post("/sign-up/email", {"email": email, "password": password, "name": name})

    def change_password(self, cookie: str, current: str, new: str) -> Reply:
        return self._post("/change-password", {"currentPassword": current, "newPassword": new,
                                               "revokeOtherSessions": False}, cookie)

    def delete_user(self, cookie: str, password: str) -> Reply:
        return self._post("/delete-user", {"password": password}, cookie)

    def sign_out(self, cookie: str) -> None:
        try:
            self._post("/sign-out", {}, cookie)
        except NeonAuthUnavailable:
            pass


def neon_auth() -> NeonAuth | None:
    url = os.getenv("TEDTRONICS_NEON_AUTH_URL", "").strip()
    return NeonAuth(url) if url else None
