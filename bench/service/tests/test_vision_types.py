"""Every piece type the vision package can name reaches the bench board under the editor's type."""
from bench_service.vision import ASSUMED_TYPE, SAME_TYPE, UNSUPPORTED, to_pieces


def test_slow_camera_allowed_but_frozen_camera_clears_circuit(monkeypatch):
    from bench_service.vision import VisionSource
    import bench_service.vision as vision
    source = VisionSource(image='unused')
    source._set(valid=True, updated_at=100.0, version=7, pieces=[{'id': 'battery'}])
    monkeypatch.setattr(vision.time, 'time', lambda: 102.9)
    assert source.state()['valid'] is True
    monkeypatch.setattr(vision.time, 'time', lambda: 109.0)
    stale = source.state()
    assert stale['valid'] is False and stale['pieces'] == [] and stale['version'] < 0
    source._set(updated_at=109.0)
    recovered = source.state()
    assert recovered['valid'] is True and recovered['version'] == 7


def comp(tipo, colunas, cor="azul"):
    return {"id": tipo, "tipo": tipo, "cor": cor, "posicao": {"metade": "C", "linha": 0, "colunas": colunas}}


def test_resistor_values_read_from_the_stripe_are_kept():
    pieces, unknown = to_pieces({"componentes": [
        comp("resistor_220", [0, 1]), comp("resistor_470", [2, 3]), comp("resistor_1k", [4, 5]),
        comp("capacitor", [6, 7]),
    ]})
    assert unknown == []
    assert [p["type"] for p in pieces] == ["resistor_220", "resistor_470", "resistor_1k", "capacitor"]


def test_generic_resistor_is_never_given_an_assumed_value():
    pieces, unknown = to_pieces({"componentes": [comp("resistor", [0, 1])]})
    assert pieces == []
    assert len(unknown) == 1 and unknown[0]["type"] == "resistor"
    assert "valor não foi identificado" in unknown[0]["reason"]


def test_camera_colors_are_locked_after_auto_exposure_settles():
    from bench_service.vision import settle_and_lock

    class Cv:
        CAP_PROP_AUTO_WB, CAP_PROP_AUTO_EXPOSURE = "wb", "exposure"

    class Cap:
        reads, settings = 0, []

        def read(self):
            self.reads += 1
            return True, None

        def set(self, prop, value):
            self.settings.append((prop, value, self.reads))

    cap = Cap()
    settle_and_lock(Cv, cap, seconds=0.05)
    assert cap.reads >= 1
    assert [(p, v) for p, v, _ in cap.settings] == [("wb", 0), ("exposure", 1)]
    assert all(reads == cap.reads for _, _, reads in cap.settings)  # locked only after the reads


def test_every_vision_type_is_mapped_or_explained():
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
    from visao import config

    named = {rule["tipo"] for rule in config.COMPONENTES.values()}
    named |= {t for rule in config.COMPONENTES.values() for t in rule.get("pontos", {}).values()}
    named |= {faixa["tipo"] for faixa in config.FAIXAS.values()}
    known = SAME_TYPE | set(ASSUMED_TYPE) | set(UNSUPPORTED)
    # vermelho_3 has no kit piece yet and falls to the generic "Peça não reconhecida".
    assert named - known <= {"vermelho_3"}


def test_untyped_pieces_from_the_current_profile_are_listed_as_unrecognised():
    from bench_service.vision import unknown_from_partial
    out = unknown_from_partial([
        {"metade": "C", "linha": 2, "colunas": [4, 5], "atualidade": "fresh"},
        {"metade": "C", "linha": 0, "colunas": [0, 1], "atualidade": "stale"}])
    assert [(u["row"], u["a"], u["b"]) for u in out] == [(2, 5, 6), (0, 1, 2)]
    assert "fora de vista" in out[1]["reason"] and "fora de vista" not in out[0]["reason"]


def test_vision_source_reads_the_current_profile_fixture():
    import time
    from pathlib import Path

    import pytest
    pytest.importorskip("cv2")
    from bench_service.vision import VisionSource
    photo = Path(__file__).resolve().parents[3] / "visao" / "fixtures" / "current" / "reference-completed.jpg"
    source = VisionSource(image=str(photo)).start()  # default profile is "current"
    try:
        deadline = time.time() + 30
        while time.time() < deadline and len(source.state()["pieces"]) < 3:
            time.sleep(0.2)
        state = source.state()
    finally:
        source.stop()
    assert state["profile"] == "current" and state["partial"] and state["valid"], state["reason"]
    # The resistor's value is never assumed; its body is listed as an unidentified piece.
    assert {(p["type"], p["a"], p["b"], p["row"]) for p in state["pieces"]} == {
        ("jumper_3", 8, 11, 0), ("led", 8, 9, 2), ("bateria", 10, 11, 4),
    }
    assert any(u["type"] == "peca_sem_tipo" and u["row"] == 3 and (u["a"], u["b"]) == (9, 10)
               for u in state["unknown"])


def test_recalibrate_reports_progress_at_once():
    from bench_service.vision import VisionSource
    source = VisionSource(image="x.jpg")  # thread not started: only the state is exercised
    assert source.state()["recalibrating"] is False
    source.recalibrate()
    state = source.state()
    assert state["recalibrating"] is True and "Recalibrando" in state["reason"]


def test_fps_and_frame_age_are_reported():
    from collections import deque

    from bench_service.vision import VisionSource, fps_from
    assert fps_from(deque([1.0])) is None
    assert fps_from(deque([10.0, 10.2, 10.4, 10.6, 10.8])) == 5.0
    source = VisionSource(image="x.jpg")
    assert source.state()["age_s"] is None and source.state()["calibration"] == "automatic"
    source._set(updated_at=__import__("time").time() - 3)
    assert 2.5 <= source.state()["age_s"] <= 4
    assert VisionSource(image="x.jpg", calibration="cal.json").state()["calibration"] == "manual"
