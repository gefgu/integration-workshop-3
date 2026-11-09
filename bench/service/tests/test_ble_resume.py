"""A send resumed after a BLE reconnection: the bench keeps the partial message and the unlock."""
import logging

from graph_validator.service.security import sign_bench_token

from bench_service.ble import BleBridge
from bench_service.protocol import FrameAssembler, encode_frames
from bench_service.store import BenchStore


def test_frames_written_again_after_reconnect_complete_the_message(tmp_path, caplog):
    store = BenchStore(str(tmp_path / "bench.sqlite3"))
    sent: list[bytes] = []
    bridge = BleBridge(store, sent.append)
    bridge.on_write(encode_frames({"type": "HELLO", "id": "h", "token": sign_bench_token(1, "Ana")["token"]}, "a")[0].encode())

    package = {"version_id": "v1", "module": {"id": 1, "title": "M"}, "class": {"id": 1, "name": "T"},
               "lessons": [{"id": "l1", "text": "lição " * 300}], "students": [], "teacher": {"id": 1, "name": "Ana"}}
    frames = encode_frames({"type": "LOAD_PACKAGE", "id": "q1", "package": package}, "f1", chunk=150)
    assert len(frames) > 10
    sent.clear()
    with caplog.at_level(logging.INFO, logger="bench_service"):
        for i, frame in enumerate(frames):
            bridge.on_write(frame.encode("ascii"))
            if i == 4:  # the phone reconnected and wrote frame 4 again
                bridge.on_write(frame.encode("ascii"))

    replies = FrameAssembler()
    answers = [m for m in (replies.push(f.decode("ascii")) for f in sent) if m]
    assert [a["type"] for a in answers] == ["PACKAGE_OK"]
    assert store.package()["version_id"] == "v1"
    assert any("recebendo mensagem f1" in r.getMessage() for r in caplog.records)
    assert any("LOAD_PACKAGE tratado" in r.getMessage() for r in caplog.records)
