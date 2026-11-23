"""The HC4051 power router (firmware/component_testing/hc4051_power_router) as the bench's power source.

The ESP32 puts 3.3 V on one of three nodes and GND on another, so the PC decides the polarity: the nodes are the
board's first three columns (node = column - 1), and the lesson's battery is only a marker of where + and - go.

    PING            -> OK PONG
    POWER <s> <g>   -> OK POWER ...   (3.3 V on node s, GND on node g; stays until the next command or reset)
    OFF             -> OK OFF

The route stays on until told otherwise, so this thread sends OFF whenever the lease ends, when the link drops,
and when the service stops. It re-sends the active route every second in case the ESP32 reset.
"""
from __future__ import annotations

import logging
import threading
import time

from .controls import ControlsHub

log = logging.getLogger("bench.router")

NODES = (0, 1, 2)
BAUD = 115200
PING_EVERY_S = 1.0
LINK_TIMEOUT_S = 3.5
RESEND_S = 1.0


def route_from_battery(positive_col: int, negative_col: int) -> tuple[int, int] | None:
    """Board columns (1-based, + and - of the battery) -> (source node, GND node), or None outside the router."""
    source, ground = positive_col - 1, negative_col - 1
    if source in NODES and ground in NODES and source != ground:
        return source, ground
    return None


class RouterPower:
    def __init__(self, hub: ControlsHub, port: str, opener=None, retry_s: float = 2.0) -> None:
        self.hub, self.port, self._opener, self._retry_s = hub, port, opener, retry_s
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self.sent: list[str] = []  # the commands written (tests and diagnostics)
        hub.router = True

    def start(self) -> "RouterPower":
        self._thread = threading.Thread(target=self._run, name="router-power", daemon=True)
        self._thread.start()
        return self

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=3)

    def _open(self):
        if self._opener:
            return self._opener(self.port, BAUD)
        import serial  # pyserial

        # DTR/RTS stay low: on a USB ESP32 board they are wired to reset/boot, so toggling them reboots it.
        link = serial.Serial(None, BAUD, timeout=0.05, write_timeout=1)
        link.port = self.port
        link.dtr = False
        link.rts = False
        link.open()
        return link

    def _send(self, link, text: str) -> None:
        self.sent.append(text)
        link.write(f"{text}\n".encode("ascii"))

    def _run(self) -> None:
        warned = False
        while not self._stop.is_set():
            try:
                with self._open() as link:
                    log.info("router: %s open", self.port)
                    warned = False
                    self._serve(link)
            except Exception as error:  # unplugged, permission, port busy: retry quietly
                if self.hub.connected or not warned:
                    log.warning("router: %s unavailable (%s)", self.port, error)
                warned = True
            self.hub.connected = False
            self.hub.power_capable = False
            self.hub.release_power()
            self._stop.wait(self._retry_s)

    def _serve(self, link) -> None:
        buffer = bytearray()
        heard = 0.0
        next_ping = 0.0
        next_send = 0.0
        active: tuple[int, int] | None = None
        self._send(link, "OFF")  # never trust the route left by an earlier session
        try:
            while not self._stop.is_set():
                now = time.monotonic()
                if now >= next_ping:
                    self._send(link, "PING")
                    next_ping = now + PING_EVERY_S
                for byte in link.read(64) or b"":
                    if byte == 0x0A:
                        line = buffer.decode("ascii", "replace").strip()
                        buffer.clear()
                        if line.startswith("OK") or line.startswith("READY"):
                            heard = now
                            if not self.hub.connected:
                                log.warning("router: ESP32 power router found on %s", self.port)
                            self.hub.connected = True
                            self.hub.power_capable = True
                            self.hub.last_seen = now
                            self.hub.port = self.port
                        elif line.startswith("ERR"):
                            log.warning("router: %s", line)
                    elif byte != 0x0D and len(buffer) < 200:
                        buffer.append(byte)
                if self.hub.connected and now - heard > LINK_TIMEOUT_S:
                    raise OSError("no reply from the power router")
                wanted = self.hub.power_route()
                if wanted != active or (wanted is not None and now >= next_send):
                    if wanted is None:
                        self._send(link, "OFF")
                    else:
                        self._send(link, f"POWER {wanted[0]} {wanted[1]}")
                    if wanted != active:
                        log.warning("router: %s", "OFF" if wanted is None else f"POWER {wanted[0]} {wanted[1]} (3.3 V on node {wanted[0]}, GND on node {wanted[1]})")
                    active = wanted
                    next_send = now + RESEND_S
        finally:
            try:
                self._send(link, "OFF")
            except Exception:
                pass
