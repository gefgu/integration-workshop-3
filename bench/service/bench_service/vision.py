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
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

BANK_ROWS = 6
# Vision types the lesson editor knows under the same name.
# The resistor values come from the colored stripe on the blue pieces (visao/config.py FAIXAS).
SAME_TYPE = {"led", "buzzer", "capacitor", "botao", "jumper_curto", "jumper_longo", "jumper_3", "jumper_4",
             "resistor_220", "resistor_470", "resistor_1k"}
# Vision types that need a choice the camera cannot make (value, polarity), mapped to the editor type.
ASSUMED_TYPE = {
    # The red two-socket piece is the battery in the kit; the left column is taken as "+".
    "vermelho_2": "bateria",
}
UNSUPPORTED = {
    "resistor": "Resistor detectado; o valor não foi identificado pelas faixas.",
    "capsula_smart": "Componente inteligente detectado; a câmera não identifica sua função ou configuração.",
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


# Provisional saved-picture setting, in V4L2 100 µs units. The physical
# camera's controls still need a later on-bench calibration.
DEFAULT_EXPOSURE = 1300.0
# At 0.7 fps a frame normally takes about 1.4 seconds; allow several slow
# frames but never expose a frozen camera image as an up-to-date circuit.
MAX_FRAME_AGE_S = 8.0
REMOVAL_CONFIRM_FRAMES = 6


class PieceHold:
    """Keep confirmed pieces on the display until their location is visibly empty."""

    def __init__(self) -> None:
        self.pieces: dict[str, dict[str, Any]] = {}
        self.empty_counts: dict[str, int] = {}
        self.generation = None

    def update(self, pieces: list[dict[str, Any]], result: Any) -> tuple[list[dict[str, Any]], bool]:
        generation = result.registro.get('generation') if result.registro.get('valido') else None
        if generation is not None and self.generation is not None and generation != self.generation:
            self.pieces.clear()
            self.empty_counts.clear()
        if generation is not None:
            self.generation = generation
        fresh = {piece['id']: piece for piece in pieces} if result.valido else {}
        self.pieces.update(fresh)
        uncertain = not result.valido
        for ident, piece in list(self.pieces.items()):
            if ident in fresh:
                self.empty_counts.pop(ident, None)
                continue
            bank, row = divmod(piece['row'], BANK_ROWS)
            cols = (piece['a'] - 1, piece['b'] - 1)
            visible_empty = result.valido and all(
                result.atualidade[bank, row, col] == 'fresh' and result.observacoes[bank, row, col] == 'empty'
                for col in cols
            )
            if visible_empty:
                self.empty_counts[ident] = self.empty_counts.get(ident, 0) + 1
                if self.empty_counts[ident] >= REMOVAL_CONFIRM_FRAMES:
                    del self.pieces[ident]
                    del self.empty_counts[ident]
                    continue
            else:
                self.empty_counts.pop(ident, None)
            uncertain = True
        return [self.pieces[ident] for ident in sorted(self.pieces)], uncertain


def fps_from(times: "deque[float] | list[float]") -> float | None:
    """Frames per second over the timestamps of the most recent processed frames (None until two exist)."""
    if len(times) < 2 or times[-1] <= times[0]:
        return None
    return round((len(times) - 1) / (times[-1] - times[0]), 1)


def open_camera(cv: Any, index: int) -> Any:
    """Same opening as `python -m visao --camera`: V4L2 + MJPG, so a USB camera gives 1280x720, not 640x480."""
    from visao.__main__ import abre_camera
    return abre_camera(index, False)


@dataclass(frozen=True)
class CameraSettings:
    """A commanded exposure, independent of possibly stale V4L2 readback."""

    exposure: float = DEFAULT_EXPOSURE

    def apply(self, cv: Any, cap: Any) -> None:
        for prop, value in ((cv.CAP_PROP_AUTO_WB, 0), (cv.CAP_PROP_AUTO_EXPOSURE, 1),
                            (cv.CAP_PROP_EXPOSURE, self.exposure)):
            accepted = cap.set(prop, value)
            try:
                readback = cap.get(prop)
            except Exception as error:
                readback = f'unavailable: {error}'
            log.info('camera control %s: requested %s, accepted %s, readback %s',
                     prop, value, accepted, readback)
            if not accepted:
                raise RuntimeError(f'camera rejected control {prop}={value}')


class ExposureRestoreError(RuntimeError):
    """The commanded normal exposure could not be confirmed by frame brightness."""


# Resistor bands wash out at the normal exposure (glare turns red, brown and orange into one
# clipped salmon). The bands are read from a few frames at two lower exposures (V4L2 units of
# 100 µs; the camera's useful range was 600-1300 under the bench lamp) and the exposure is then put back.
BAND_EXPOSURES = (1000, 1100)
BAND_FRAMES = 2
BAND_DARKER = .8            # a band frame must be at least this much darker than the normal one
RESTORE_TOLERANCE = .12     # the restored frame must match the normal brightness within this


def _wait_for_brightness(cap: Any, accept, limit: int = 45) -> Any:
    """Reads frames until `accept(mean)` holds for two frames in a row; returns the last frame or None."""
    good, frame = 0, None
    for _ in range(limit):
        ok, current = cap.read()
        if not ok:
            continue
        good = good + 1 if accept(float(current.mean())) else 0
        frame = current
        if good >= 2:
            return frame
    return None


def read_bands_frames(cv: Any, cap: Any, locked: float, reference: float) -> tuple[list[Any], float]:
    """Lowers the exposure, collects frames for the band reader, restores the exposure.

    Returns (frames, commanded normal exposure). Refuse further processing if
    the normal image brightness cannot be restored; never re-lock from auto or
    substitute a camera readback for the commanded value."""
    frames: list[Any] = []
    try:
        for exposure in BAND_EXPOSURES:
            cap.set(cv.CAP_PROP_EXPOSURE, exposure)
            if _wait_for_brightness(cap, lambda mean: mean <= reference * BAND_DARKER) is None:
                log.warning("band read: exposure %s did not darken the frame", exposure)
                break
            for _ in range(BAND_FRAMES):
                ok, frame = cap.read()
                if ok:
                    frames.append(frame)
    finally:
        cap.set(cv.CAP_PROP_EXPOSURE, locked)
        restored = _wait_for_brightness(cap, lambda mean: abs(mean - reference) <= reference * RESTORE_TOLERANCE)
        if restored is None:
            raise ExposureRestoreError(f'normal exposure {locked} did not restore')
    return frames, locked


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
                                       "reason": "Ligando a câmera…", "version": 0, "profile": profile, "partial": profile == "current", "recalibrating": False, "pieces": [], "unknown": [],
                                       "fps": None, "frame_size": None, "confirming": 0, "stable_frames": None,
                                       "calibration": "manual" if calibration else "automatic",
                                       "updated_at": None}
        self._jpeg: bytes | None = None
        self._thread = threading.Thread(target=self._run, name="vision", daemon=True)

    def start(self) -> "VisionSource":
        self._thread.start()
        return self

    def stop(self) -> None:
        self._stop.set()

    def recalibrate(self) -> None:
        # Instant feedback: the search itself can take seconds on a Raspberry Pi.
        self._set(recalibrating=True, reason="Recalibrando a câmera… isso pode levar alguns segundos.")
        self._recalibrate.set()

    def state(self) -> dict[str, Any]:
        with self._lock:
            out = dict(self._state)
        # Seconds since the last processed frame, computed here so it needs no shared clock with the screen.
        out["age_s"] = None if out["updated_at"] is None else round(max(0.0, time.time() - out["updated_at"]), 1)
        if out["age_s"] is not None and out["age_s"] > MAX_FRAME_AGE_S:
            out.update(valid=False, reason="A câmera parou de atualizar. Confira a conexão.",
                       pieces=[], unknown=[], version=-1 - out["version"])
        return out

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
            self._set(reason="Configurando a câmera…")
            settings = CameraSettings()
            try:
                settings.apply(cv, cap)
            except RuntimeError as error:
                cap.release()
                self._set(valid=False, reason=f"Não consegui configurar a câmera: {error}")
                return
            locked_exposure = settings.exposure
        pipeline = make_pipeline()
        held = PieceHold()
        from visao import config as vision_config
        self._set(stable_frames=vision_config.FRAMES_ESTAVEIS)
        period = 1.0 / 5
        times: deque[float] = deque(maxlen=25)
        self._set(running=True)
        try:
            while not self._stop.is_set():
                started = time.monotonic()
                if self._recalibrate.is_set():
                    self._recalibrate.clear()
                    pipeline.recalibrar()
                    held = PieceHold()
                if still is not None:
                    frame = still.copy()
                else:
                    ok, frame = cap.read()
                    if not ok:
                        self._set(valid=False, reason="Falha ao ler a câmera.")
                        time.sleep(period)
                        continue
                result = pipeline.processa(frame)
                recalibrating = False
                times.append(time.monotonic())
                # Candidates seen for fewer than `stable_frames` frames in a row are still being confirmed.
                confirming = sum(1 for counts in (getattr(pipeline, "counts", {}), getattr(pipeline, "blue_counts", {}),
                                                    getattr(pipeline, "kit_counts", {}))
                                 for n in counts.values() if n < vision_config.FRAMES_ESTAVEIS)
                ok, jpeg = cv.imencode(".jpg", debug.desenha_frame(frame, result), [cv.IMWRITE_JPEG_QUALITY, 70])
                changes: dict[str, Any] = {"valid": result.valido, "reason": result.motivo,
                                           "updated_at": time.time(), "recalibrating": recalibrating,
                                           "fps": fps_from(times), "frame_size": list(frame.shape[1::-1]),
                                           "confirming": confirming}
                pieces, unknown = to_pieces(para_dict(result.grafo))
                if self.profile == 'current':
                    pieces, uncertain = held.update(pieces, result)
                else:
                    uncertain = not result.valido
                unknown += unknown_from_partial(getattr(result, "pecas_sem_tipo", []))
                # Compare with the stored publication, not the public stale-frame
                # view: a slow processed frame must not change versioning or
                # piece decisions merely because state() would time it out.
                with self._lock:
                    old = dict(self._state)
                changes['uncertain'] = uncertain
                if pieces != old.get('pieces') or unknown != old.get('unknown') or uncertain != old.get('uncertain'):
                    changes.update(pieces=pieces, unknown=unknown, version=old['version'] + 1)
                with self._lock:
                    self._state.update(changes)
                    if ok:
                        self._jpeg = jpeg.tobytes()
                if cap is not None and hasattr(pipeline, "precisa_bandas") and pipeline.precisa_bandas():
                    # Needs a camera, not a still: the bands are read at a lower exposure for a moment.
                    try:
                        band_frames, locked_exposure = read_bands_frames(cv, cap, locked_exposure, float(frame.mean()))
                    except ExposureRestoreError as error:
                        log.warning('band read: %s', error)
                        self._set(valid=False, reason='A exposição normal não foi restaurada.', pieces=[], unknown=[])
                        break
                    if band_frames:
                        log.info("band read: %s", pipeline.registra_bandas(band_frames))
                    else:
                        pipeline.adia_bandas()  # the exposure did not take: back off before retrying
                    continue
                time.sleep(max(0.0, period - (time.monotonic() - started)))
        finally:
            if cap is not None:
                cap.release()
            self._set(running=False)
