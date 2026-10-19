"""BLE GATT peripheral: bridges the RX/TX characteristics to protocol.Session.

Runs with `bless` on the Raspberry Pi (BlueZ). Each write to RX (write with response) is one
frame; replies are notified on TX, one frame per notification. The WebSocket simulator in
server.py carries the very same frames, and both share the bench's BenchStore.

Frames are ASCII (encode_frames escapes non-ASCII JSON), so a 150-char frame plus header fits
one notification at the 185-byte MTU the app requests. bless ignores the offset of long
(prepared) writes, so every RX write must also fit MTU - 3 bytes; protocol/bench.ts ensures it.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Callable

from .protocol import BLE_RX, BLE_SERVICE, BLE_TX, FrameAssembler, Session, encode_frames, error
from .store import BenchStore

log = logging.getLogger(__name__)


class BleBridge:
    """Feeds RX frames to a Session and hands each reply frame to `notify`, in order."""

    def __init__(self, store: BenchStore, notify: Callable[[bytes], None]) -> None:
        self.session, self.assembler, self.notify = Session(store), FrameAssembler(), notify
        self.counter = 0

    def on_write(self, value: bytes | bytearray) -> None:
        try:
            message = self.assembler.push(bytes(value).decode("utf-8"))
        except ValueError as problem:  # also UnicodeDecodeError and bad JSON
            self.reply(error(None, "bad_message", str(problem)))
            return
        if message is None:
            return
        try:
            reply = self.session.handle(message)
        except Exception as problem:  # never let a bad message break the D-Bus handler
            log.exception("BLE message failed")
            reply = error(message.get("id") if isinstance(message, dict) else None, "bad_message", str(problem))
        self.reply(reply)

    def reply(self, message: dict[str, Any]) -> None:
        self.counter += 1
        for frame in encode_frames(message, f"b{self.counter}"):
            self.notify(frame.encode("ascii"))


async def attach(server: Any, store: BenchStore) -> BleBridge:
    """Registers the TedTronics service on a bless server (or a fake with the same methods)."""
    write, notify_flag, writeable, readable = gatt_flags()

    def notify(frame: bytes) -> None:
        server.get_characteristic(BLE_TX).value = bytearray(frame)
        server.update_value(BLE_SERVICE, BLE_TX)

    bridge = BleBridge(store, notify)

    def on_write(characteristic: Any, value: bytearray, **_kwargs: Any) -> None:
        if str(characteristic.uuid).lower() == BLE_RX:
            bridge.on_write(value)

    server.write_request_func = on_write
    await server.add_new_service(BLE_SERVICE)
    await server.add_new_characteristic(BLE_SERVICE, BLE_RX, write, None, writeable)
    await server.add_new_characteristic(BLE_SERVICE, BLE_TX, notify_flag, None, readable)
    return bridge


def gatt_flags() -> tuple[int, int, int, int]:
    """(write, notify) properties and (writeable, readable) permissions; bless values if installed."""
    try:
        from bless import GATTAttributePermissions as perm, GATTCharacteristicProperties as prop
    except ImportError:  # same bit values as bless / the Bluetooth spec
        return 0x08, 0x10, 0x02, 0x01
    return prop.write, prop.notify, perm.writeable, perm.readable


def advertised_name(store: BenchStore) -> str:
    return f"TedTronics-{store.bench_id}"


async def serve(store: BenchStore, adapter: str | None = None) -> None:  # pragma: no cover - needs BlueZ
    """Advertises `TedTronics-<bench_id>` and serves the protocol until cancelled."""
    try:
        from bless import BlessServer
    except ImportError as problem:
        raise SystemExit("Instale o extra BLE: pip install -e '.[ble]'") from problem

    kwargs = {"adapter": adapter} if adapter else {}
    server = BlessServer(name=advertised_name(store), loop=asyncio.get_running_loop(), **kwargs)
    await attach(server, store)
    await server.start()
    log.info("BLE: anunciando %s", advertised_name(store))
    try:
        await asyncio.Event().wait()
    finally:
        await server.stop()
