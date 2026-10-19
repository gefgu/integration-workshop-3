"""BLE GATT bridge against a fake bless server: same replies as the WebSocket simulator, every
write and notification within one ATT payload at the app's MTU (185)."""
import asyncio

from fastapi.testclient import TestClient

from bench_service.ble import BleBridge, advertised_name, attach
from bench_service.protocol import BLE_RX, BLE_SERVICE, BLE_TX, FrameAssembler, encode_frames
from bench_service.server import create_app
from bench_service.store import BenchStore
from graph_validator.service.security import sign_bench_token

MAX_ATT_PAYLOAD = 185 - 3


class FakeCharacteristic:
    def __init__(self, uuid, properties, value, permissions):
        self.uuid, self.properties, self.value, self.permissions = uuid, properties, value, permissions


class FakeBlessServer:
    """The slice of bless.BlessServer that ble.attach uses; notifications are recorded in order."""

    def __init__(self):
        self.services, self.notified, self.write_request_func = {}, [], None

    async def add_new_service(self, uuid):
        self.services[uuid] = {}

    async def add_new_characteristic(self, service, uuid, properties, value, permissions):
        self.services[service][uuid] = FakeCharacteristic(uuid, properties, value, permissions)

    def get_characteristic(self, uuid):
        return next(chars[uuid] for chars in self.services.values() if uuid in chars)

    def update_value(self, service, uuid):
        value = bytes(self.services[service][uuid].value)
        assert len(value) <= MAX_ATT_PAYLOAD, f"notification of {len(value)} bytes"
        self.notified.append(value)
        return True

    def write(self, uuid, value: bytes):  # what bless does on a GATT WriteValue
        assert len(value) <= MAX_ATT_PAYLOAD, f"write of {len(value)} bytes"
        self.write_request_func(self.get_characteristic(uuid), bytearray(value))


class BlePhone:
    """What BleTransport + BenchClient do: frames written to RX, replies read from TX notifications."""

    def __init__(self, server):
        self.server, self.assembler, self.n = server, FrameAssembler(), 0

    def send(self, message):
        self.n += 1
        message = {**message, "id": f"q{self.n}"}
        for frame in encode_frames(message, f"f{self.n}"):
            self.server.write(BLE_RX, frame.encode())
        return self.receive(message["id"])

    def receive(self, re):
        while self.server.notified:
            reply = self.assembler.push(self.server.notified.pop(0).decode())
            if reply is not None:
                assert reply["re"] == re
                return reply
        raise AssertionError("no reply notified")


class WsPhone:
    def __init__(self, socket):
        self.socket, self.assembler, self.n = socket, FrameAssembler(), 0

    def send(self, message):
        self.n += 1
        message = {**message, "id": f"q{self.n}"}
        for frame in encode_frames(message, f"f{self.n}"):
            self.socket.send_text(frame)
        while (reply := self.assembler.push(self.socket.receive_text())) is None:
            pass
        return reply


def package():
    """Big enough for several frames each way, with accents (multi-byte in UTF-8) everywhere."""
    lessons = [{"id": f"l{i}", "title": f"Lição {i}: ligação em série ✨", "instruction": "Conecte o LED " * 30,
                "lessonVersion": f"v{i}"} for i in range(3)]
    return {"format": 1, "version_id": "pv1", "created_at": "2026-10-18T00:00:00Z",
            "teacher": {"id": 1, "name": "Ana Conceição"},
            "module": {"id": 2, "title": "Iluminação", "description": "Circuitos básicos", "lesson_ids": ["l0"]},
            "class": {"id": 3, "name": "7º A"}, "lessons": lessons,
            "students": [{"id": 5, "name": "João", "nickname": "jão", "nfc_code": "TAG-1"}]}


def script(phone, store):
    token = sign_bench_token(1, "Ana Conceição")["token"]
    replies = [phone.send({"type": "STATUS"}),
               phone.send({"type": "HELLO", "token": token + "x", "protocol": 1}),
               phone.send({"type": "HELLO", "token": token, "protocol": 1}),
               phone.send({"type": "LOAD_PACKAGE", "package": package()}),
               phone.send({"type": "LOAD_PACKAGE", "package": {"version_id": "x"}})]
    student = package()["students"][0]
    for step in range(7):
        store.record("step_done", student, lesson_id="l0", lesson_version="v0", step_idx=step)
    first = phone.send({"type": "PULL_EVENTS", "max": 4})
    rest = phone.send({"type": "PULL_EVENTS", "max": 50, "after_seq": first["events"][-1]["seq"]})
    ids = [e["event_id"] for e in first["events"] + rest["events"]]
    replies += [first, rest, phone.send({"type": "ACK_EVENTS", "event_ids": ids}),
                phone.send({"type": "STATUS"}), phone.send({"type": "NOPE"})]
    return replies


def comparable(reply):
    """Drops what differs between two runs by nature: event ids and timestamps."""
    reply = dict(reply)
    if "events" in reply:
        reply["events"] = [{k: v for k, v in e.items() if k not in ("event_id", "at")} for e in reply["events"]]
    return reply


def test_attach_registers_service_and_characteristics(tmp_path):
    store, server = BenchStore(tmp_path / "b.sqlite3", bench_id="bancada-01"), FakeBlessServer()
    asyncio.run(attach(server, store))
    rx, tx = server.services[BLE_SERVICE][BLE_RX], server.services[BLE_SERVICE][BLE_TX]
    assert rx.properties == 0x08 and tx.properties == 0x10  # write (with response), notify
    assert advertised_name(store) == "TedTronics-bancada-01"


def test_ble_gives_the_same_results_as_the_simulator(tmp_path):
    ble_store, server = BenchStore(tmp_path / "ble.sqlite3", bench_id="b1"), FakeBlessServer()
    asyncio.run(attach(server, ble_store))
    over_ble = script(BlePhone(server), ble_store)

    ws_store = BenchStore(tmp_path / "ws.sqlite3", bench_id="b1")
    with TestClient(create_app(ws_store)).websocket_connect("/ble") as socket:
        over_ws = script(WsPhone(socket), ws_store)

    assert [r["type"] for r in over_ble] == ["ERROR", "ERROR", "WELCOME", "PACKAGE_OK", "ERROR",
                                             "EVENTS", "EVENTS", "ACKED", "STATUS", "ERROR"]
    assert [r.get("code") for r in over_ble if r["type"] == "ERROR"] == ["locked", "bad_token", "bad_package",
                                                                       "bad_message"]
    assert len(over_ble[5]["events"]) == 4 and over_ble[5]["remaining"] == 3 and len(over_ble[6]["events"]) == 3
    assert over_ble[7] == {"type": "ACKED", "re": "q8", "deleted": 7, "pending_events": 0}
    assert over_ble[8]["package"]["module_title"] == "Iluminação"
    assert [comparable(r) for r in over_ble] == [comparable(r) for r in over_ws]
    assert ble_store.package() == package()


def test_one_notification_per_frame_and_frames_are_ascii(tmp_path):
    store, sent = BenchStore(tmp_path / "b.sqlite3"), []
    bridge = BleBridge(store, sent.append)
    store.unlock({"id": 1, "name": "Ana"}, 4e9)
    for frame in encode_frames({"type": "LOAD_PACKAGE", "id": "q1", "package": package()}, "f1"):
        bridge.on_write(frame.encode())
    for frame in encode_frames({"type": "STATUS", "id": "q2"}, "f2"):
        bridge.on_write(frame.encode())
    ok = encode_frames({"type": "PACKAGE_OK", "re": "q1", "version_id": "pv1"}, "b1")
    status = encode_frames({"type": "STATUS", "re": "q2", **store.status()}, "b2")
    assert len(status) > 1 and sent == [frame.encode() for frame in ok + status]
    assert all(byte < 0x80 for frame in sent for byte in frame)


def test_bad_frames_get_an_error_instead_of_breaking_the_link(tmp_path):
    sent = []
    bridge = BleBridge(BenchStore(tmp_path / "b.sqlite3"), sent.append)
    bridge.on_write(b"sem-cabecalho")
    bridge.on_write(b"\xff\xfe")
    bridge.on_write(b"f1|0|1|{nao e json")
    bridge.on_write(b'f2|0|1|{"id":"q2","type":"HELLO","token":"x"}')
    replies = [FrameAssembler().push(frame.decode()) for frame in sent]
    assert [(r["code"], r["re"]) for r in replies] == [("bad_message", None)] * 3 + [("bad_token", "q2")]
