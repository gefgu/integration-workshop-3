"""Physical controls: ESP32 serial lines -> key presses on the bench screen's /controls WebSocket."""
import time

from fastapi.testclient import TestClient

from bench_service.controls import ControlsHub, SerialControls, parse_line
from bench_service.server import create_app
from bench_service.store import BenchStore


def test_parse_line():
    assert parse_line("KEY 7 UP") == ("key", "7", "ArrowUp")
    assert parse_line("KEY 8 OK\r") == ("key", "8", " ")
    assert parse_line("KEY 9 MENU") == ("key", "9", "Escape")
    assert parse_line("KEY 11 VOLTAR") == ("key", "11", "ArrowLeft")
    assert parse_line("KEY 10 ENERGIZAR") == ("key", "10", "Enter")
    assert parse_line("HELLO controles 1") == ("hello", "1")
    assert parse_line("PONG 3") == ("pong", "3")
    assert parse_line("SMART 12") == ("smart", "12")
    assert parse_line("SMART 64") is None
    for bad in ["", "KEY x UP", "KEY 1 JUMP", "KEY 1", "PING 1", "lixo"]:
        assert parse_line(bad) is None


def test_smart_screen_status_is_fresh_only_after_esp_report(monkeypatch):
    import bench_service.controls as module
    clock = [10.0]
    monkeypatch.setattr(module.time, 'monotonic', lambda: clock[0])
    hub = ControlsHub()
    serial = SerialControls('/dev/ttyUSB0', hub)
    serial._handle(FakeLink(b''), 'SMART 12')
    assert hub.smart_state() == {'fresh': True, 'slots': [2, 3]}
    clock[0] += 4.1
    assert hub.smart_state() == {'fresh': False, 'slots': []}
    hub.connected = False
    assert hub.smart_state()['slots'] == []


class FakeLink:
    """Stands in for pyserial: hands out the given bytes in small reads, records what the Pi writes."""

    def __init__(self, incoming: bytes) -> None:
        self.incoming = incoming
        self.written = b""

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def read(self, size: int) -> bytes:
        if not self.incoming:
            time.sleep(0.01)
            return b""
        chunk, self.incoming = self.incoming[:5], self.incoming[5:]
        return chunk

    def write(self, data: bytes) -> int:
        self.written += data
        return len(data)


def test_serial_lines_become_keys_and_are_acknowledged():
    hub = ControlsHub()
    long_line = b"X" * 200 + b"\n"
    link = FakeLink(b"HELLO controles 1\n" + long_line + b"KEY 1 DOWN\r\nKEY 2 OK\nKEY 3 BOOM\nKEY 4 ENERGIZAR\n")
    controls = SerialControls("/dev/fake", hub, opener=lambda port, baud: link).start()
    deadline = time.time() + 2
    while hub.seq < 3 and time.time() < deadline:
        time.sleep(0.01)
    controls.stop()
    assert [event["key"] for event in hub.since(0)] == ["ArrowDown", " ", "Enter"]
    assert b"HELLO?\n" in link.written and b"PING 1\n" in link.written
    assert b"ACK 1\n" in link.written and b"ACK 2\n" in link.written and b"ACK 4\n" in link.written
    assert b"ACK 3" not in link.written
    assert hub.state() == {"port": "/dev/fake", "connected": True, "seq": 3}


def test_missing_port_does_not_stop_the_bench():
    hub = ControlsHub()

    def opener(port, baud):
        raise OSError("no such port")

    controls = SerialControls("/dev/nada", hub, opener=opener).start()
    time.sleep(0.05)
    controls.stop()
    assert hub.state()["connected"] is False


def test_controls_websocket_streams_new_presses(tmp_path):
    hub = ControlsHub()
    hub.push("ArrowUp")  # before the screen connected: not replayed
    bench = TestClient(create_app(BenchStore(str(tmp_path / "b.sqlite3")), dev_unlock=True, controls=hub))
    with bench.websocket_connect("/controls") as socket:
        assert bench.post("/dev/controls/right").json()["key"] == "ArrowRight"
        hub.push("Enter")
        assert socket.receive_json() == {"seq": 2, "key": "ArrowRight"}
        assert socket.receive_json() == {"seq": 3, "key": "Enter"}
    assert bench.get("/controls/state").json() == {"port": None, "connected": False, "seq": 3}
    assert bench.post("/dev/controls/pular").status_code == 422


def test_dev_controls_need_dev_mode(tmp_path):
    bench = TestClient(create_app(BenchStore(str(tmp_path / "b.sqlite3"))))
    assert bench.post("/dev/controls/ok").status_code in (404, 405)


def test_auto_mode_skips_ports_that_are_not_the_esp32(monkeypatch):
    import bench_service.controls as controls_module

    monkeypatch.setattr(controls_module, "PROBE_S", 0.2)
    hub = ControlsHub()
    esp = FakeLink(b"HELLO controles 1\nKEY 1 UP\n")
    links = {"/dev/ttyUSB0": FakeLink(b"lixo de outro aparelho\n"), "/dev/ttyACM0": esp}
    opened = []

    def opener(port, baud):
        opened.append(port)
        return links[port]

    controls = SerialControls("auto", hub, opener=opener, scanner=lambda: list(links)).start()
    deadline = time.time() + 3
    while hub.seq < 1 and time.time() < deadline:
        time.sleep(0.01)
    controls.stop()
    assert opened[:2] == ["/dev/ttyUSB0", "/dev/ttyACM0"]
    assert [event["key"] for event in hub.since(0)] == ["ArrowUp"]
    assert hub.state() == {"port": "/dev/ttyACM0", "connected": True, "seq": 1}


def test_auto_mode_waits_for_the_esp32_to_be_plugged_in():
    hub = ControlsHub()
    controls = SerialControls("auto", hub, opener=lambda port, baud: None, scanner=lambda: []).start()
    time.sleep(0.05)
    controls.stop()
    assert hub.state() == {"port": None, "connected": False, "seq": 0}


def test_power_lease_expires_and_cannot_be_renewed_after_expiry(monkeypatch):
    import bench_service.controls as module

    clock = [10.0]
    monkeypatch.setattr(module.time, "monotonic", lambda: clock[0])
    hub = ControlsHub()
    hub.connected = hub.power_capable = True
    first, second = object(), object()
    assert hub.claim_power(first)
    assert not hub.claim_power(second)
    clock[0] += 1.3
    assert not hub.power_requested()
    assert not hub.renew_power(first)
    hub.release_power(first)
    assert hub.claim_power(second)
    hub.connected = False
    assert not hub.power_requested()


def test_voltmeter_lease(monkeypatch):
    import bench_service.controls as module
    clock = [10.0]
    monkeypatch.setattr(module.time, 'monotonic', lambda: clock[0])
    hub = ControlsHub()
    hub.connected = True
    owner = object()
    hub.refresh_voltmeter(owner)
    assert hub.voltmeter_requested()
    hub.release_voltmeter(object())
    assert hub.voltmeter_requested()
    clock[0] += 1.3
    assert not hub.voltmeter_requested()
    hub.refresh_voltmeter(owner)
    hub.release_voltmeter(owner)
    assert not hub.voltmeter_requested()


def test_voltmeter_commands_follow_lease_over_usb():
    hub = ControlsHub()
    link = FakeLink(b'HELLO controles 2\n')
    controls = SerialControls('/dev/ttyUSB0', hub, opener=lambda port, baud: link).start()
    try:
        deadline = time.monotonic() + 2
        while not hub.power_capable and time.monotonic() < deadline:
            time.sleep(.01)
        owner = object()
        hub.refresh_voltmeter(owner)
        deadline = time.monotonic() + 2
        while b'VOLTTEST 1\n' not in link.written and time.monotonic() < deadline:
            time.sleep(.01)
        assert b'VOLTTEST 1\n' in link.written
        hub.release_voltmeter(owner)
        deadline = time.monotonic() + 2
        while b'VOLTTEST 0\n' not in link.written and time.monotonic() < deadline:
            time.sleep(.01)
        assert b'VOLTTEST 0\n' in link.written
    finally:
        controls.stop()


def test_power_commands_follow_lease_over_usb():
    hub = ControlsHub()
    link = FakeLink(b"HELLO controles 2\n")
    controls = SerialControls("/dev/ttyUSB0", hub, opener=lambda port, baud: link).start()
    deadline = time.monotonic() + 2
    while not hub.power_capable and time.monotonic() < deadline:
        time.sleep(0.01)
    owner = object()
    assert hub.claim_power(owner)
    deadline = time.monotonic() + 2
    while b"POWER 1\n" not in link.written and time.monotonic() < deadline:
        time.sleep(0.01)
    assert b"POWER 1\n" in link.written
    hub.release_power(owner)
    sent_at = len(link.written)
    deadline = time.monotonic() + 2
    while b"POWER 0\n" not in link.written[sent_at:] and time.monotonic() < deadline:
        time.sleep(0.01)
    controls.stop()
    assert b"POWER 0\n" in link.written[sent_at:]


def test_live_power_rejects_wrong_vision_and_releases_on_disconnect(tmp_path):
    import asyncio

    class Vision:
        def state(self):
            return {"available": True, "running": True, "valid": True, "uncertain": False,
                    "age_s": 1, "version": 7, "unknown": []}

    hub = ControlsHub()
    hub.connected = hub.power_capable = True
    app = create_app(BenchStore(str(tmp_path / "b.sqlite3")), vision=Vision(), controls=hub)
    endpoint = next(route.endpoint for route in app.routes if getattr(route, "path", None) == "/controls/power")

    class Socket:
        def __init__(self):
            self.messages = iter([{"lesson": "curriculo-03-guiada-1k", "version": 7},
                                  {"lesson": "curriculo-03-guiada-1k", "version": 8}])
            self.replies = []

        async def accept(self): pass
        async def receive_json(self): return next(self.messages)
        async def send_json(self, value):
            self.replies.append(value)
            if value["ok"]:
                assert hub.power_requested()
        async def close(self): pass

    socket = Socket()
    asyncio.run(endpoint(socket))
    assert socket.replies == [{"ok": True}, {"ok": False}]
    assert not hub.power_requested()


def test_smart_lesson_power_requires_camera_and_fresh_screen_response(tmp_path):
    import asyncio

    class Vision:
        def state(self):
            return {'available': True, 'running': True, 'valid': True, 'uncertain': False,
                    'age_s': 1, 'version': 7, 'unknown': [{'type': 'capsula_smart'}]}

    hub = ControlsHub()
    hub.connected = hub.power_capable = True
    app = create_app(BenchStore(str(tmp_path / 'b.sqlite3')), vision=Vision(), controls=hub)
    endpoint = next(route.endpoint for route in app.routes if getattr(route, 'path', None) == '/controls/power')

    class Socket:
        def __init__(self): self.replies = []
        async def accept(self): pass
        async def receive_json(self): return {'lesson': 'curriculo-teste-voltimetro-buzzer', 'version': 7}
        async def send_json(self, value):
            self.replies.append(value)
            if value['ok']:
                hub.smart_at = 0  # loss of fresh screen response must stop the lease
        async def close(self): pass

    absent = Socket()
    asyncio.run(endpoint(absent))
    assert absent.replies == [{'ok': False}]
    hub.smart_mask, hub.smart_at = 1 << 2, time.monotonic()
    present = Socket()
    asyncio.run(endpoint(present))
    assert present.replies == [{'ok': True}, {'ok': False}]
    assert not hub.power_requested()
