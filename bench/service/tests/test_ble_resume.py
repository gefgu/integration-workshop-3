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


PACKAGE = {"version_id": "v9", "module": {"id": 1, "title": "Módulo"}, "class": {"id": 1, "name": "T"},
           "lessons": [{"id": "l1", "text": "lição com acentuação " * 40}], "students": [],
           "teacher": {"id": 1, "name": "Ana"}}


def test_long_writes_split_by_bless_are_joined_and_the_package_loads(tmp_path, caplog):
    store = BenchStore(str(tmp_path / "bench.sqlite3"))
    sent: list[bytes] = []
    bridge = BleBridge(store, sent.append)
    bridge.on_write(encode_frames({"type": "HELLO", "id": "h", "token": sign_bench_token(1, "Ana")["token"]}, "a")[0].encode())
    frames = encode_frames({"type": "LOAD_PACKAGE", "id": "q1", "package": PACKAGE}, "f1", chunk=482)
    sent.clear()
    with caplog.at_level(logging.WARNING, logger="bench_service"):
        for frame in frames:
            data = frame.encode("ascii")
            # what bless delivers for a long write at MTU 185: 182-byte pieces, each taken as a whole value
            for start in range(0, len(data), 182):
                bridge.on_write(data[start:start + 182])
    replies = FrameAssembler()
    assert [m["type"] for m in (replies.push(f.decode()) for f in sent) if m] == ["PACKAGE_OK"]
    assert store.package()["version_id"] == "v9"
    assert any("escrita longa juntados" in r.getMessage() for r in caplog.records)


def test_a_piece_with_no_frame_before_it_is_still_invalid(tmp_path):
    bridge_replies: list[bytes] = []
    bridge = BleBridge(BenchStore(str(tmp_path / "bench.sqlite3")), bridge_replies.append)
    bridge.on_write(b'"text":"sem cabecalho"}')
    reply = FrameAssembler().push(bridge_replies[0].decode())
    assert reply["code"] == "bad_message"


def test_the_wifi_simulator_keeps_rejecting_headerless_frames():
    import pytest
    assembler = FrameAssembler()
    assembler.push(encode_frames({"type": "STATUS", "id": "x" * 400}, "m", chunk=100)[0])
    with pytest.raises(ValueError):
        assembler.push("continuação sem cabeçalho")
