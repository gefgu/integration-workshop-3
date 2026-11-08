"""Physical controls: the ESP32 (joystick + Energizar) talks to the Pi over the GPIO serial port.

    ESP32 -> Pi   HELLO controles 1 | KEY <id> UP|DOWN|LEFT|RIGHT|OK|MENU|VOLTAR|ENERGIZAR | PONG <n>
    Pi -> ESP32   ACK <id> | PING <n> | HELLO?

115200 8N1, ASCII lines ending in "\\n" (firmware/esp32/bench_controls). Each KEY becomes a key name the bench
screen already understands (arrows, Enter, Escape, "e"); the screen receives them on the /controls WebSocket.
The serial thread reconnects on its own, so unplugging the ESP32 never stops the bench.
"""
from __future__ import annotations

import logging
import threading
import time
from collections import deque
from typing import Callable

log = logging.getLogger("bench.controls")

# serial name -> KeyboardEvent.key on the bench screen
KEYS = {
    "UP": "ArrowUp",
    "DOWN": "ArrowDown",
    "LEFT": "ArrowLeft",
    "RIGHT": "ArrowRight",
    "OK": " ",  # joystick click: confirm the selected choice (Enter is Energizar on the bench screen)
    "MENU": "Escape",  # long press on the joystick: the bench screen's game menu
    "VOLTAR": "ArrowLeft",  # a dedicated Back button, if the bench gets one
    "ENERGIZAR": "Enter",  # the dedicated Energizar button (GPIO32); for now the PC keyboard's Enter
}
MAX_LINE = 63
PING_EVERY_S = 2.0
LINK_TIMEOUT_S = 5.0


def parse_line(line: str) -> tuple[str, ...] | None:
    """('key', id, key) | ('hello', version) | ('pong', n) | None for anything malformed."""
    fields = line.strip().split()
    if len(fields) == 3 and fields[0] == "KEY" and fields[1].isdigit() and fields[2] in KEYS:
        return ("key", fields[1], KEYS[fields[2]])
    if len(fields) == 3 and fields[0] == "HELLO" and fields[1] == "controles":
        return ("hello", fields[2])
    if len(fields) == 2 and fields[0] == "PONG" and fields[1].isdigit():
        return ("pong", fields[1])
    return None


class ControlsHub:
    """Keeps the last key presses with a sequence number, for the screen's WebSocket to follow."""

    def __init__(self, keep: int = 64) -> None:
        self._events: deque[dict] = deque(maxlen=keep)
        self._seq = 0
        self._lock = threading.Lock()
        self.connected = False
        self.port: str | None = None
        self.last_seen = 0.0

    def push(self, key: str) -> dict:
        with self._lock:
            self._seq += 1
            event = {"seq": self._seq, "key": key, "at": time.time()}
            self._events.append(event)
            return event

    @property
    def seq(self) -> int:
        with self._lock:
            return self._seq

    def since(self, seq: int) -> list[dict]:
        with self._lock:
            return [event for event in self._events if event["seq"] > seq]

    def state(self) -> dict:
        return {"port": self.port, "connected": self.connected, "seq": self.seq}


class SerialControls:
    """Reads the ESP32 on `port` in a daemon thread and feeds `hub`. Needs pyserial (extra `controls`)."""

    def __init__(self, port: str, hub: ControlsHub, baud: int = 115200,
                 opener: Callable[..., object] | None = None) -> None:
        self.port = port
        self.hub = hub
        self.baud = baud
        self._opener = opener
        self._stop = threading.Event()
        hub.port = port

    def start(self) -> "SerialControls":
        threading.Thread(target=self._run, name="bench-controls", daemon=True).start()
        return self

    def stop(self) -> None:
        self._stop.set()

    def _open(self):
        if self._opener:
            return self._opener(self.port, self.baud)
        import serial  # pyserial

        # DTR/RTS stay low: on a USB ESP32 board they are wired to reset/boot, so toggling them reboots it.
        link = serial.Serial(None, self.baud, timeout=0.1, write_timeout=1)
        link.port = self.port
        link.dtr = False
        link.rts = False
        link.open()
        return link

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                with self._open() as link:
                    log.info("controls: %s open", self.port)
                    self._serve(link)
            except Exception as error:  # unplugged, permission, port missing: retry quietly
                if self.hub.connected:
                    log.warning("controls: %s lost (%s)", self.port, error)
                self.hub.connected = False
                self._stop.wait(2.0)

    def _serve(self, link) -> None:
        buffer = bytearray()
        discarding = False
        ping = 0
        next_ping = 0.0
        link.write(b"HELLO?\n")
        while not self._stop.is_set():
            now = time.monotonic()
            if now >= next_ping:
                ping += 1
                link.write(f"PING {ping}\n".encode("ascii"))
                next_ping = now + PING_EVERY_S
            if self.hub.connected and now - self.hub.last_seen > LINK_TIMEOUT_S:
                self.hub.connected = False
                log.warning("controls: no reply from the ESP32 on %s", self.port)
            for byte in link.read(64) or b"":
                if byte == 0x0A:  # newline
                    if not discarding and buffer:
                        self._handle(link, buffer.decode("ascii", "replace"))
                    buffer.clear()
                    discarding = False
                elif byte == 0x0D:
                    continue
                elif discarding or len(buffer) >= MAX_LINE:
                    discarding = True
                else:
                    buffer.append(byte)

    def _handle(self, link, line: str) -> None:
        message = parse_line(line)
        if message is None:
            return
        self.hub.last_seen = time.monotonic()
        self.hub.connected = True
        if message[0] == "key":
            link.write(f"ACK {message[1]}\n".encode("ascii"))
            self.hub.push(message[2])
