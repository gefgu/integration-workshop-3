"""Physical controls: the ESP32 (joystick + Energizar) talks to the Pi over the GPIO serial port.

    ESP32 -> Pi   HELLO controles 1 | KEY <id> UP|DOWN|LEFT|RIGHT|OK|MENU|VOLTAR|ENERGIZAR | PONG <n>
    Pi -> ESP32   ACK <id> | PING <n> | HELLO?

115200 8N1, ASCII lines ending in "\\n" (firmware/esp32/bench_controls). Each KEY becomes a key name the bench
screen already understands (arrows, Enter, Escape, "e"); the screen receives them on the /controls WebSocket.
The serial thread reconnects on its own, so unplugging the ESP32 never stops the bench.

Port "auto" finds the ESP32 by itself: the USB cable (/dev/ttyUSB*, /dev/ttyACM*, COMx) or the GPIO UART
(/dev/serial0). Each candidate is opened in turn and kept only if it answers like the controls firmware.
"""
from __future__ import annotations

import glob
import logging
import os
import sys
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
AUTO = "auto"
PROBE_S = 4.0  # auto mode: a port that says nothing like the controls firmware in this time is not the ESP32


class NotTheControls(Exception):
    """Auto mode: the open port never answered like the ESP32 controls."""


def candidate_ports() -> list[str]:
    """Serial ports the ESP32 may be on: USB first (the usual cable), then the Pi's GPIO UART."""
    found: list[str] = []
    try:
        from serial.tools import list_ports

        found += [info.device for info in list_ports.comports() if info.vid is not None]  # USB adapters only
    except Exception:  # pyserial missing or no enumeration on this system
        pass
    if sys.platform != "win32":
        found += sorted(glob.glob("/dev/ttyUSB*")) + sorted(glob.glob("/dev/ttyACM*"))
        if os.path.exists("/dev/serial0"):
            found.append("/dev/serial0")
    unique: list[str] = []
    for port in found:
        if port not in unique:
            unique.append(port)
    return unique


def parse_line(line: str) -> tuple[str, ...] | None:
    """('key', id, key) | ('hello', version) | ('pong', n) | None for anything malformed."""
    fields = line.strip().split()
    if len(fields) == 3 and fields[0] == "KEY" and fields[1].isdigit() and fields[2] in KEYS:
        return ("key", fields[1], KEYS[fields[2]])
    if len(fields) == 3 and fields[0] == "HELLO" and fields[1] == "controles":
        return ("hello", fields[2])
    if len(fields) == 2 and fields[0] == "PONG" and fields[1].isdigit():
        return ("pong", fields[1])
    if len(fields) == 2 and fields[0] == "SMART" and fields[1].isdigit() and int(fields[1]) < 64:
        return ("smart", fields[1])
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
        self.power_capable = False
        self.smart_mask = 0
        self.smart_at = 0.0
        self._power_owner: object | None = None
        self._power_until = 0.0
        self._voltmeter_owner: object | None = None
        self._voltmeter_until = 0.0

    def smart_state(self) -> dict:
        fresh = self.connected and self.smart_at > 0 and time.monotonic() - self.smart_at < 4.0
        return {"fresh": fresh, "slots": [i for i in range(6) if fresh and self.smart_mask & (1 << i)]}

    def refresh_voltmeter(self, owner: object) -> None:
        with self._lock:
            self._voltmeter_owner = owner
            self._voltmeter_until = time.monotonic() + 1.2

    def release_voltmeter(self, owner: object) -> None:
        with self._lock:
            if self._voltmeter_owner is owner:
                self._voltmeter_owner = None
                self._voltmeter_until = 0.0

    def voltmeter_requested(self) -> bool:
        with self._lock:
            return self.connected and self._voltmeter_owner is not None and time.monotonic() < self._voltmeter_until

    def claim_power(self, owner: object) -> bool:
        with self._lock:
            if not self.connected or not self.power_capable or self._power_owner is not None:
                return False
            self._power_owner = owner
            self._power_until = time.monotonic() + 1.2
            return True

    def renew_power(self, owner: object) -> bool:
        with self._lock:
            if self._power_owner is not owner or not self.connected or time.monotonic() >= self._power_until:
                return False
            self._power_until = time.monotonic() + 1.2
            return True

    def release_power(self, owner: object | None = None) -> None:
        with self._lock:
            if owner is None or self._power_owner is owner:
                self._power_owner = None
                self._power_until = 0.0

    def power_requested(self) -> bool:
        with self._lock:
            return self.connected and self._power_owner is not None and time.monotonic() < self._power_until

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
                 opener: Callable[..., object] | None = None,
                 scanner: Callable[[], list[str]] = candidate_ports) -> None:
        self.auto = port.strip().lower() == AUTO
        self.port = port
        self.hub = hub
        self.baud = baud
        self._opener = opener
        self._scanner = scanner
        self._stop = threading.Event()
        self._current: str | None = None
        hub.port = None if self.auto else port

    def start(self) -> "SerialControls":
        threading.Thread(target=self._run, name="bench-controls", daemon=True).start()
        return self

    def stop(self) -> None:
        self._stop.set()

    def _open(self, port: str):
        if self._opener:
            return self._opener(port, self.baud)
        import serial  # pyserial

        # DTR/RTS stay low: on a USB ESP32 board they are wired to reset/boot, so toggling them reboots it.
        link = serial.Serial(None, self.baud, timeout=0.1, write_timeout=1)
        link.port = port
        link.dtr = False
        link.rts = False
        link.open()
        return link

    def _run(self) -> None:
        warned: set[str] = set()
        while not self._stop.is_set():
            ports = self._scanner() if self.auto else [self.port]
            if self.auto and not ports and "" not in warned:
                log.warning("controls: no serial port found yet; plug the ESP32 into USB")
                warned.add("")
            for port in ports:
                if self._stop.is_set():
                    return
                try:
                    with self._open(port) as link:
                        log.info("controls: %s open", port)
                        self._serve(link, port)
                except NotTheControls:
                    log.info("controls: %s is not the ESP32 controls", port)
                except Exception as error:  # unplugged, permission, port missing: retry quietly
                    if self.hub.connected:
                        log.warning("controls: %s lost (%s)", port, error)
                    elif port not in warned:
                        log.warning("controls: cannot open %s (%s)", port, error)
                        warned.add(port)
                self.hub.connected = False
                self.hub.power_capable = False
                self.hub.smart_at = 0.0
                self.hub.release_power()
            self._stop.wait(2.0)

    def _serve(self, link, port: str | None = None) -> None:
        port = port or self.port
        self._current = port
        buffer = bytearray()
        discarding = False
        ping = 0
        next_ping = 0.0
        opened = time.monotonic()
        heard = False
        next_power = 0.0
        next_voltmeter = 0.0
        voltmeter_sent = False
        link.write(b"HELLO?\n")
        while not self._stop.is_set():
            now = time.monotonic()
            if self.auto and not heard:
                if self.hub.last_seen > opened:
                    heard = True
                    log.warning("controls: ESP32 found on %s", port)
                elif now - opened > PROBE_S:
                    raise NotTheControls(port)
            if self.auto and heard and not self.hub.connected:
                raise NotTheControls(port)  # went quiet: scan again (it may be on another port now)
            if now >= next_ping:
                ping += 1
                link.write(f"PING {ping}\n".encode("ascii"))
                next_ping = now + PING_EVERY_S
            if self.hub.power_capable and now >= next_power:
                link.write(b"POWER 1\n" if self.hub.power_requested() else b"POWER 0\n")
                next_power = now + 0.3
            if self.hub.power_capable and now >= next_voltmeter:
                requested = self.hub.voltmeter_requested()
                if requested or voltmeter_sent:
                    link.write(b'VOLTTEST 1\n' if requested else b'VOLTTEST 0\n')
                voltmeter_sent = requested
                next_voltmeter = now + 0.5
            if self.hub.connected and now - self.hub.last_seen > LINK_TIMEOUT_S:
                self.hub.connected = False
                self.hub.release_power()
                log.warning("controls: no reply from the ESP32 on %s", port)
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
        if message[0] == "hello":
            self.hub.power_capable = message[1] == "2" and self._current != "/dev/serial0"
        if message[0] == "smart":
            self.hub.smart_mask = int(message[1])
            self.hub.smart_at = time.monotonic()
        if self.auto:
            self.hub.port = self._current
        if message[0] == "key":
            link.write(f"ACK {message[1]}\n".encode("ascii"))
            self.hub.push(message[2])
