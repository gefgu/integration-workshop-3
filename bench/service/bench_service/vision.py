"""Camera → board for the bench screen, using the vision package (`visao/` at the repo root, by Julia).

A background thread reads the camera (or loops a still photo, for demos) at the pipeline's 5 fps, runs
`visao.Pipeline` and keeps the latest stable circuit. The bench screen reads it through the service:
`/vision/state` gives the detected pieces in the lesson editor's format, `/vision/frame.jpg` the camera
picture annotated by the vision debug drawing (SFR17.1).

`to_pieces` is pure (no OpenCV) so the mapping is testable anywhere.
"""
from __future__ import annotations

import logging
import sys
import threading
import time
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

BANK_ROWS = 6
# Vision types the lesson editor knows under the same name.
# The resistor values come from the colored stripe on the blue pieces (visao/config.py FAIXAS).
SAME_TYPE = {"led", "buzzer", "capacitor", "botao", "jumper_curto", "jumper_longo",
             "resistor_220", "resistor_470", "resistor_1k"}
# Vision types that need a choice the camera cannot make (value, polarity), mapped to the editor type.
ASSUMED_TYPE = {
    # A blue piece whose stripe was not read (1 black dot): taken as 220 Ω, so value checks may fail.
    "resistor": "resistor_220",
    # The red two-socket piece is the battery in the kit; the left column is taken as "+".
    "vermelho_2": "bateria",
}
UNSUPPORTED = {
    "potenciometro": "O potenciômetro da câmera ocupa 3 furos; nas lições ele ainda tem 2.",
    "led_ou_buzzer": "Não deu para saber se é LED ou buzzer (pontos pretos não lidos).",
    "resistor_ou_capacitor": "Não deu para saber se é resistor ou capacitor (pontos pretos não lidos).",
}


def to_pieces(circuit: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """`visao.circuito.para_dict` output → (pieces in the editor's format, components the lesson can't use).

    Vision columns are 0-based per bank (C = top, B = bottom) and rows 0..5 per bank; the editor uses
    columns 1..11 and rows 0..11 (rows 6..11 = bottom bank). Each column of each bank is one node in both.
    """
    pieces, unknown = [], []
    for comp in circuit.get("componentes", []):
        kind, pos = comp["tipo"], comp["posicao"]
        cols = pos["colunas"]
        row = pos["linha"] + (BANK_ROWS if pos["metade"] == "B" else 0)
        piece_type = kind if kind in SAME_TYPE else ASSUMED_TYPE.get(kind)
        if piece_type is None:
            holes = f"{len(cols)} furo{'s' if len(cols) > 1 else ''}"
            reason = UNSUPPORTED.get(kind, f"Peça não reconhecida ({comp['cor']}, {holes}).")
            unknown.append({"id": comp["id"], "type": kind, "row": row, "a": cols[0] + 1, "b": cols[-1] + 1,
                            "reason": reason})
            continue
        pieces.append({"id": comp["id"], "type": piece_type, "a": cols[0] + 1, "b": cols[-1] + 1, "row": row})
    return pieces, unknown


def unknown_from_partial(unlabeled: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """`PipelineAtual.pecas_sem_tipo` → the same shape as `to_pieces` unknowns (pt-BR reason)."""
    out = []
    for item in unlabeled:
        cols = item["colunas"]
        row = item["linha"] + (BANK_ROWS if item["metade"] == "B" else 0)
        stale = item["atualidade"] == "stale"
        out.append({"id": f"sem_tipo_{item['metade']}{item['linha']}_{cols[0]}", "type": "peca_sem_tipo",
                    "row": row, "a": cols[0] + 1, "b": cols[-1] + 1,
                    "reason": "Peça vista na bancada, mas a câmera ainda não sabe qual é"
                              + (" (última leitura, agora fora de vista)." if stale else ".")})
    return out


def _import_visao(profile: str = "current", calibration: str | None = None):
    """`visao` lives at the repository root, next to bench/; make it importable without installing it.

    Returns (make_pipeline, para_dict, debug). `current` is the half-populated board the kit has today
    (conservative: unrecognised positions are unknown, not empty); `legacy` is the full-board reader."""
    try:
        import visao  # noqa: F401
    except ImportError:
        sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
    from visao import debug
    from visao.circuito import para_dict
    if profile == "legacy":
        from visao.pipeline import Pipeline
        return (lambda: Pipeline()), para_dict, debug
    from visao.pipeline_atual import PipelineAtual
    return (lambda: PipelineAtual(calibration)), para_dict, debug


SETTLE_S = 2.0


def open_camera(cv: Any, index: int) -> Any:
    """Same opening as `python -m visao --camera`: V4L2 + MJPG, so a USB camera gives 1280x720, not 640x480."""
    from visao.__main__ import abre_camera
    return abre_camera(index, False)


def settle_and_lock(cv: Any, cap: Any, seconds: float = SETTLE_S) -> None:
    """Lets auto exposure / white balance adapt to the room, then locks them (as `--travar-camera`): the stripe
    and piece colors in visao/config.py were measured with a locked camera, and auto changes shift them."""
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        cap.read()
    cap.set(cv.CAP_PROP_AUTO_WB, 0)
    cap.set(cv.CAP_PROP_AUTO_EXPOSURE, 1)  # V4L2: 1 = manual


class VisionSource:
    """Runs the vision pipeline on a camera index or a still image in a daemon thread."""

    def __init__(self, camera: int | None = None, image: str | None = None,
                 profile: str = "current", calibration: str | None = None) -> None:
        if profile not in ("current", "legacy"):
            raise ValueError(f"unknown vision profile {profile!r}")
        self.camera, self.image = camera, image
        self.profile, self.calibration = profile, calibration
        self._lock = threading.Lock()
        self._recalibrate = threading.Event()
        self._stop = threading.Event()
        self._state: dict[str, Any] = {"available": True, "running": False, "valid": False,
                                       "reason": "Ligando a câmera…", "version": 0, "profile": profile, "partial": profile == "current", "pieces": [], "unknown": [],
                                       "updated_at": None}
        self._jpeg: bytes | None = None
        self._thread = threading.Thread(target=self._run, name="vision", daemon=True)

    def start(self) -> "VisionSource":
        self._thread.start()
        return self

    def stop(self) -> None:
        self._stop.set()

    def recalibrate(self) -> None:
        self._recalibrate.set()

    def state(self) -> dict[str, Any]:
        with self._lock:
            return dict(self._state)

    def frame(self) -> bytes | None:
        with self._lock:
            return self._jpeg

    def _set(self, **changes: Any) -> None:
        with self._lock:
            self._state.update(changes)

    def _run(self) -> None:
        try:
            import cv2 as cv
            make_pipeline, para_dict, debug = _import_visao(self.profile, self.calibration)
        except Exception as error:  # OpenCV or the vision package missing
            log.exception("vision unavailable")
            self._set(available=False, reason=f"Visão indisponível: {error}")
            return
        still = cv.imread(self.image) if self.image else None
        if self.image and still is None:
            self._set(available=False, reason=f"Não consegui abrir a imagem {self.image}.")
            return
        cap = None
        if still is None:
            cap = open_camera(cv, self.camera or 0)
            if not cap.isOpened():
                self._set(available=False, reason="Nenhuma câmera encontrada. Confira o cabo da câmera.")
                return
            self._set(reason="Ajustando a luz da câmera…")
            settle_and_lock(cv, cap)
        pipeline = make_pipeline()
        period = 1.0 / 5
        self._set(running=True)
        try:
            while not self._stop.is_set():
                started = time.monotonic()
                if self._recalibrate.is_set():
                    self._recalibrate.clear()
                    pipeline.recalibrar()
                if still is not None:
                    frame = still.copy()
                else:
                    ok, frame = cap.read()
                    if not ok:
                        self._set(valid=False, reason="Falha ao ler a câmera.")
                        time.sleep(period)
                        continue
                result = pipeline.processa(frame)
                ok, jpeg = cv.imencode(".jpg", debug.desenha_frame(frame, result), [cv.IMWRITE_JPEG_QUALITY, 70])
                changes: dict[str, Any] = {"valid": result.valido, "reason": result.motivo,
                                           "updated_at": time.time()}
                if result.mudou:
                    pieces, unknown = to_pieces(para_dict(result.grafo))
                    unknown += unknown_from_partial(getattr(result, "pecas_sem_tipo", []))
                    changes.update(pieces=pieces, unknown=unknown, version=self.state()["version"] + 1)
                with self._lock:
                    self._state.update(changes)
                    if ok:
                        self._jpeg = jpeg.tobytes()
                time.sleep(max(0.0, period - (time.monotonic() - started)))
        finally:
            if cap is not None:
                cap.release()
            self._set(running=False)
