"""Full-board state transitions on a saved current capture, with labelled synthetic removals."""
from pathlib import Path

import cv2 as cv
import numpy as np

from visao.pipeline_bancada import PipelineBancada

PHOTO = Path(__file__).resolve().parents[1] / 'visao/fixtures/current/full-board-2026-11-13/frame-00.jpg'


def overwrite_body(frame, h, row, first, last, colour):
    # Relative geometry is in socket units; this is an offline synthetic
    # replacement, not a claim that a physical removal was observed.
    model = np.float32([[[first - .55, row - 1.3], [last + .7, row - 1.3],
                         [last + .7, row + .2], [first - .55, row + .2]]])
    polygon = np.rint(cv.perspectiveTransform(model, h)[0]).astype(np.int32)
    changed = frame.copy()
    cv.fillConvexPoly(changed, polygon, colour)
    return changed


def test_full_board_does_not_apply_demo_inventory_and_preserves_duplicate_leds(monkeypatch):
    monkeypatch.setenv('TEDTRONICS_DEMO_ASSUME_1K', '1')
    frame = cv.imread(str(PHOTO))
    pipeline = PipelineBancada()
    assert pipeline.processa(frame).valido
    result = pipeline.processa(frame)
    assert result.valido
    assert len([c for c in result.componentes if c.tipo == 'led']) == 2
    assert any(c.tipo == 'resistor_220' for c in result.componentes)
    assert not result.completo  # unread/unsupported evidence is not silently certified


def test_synthetic_led_removal_takes_two_frames_and_keeps_the_other_led():
    frame = cv.imread(str(PHOTO))
    pipeline = PipelineBancada()
    pipeline.processa(frame)
    result = pipeline.processa(frame)
    leds = [c for c in result.componentes if c.tipo == 'led']
    assert len(leds) == 2
    target = leds[0]
    changed = overwrite_body(frame, result.registro['bank_homographies'][target.metade],
                             target.linha, target.colunas[0], target.colunas[-1], (10, 10, 10))
    first = pipeline.processa(changed)
    assert first.valido
    assert any(c.id == target.id for c in first.componentes)
    assert first.atualidade[target.metade, target.linha, target.colunas[0]] == 'stale'
    second = pipeline.processa(changed)
    assert second.valido
    assert not any(c.id == target.id for c in second.componentes)
    assert any(c.id == leds[1].id for c in second.componentes)


def test_missing_corner_invalidates_the_fixed_calibration_and_clears_pieces():
    frame = cv.imread(str(PHOTO))
    pipeline = PipelineBancada()
    pipeline.processa(frame)
    stable = pipeline.processa(frame)
    assert stable.componentes
    changed = frame.copy()
    changed[70:130, 220:270] = 0
    invalid = pipeline.processa(changed)
    assert not invalid.valido
    assert invalid.componentes == []


def test_body_replacement_never_keeps_the_previous_band_value():
    frame = cv.imread(str(PHOTO))
    pipeline = PipelineBancada()
    pipeline.processa(frame)
    result = pipeline.processa(frame)
    resistor = next(c for c in result.componentes if c.tipo == 'resistor_220')
    changed = overwrite_body(frame, result.registro['bank_homographies'][resistor.metade],
                             resistor.linha, resistor.colunas[0], resistor.colunas[-1], (170, 80, 30))
    replaced = pipeline.processa(changed)
    assert replaced.valido
    assert not any(c.id == resistor.id for c in replaced.componentes)


def test_polarity_uncertainty_does_not_remove_visible_component_bodies(monkeypatch):
    frame = cv.imread(str(PHOTO))
    pipeline = PipelineBancada()
    pipeline.processa(frame)
    baseline = pipeline.processa(frame)
    ids = {c.id for c in baseline.componentes}
    monkeypatch.setattr('visao.pipeline_bancada.read_polarity',
                        lambda *args: dict(status='unknown', reason='printed_signs_ambiguous'))
    uncertain = pipeline.processa(frame)
    assert uncertain.valido
    assert {c.id for c in uncertain.componentes} == ids
    assert all(c.polaridade['status'] == 'unknown' for c in uncertain.componentes if c.tipo in ('led', 'vermelho_2'))


def test_smart_housing_overhang_does_not_reserve_other_electrical_rows():
    frame = cv.imread(str(PHOTO.parent.parent / 'full-board-fixed-2026-11-13/frame-00.jpg'))
    pipeline = PipelineBancada()
    pipeline.processa(frame)
    result = pipeline.processa(frame)
    assert [(c.metade, c.linha, c.colunas) for c in result.componentes if c.tipo == 'resistor_470'] == [(1, 3, [5, 6])]
    assert len([c for c in result.componentes if c.tipo == 'capsula_smart']) == 2


def test_rearranged_resistor_is_read_from_its_measured_face_when_background_joins_it():
    from visao.pecas_bancada import blue_bodies
    from visao.bandas_resistor import recorte_corpo, le_bandas
    path = PHOTO.parent.parent / 'full-board-rearranged-2026-11-13/frame-00.jpg'
    frame = cv.imread(str(path))
    result = PipelineBancada(temporal=False).processa(frame)
    bounds = blue_bodies(result.retificadas[1], details=True)[(0, 2)]
    assert bounds != (-44, 4)
    crop = recorte_corpo(frame, result.registro['bank_homographies'][1], 0, 2, vertical_window=bounds)
    assert le_bandas(crop, relative=True)['valor'] == 1000


def test_visible_capacitor_body_never_disappears_during_unknown_to_typed_confirmation(monkeypatch):
    import visao.pipeline_bancada as board
    frame = cv.imread(str(PHOTO.parent.parent / 'full-board-rearranged-2026-11-13/frame-00.jpg'))
    pipeline = PipelineBancada()
    pipeline.processa(frame)
    assert any(c.tipo == 'capacitor' for c in pipeline.processa(frame).componentes)
    with monkeypatch.context() as scoped:
        scoped.setattr(board, 'capacitor_candidates', lambda image: [])
        uncertain = pipeline.processa(frame)
    confirming = pipeline.processa(frame)
    confirmed = pipeline.processa(frame)
    for result in (uncertain, confirming):
        assert not any(c.tipo == 'capacitor' for c in result.componentes)
        assert any(p['metade'] == 'B' and p['linha'] == 5 and p['colunas'] == [4, 5]
                   for p in result.pecas_sem_tipo)
    assert any(c.tipo == 'capacitor' and c.metade == 1 and c.colunas == [4, 5]
               for c in confirmed.componentes)
