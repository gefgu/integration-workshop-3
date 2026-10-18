"""BLE GATT peripheral (D4): bridges the RX/TX characteristics to protocol.Session.

Planned with `bless` on the Raspberry Pi (BlueZ). Each write to RX is one frame; replies are
notified on TX, one frame per notification. Until the bench hardware is ready, the WebSocket
simulator in server.py carries the very same frames.
"""
from __future__ import annotations

from .protocol import BLE_RX, BLE_SERVICE, BLE_TX, FrameAssembler, Session, encode_frames
from .store import BenchStore


async def serve(store: BenchStore) -> None:  # pragma: no cover - needs BlueZ and an adapter
    try:
        from bless import (BlessGATTCharacteristic, BlessServer, GATTAttributePermissions,
                           GATTCharacteristicProperties)
    except ImportError as error:
        raise SystemExit("Instale o extra BLE: pip install -e '.[ble]'") from error

    session, assembler = Session(store), FrameAssembler()
    server = BlessServer(name=f"TedTronics-{store.bench_id}")
    counter = 0

    def on_write(characteristic: BlessGATTCharacteristic, value: bytearray, **_kwargs) -> None:
        nonlocal counter
        message = assembler.push(value.decode())
        if message is None:
            return
        counter += 1
        for frame in encode_frames(session.handle(message), f"b{counter}"):
            server.get_characteristic(BLE_TX).value = frame.encode()
            server.update_value(BLE_SERVICE, BLE_TX)

    server.write_request_func = on_write
    await server.add_new_service(BLE_SERVICE)
    await server.add_new_characteristic(BLE_SERVICE, BLE_RX, GATTCharacteristicProperties.write,
                                        None, GATTAttributePermissions.writeable)
    await server.add_new_characteristic(BLE_SERVICE, BLE_TX, GATTCharacteristicProperties.notify,
                                        None, GATTAttributePermissions.readable)
    await server.start()
