import time

from bench_service.controls import ControlsHub
from bench_service.router_power import RouterPower, route_from_battery
from bench_service.server import battery_route


class FakeRouter:
    """A serial link to the hc4051_power_router sketch: answers PING/OFF/POWER like the firmware."""

    def __init__(self):
        self.written: list[str] = []
        self.out = bytearray()
        self.closed = False

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.closed = True

    def write(self, data: bytes):
        line = data.decode().strip()
        self.written.append(line)
        if line == "PING":
            self.out += b"OK PONG\r\n"
        elif line == "OFF":
            self.out += b"OK OFF\r\n"
        elif line.startswith("POWER"):
            self.out += b"OK POWER\r\n"

    def read(self, _size):
        time.sleep(0.005)
        data, self.out = bytes(self.out), bytearray()
        return data


def wait_for(condition, timeout=3.0):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if condition():
            return True
        time.sleep(0.01)
    return False


def test_route_from_battery_columns():
    assert route_from_battery(2, 1) == (1, 0)
    assert route_from_battery(3, 2) == (2, 1)
    assert route_from_battery(4, 3) is None  # outside the three router nodes
    assert route_from_battery(2, 2) is None


def test_battery_route_mirrors_the_camera_columns():
    # camera columns are mirrored on screen: raw 10/11 is screen 2/1 (+ on 2, - on 1)
    assert battery_route([{"type": "bateria", "a": 10, "b": 11, "row": 7}]) == (1, 0)
    assert battery_route([{"type": "bateria", "a": 9, "b": 10, "row": 7}]) == (2, 1)
    assert battery_route([{"type": "bateria", "a": 8, "b": 9, "row": 7}]) is None
    # the router's nodes are in the lower bank (rows 6..11): a battery in the upper bank is never powered
    assert battery_route([{"type": "bateria", "a": 10, "b": 11, "row": 2}]) is None
    assert battery_route([]) is None
    assert battery_route(None) is None
    assert battery_route([{"type": "bateria", "a": 10, "b": 11, "row": 7}, {"type": "bateria", "a": 9, "b": 10, "row": 7}]) is None


def test_router_powers_the_lease_route_and_switches_off():
    hub = ControlsHub()
    link = FakeRouter()
    router = RouterPower(hub, "fake", opener=lambda port, baud: link).start()
    try:
        assert wait_for(lambda: hub.connected and hub.power_capable)
        assert link.written[0] == "OFF"  # an earlier session's route is never trusted
        owner = object()
        assert hub.claim_power(owner, None) is False  # router mode needs a route
        assert hub.claim_power(owner, (2, 1)) is True
        assert wait_for(lambda: "POWER 2 1" in link.written)
        assert hub.renew_power(owner, (1, 0)) is True  # battery moved: the route follows
        assert wait_for(lambda: "POWER 1 0" in link.written)
        hub.release_power(owner)
        count = len(link.written)
        assert wait_for(lambda: link.written[count:].count("OFF") >= 1)
    finally:
        router.stop()
    assert link.written[-1] == "OFF"
    assert link.closed


def test_router_lease_expires_to_off():
    hub = ControlsHub()
    link = FakeRouter()
    router = RouterPower(hub, "fake", opener=lambda port, baud: link).start()
    try:
        assert wait_for(lambda: hub.connected)
        assert hub.claim_power(object(), (1, 0))
        assert wait_for(lambda: "POWER 1 0" in link.written)
        assert wait_for(lambda: link.written[link.written.index("POWER 1 0"):].count("OFF") >= 1, timeout=4.0)
    finally:
        router.stop()


def test_router_not_found_never_claims_power():
    hub = ControlsHub()

    def broken(port, baud):
        raise OSError("busy")

    router = RouterPower(hub, "fake", opener=broken, retry_s=0.05).start()
    try:
        time.sleep(0.2)
        assert hub.connected is False
        assert hub.claim_power(object(), (1, 0)) is False
    finally:
        router.stop()
