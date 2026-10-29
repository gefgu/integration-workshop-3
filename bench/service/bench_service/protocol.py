"""Frame encoding and message handling for the teacher-app protocol (docs/bench-protocol.md).

Mirrors protocol/bench.ts. The handler is transport-agnostic: the WebSocket simulator and the
BLE peripheral (ble.py) feed it the same frames.
"""
from __future__ import annotations

import json
import time
from typing import Any

from graph_validator.service.security import read_bench_token

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


class FrameAssembler:
    def __init__(self) -> None:
        self._partial: dict[str, dict[str, Any]] = {}

    def push(self, frame: str) -> dict[str, Any] | None:
        try:
            msg_id, idx, total, payload = frame.split("|", 3)
            i, n = int(idx), int(total)
        except ValueError as error:
            raise ValueError(f"Quadro inválido: {frame[:40]}") from error
        if not msg_id or n < 1 or not 0 <= i < n:
            raise ValueError(f"Quadro inválido: {frame[:40]}")
        entry = self._partial.get(msg_id)
        if entry is None or entry["total"] != n:
            entry = self._partial[msg_id] = {"total": n, "parts": [None] * n}
        entry["parts"][i] = payload
        if any(part is None for part in entry["parts"]):
            return None
        del self._partial[msg_id]
        return json.loads("".join(entry["parts"]))


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
            claims = read_bench_token(str(message.get("token", "")))
            if claims is None:
                return error(re, "bad_token", "Sessão do professor inválida ou expirada. Entre de novo no app.")
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


def error(re: str | None, code: str, text: str) -> dict[str, Any]:
    return {"type": "ERROR", "re": re, "code": code, "message": text}


def package_problem(package: Any) -> str | None:
    if not isinstance(package, dict):
        return "Pacote ausente."
    for key in ("version_id", "module", "class", "lessons", "students", "teacher"):
        if key not in package:
            return f"Pacote sem o campo {key}."
    if not package["lessons"]:
        return "Pacote sem lições."
    return None


def now() -> float:
    return time.time()
