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
    for bad in ["", "KEY x UP", "KEY 1 JUMP", "KEY 1", "PING 1", "lixo"]:
        assert parse_line(bad) is None


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
