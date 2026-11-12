"""Frame encoding and message handling for the teacher-app protocol (docs/bench-protocol.md).

Mirrors protocol/bench.ts. The handler is transport-agnostic: the WebSocket simulator and the
BLE peripheral (ble.py) feed it the same frames.
"""
from __future__ import annotations

import json
import re
import time
from typing import Any

import logging

from graph_validator.service.security import bench_secret_is_default, check_bench_token

from .store import BenchStore

PROTOCOL_VERSION = 1
DEFAULT_CHUNK = 150
BLE_SERVICE = "7e1d0001-7ed7-4b1c-9a6e-0c1e5f7a0000"
BLE_RX = "7e1d0002-7ed7-4b1c-9a6e-0c1e5f7a0000"
BLE_TX = "7e1d0003-7ed7-4b1c-9a6e-0c1e5f7a0000"


def encode_frames(message: dict[str, Any], msg_id: str, chunk: int = DEFAULT_CHUNK) -> list[str]:
    if "|" in msg_id:
        raise ValueError('msg_id must not contain "|"')
    # ASCII JSON (\uXXXX escapes): one char is one byte, so a frame fits a single BLE notification.
    text = json.dumps(message, ensure_ascii=True, separators=(",", ":"))
    total = max(1, -(-len(text) // chunk))
    return [f"{msg_id}|{i}|{total}|{text[i * chunk:(i + 1) * chunk]}" for i in range(total)]


FRAME_HEADER = re.compile(r"([^|]+)\|(\d+)\|(\d+)\|")


class FrameAssembler:
    """Rebuilds messages from `msgId|i|n|payload` frames.

    `join_continuations` (BLE): a frame larger than the link's MTU goes out as a long (prepared) write, and bless
    hands each piece to the bench as if it were a whole value, ignoring its offset. Writes on one link arrive in
    order, so a piece without a header is the rest of the previous frame: it is appended, and a message whose
    JSON is still cut stays pending for the next piece instead of being dropped.
    """

    def __init__(self, join_continuations: bool = False) -> None:
        self._partial: dict[str, dict[str, Any]] = {}
        self.join_continuations = join_continuations
        self._last: tuple[str, int] | None = None
        self.joined = 0  # continuation pieces appended (logged by ble.py)

    def push(self, frame: str) -> dict[str, Any] | None:
        header = FRAME_HEADER.match(frame)
        if header is None:
            if self.join_continuations and self._last and self._last[0] in self._partial:
                msg_id, i = self._last
                self._partial[msg_id]["parts"][i] += frame
                self.joined += 1
                return self._complete(msg_id)
            raise ValueError(f"Quadro inválido: {frame[:40]}")
        msg_id, i, n = header[1], int(header[2]), int(header[3])
        if n < 1 or not 0 <= i < n:
            raise ValueError(f"Quadro inválido: {frame[:40]}")
        entry = self._partial.get(msg_id)
        if entry is None or entry["total"] != n:
            entry = self._partial[msg_id] = {"total": n, "parts": [None] * n}
        entry["parts"][i] = frame[header.end():]
        self._last = (msg_id, i)
        return self._complete(msg_id)

    def _complete(self, msg_id: str) -> dict[str, Any] | None:
        entry = self._partial[msg_id]
        if any(part is None for part in entry["parts"]):
            return None
        try:
            message = json.loads("".join(entry["parts"]))
        except ValueError:
            if self.join_continuations:
                return None  # the last frame's next long-write piece is still to come
            del self._partial[msg_id]
            raise
        del self._partial[msg_id]
        return message


class Session:
    """One phone connection. The unlock is shared by the bench (store), so the UI sees it too."""

    def __init__(self, store: BenchStore) -> None:
        self.store = store

    def status(self) -> dict[str, Any]:
        return self.store.status()

    def handle(self, message: dict[str, Any]) -> dict[str, Any]:
        re = message.get("id") if isinstance(message, dict) else None
        kind = message.get("type") if isinstance(message, dict) else None
        if kind == "HELLO":
            claims, problem = check_bench_token(str(message.get("token", "")))
            if claims is None:
                return error(re, "bad_token", bad_token_message(problem))
            # Another teacher's module and student must not stay usable in this teacher's session: the bench
            # waits for this teacher's package. Progress already recorded stays queued for its own teacher.
            loaded = self.store.package()
            if loaded and not loaded.get("demo") and (loaded.get("teacher") or {}).get("id") != claims["tid"]:
                self.store.clear_package()
            self.store.unlock({"id": claims["tid"], "name": claims["name"]}, claims["exp"])
            return {"type": "WELCOME", "re": re, **self.status()}
        if not self.store.is_unlocked():
            return error(re, "locked", "Conecte o app do professor primeiro.")
        if kind == "STATUS":
            return {"type": "STATUS", "re": re, **self.status()}
        if kind == "LOAD_PACKAGE":
            package = message.get("package")
            problem = package_problem(package)
            if problem:
                return error(re, "bad_package", problem)
            self.store.load_package(package)
            return {"type": "PACKAGE_OK", "re": re, "version_id": package["version_id"]}
        if kind == "PULL_EVENTS":
            limit = max(1, min(int(message.get("max") or 50), 500))
            after = int(message.get("after_seq") or 0)
            events = self.store.pending_events(limit, after)
            return {"type": "EVENTS", "re": re, "events": events,
                    "remaining": max(0, self.store.pending_count(after) - len(events))}
        if kind == "ACK_EVENTS":
            deleted = self.store.ack_events([str(i) for i in message.get("event_ids") or []])
            return {"type": "ACKED", "re": re, "deleted": deleted, "pending_events": self.store.pending_count()}
        return error(re, "bad_message", f"Mensagem desconhecida: {kind}")


def bad_token_message(problem: str | None) -> str:
    """Why the bench refused the teacher's token, in words that point at the fix (logged on the bench too)."""
    if problem == "signature":
        if bench_secret_is_default():
            text = ("A bancada está sem o segredo configurado (TEDTRONICS_BENCH_SECRET), então não reconhece a "
                    "sessão do professor. Coloque na bancada o mesmo segredo do servidor e reinicie o serviço.")
        else:
            text = ("O segredo da bancada (TEDTRONICS_BENCH_SECRET) é diferente do segredo do servidor, então ela "
                    "não reconhece a sessão do professor. Use o mesmo valor nos dois e reinicie o serviço da bancada.")
    elif problem == "expired":
        text = ("A sessão do professor chegou vencida na bancada. Confira se o relógio da bancada está certo "
                "(data e hora) e tente conectar de novo.")
    else:
        text = "Sessão do professor inválida. Entre de novo no app."
    logging.getLogger(__name__).warning("HELLO recusado (%s): %s", problem, text)
    return text


def error(re: str | None, code: str, text: str) -> dict[str, Any]:
    return {"type": "ERROR", "re": re, "code": code, "message": text}


def package_problem(package: Any) -> str | None:
    if not isinstance(package, dict):
        return "Pacote ausente."
    for key in ("version_id", "module", "class", "lessons", "student", "teacher"):
        if key not in package:
            return f"Pacote sem o campo {key}."
    if not package["lessons"]:
        return "Pacote sem lições."
    return student_problem(package["student"])


def student_problem(student: Any) -> str | None:
    """The package names the one student the teacher picked for this bench."""
    if not isinstance(student, dict):
        return "Pacote sem o aluno escolhido pelo professor."
    if not isinstance(student.get("id"), int) or not str(student.get("uid") or "").strip():
        return "Aluno do pacote sem id ou uid."
    if not str(student.get("nickname") or "").strip():
        return "Aluno do pacote sem apelido."
    return None


def now() -> float:
    return time.time()
