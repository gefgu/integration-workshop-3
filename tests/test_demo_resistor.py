from pathlib import Path
from unittest.mock import patch

import cv2 as cv

from visao.pipeline_atual import PipelineAtual


def test_explicit_demo_assumes_only_detected_resistor_body(monkeypatch):
    monkeypatch.setenv('TEDTRONICS_DEMO_ASSUME_1K', '1')
    path = Path(__file__).resolve().parents[1] / 'visao/fixtures/current/bands-2026-11-11-1.jpg'
    frame = cv.imread(str(path))
    pipeline = PipelineAtual(temporal=False)
    # Isolate the identified resistor body from other blue holders in the scene.
    with patch('visao.pipeline_atual.resistores_azuis_kit', return_value={(1, 4)}):
        result = pipeline.processa(frame)
    assert result.valido
    assert any(c.tipo == 'resistor_1k' and c.linha == 1 and c.colunas == [4, 5] for c in result.componentes)
    assert any(p['linha'] == 1 and p['colunas'] == [8, 9] for p in result.pecas_sem_tipo)
    assert not pipeline.precisa_bandas()


def test_demo_mode_defaults_off(monkeypatch):
    monkeypatch.delenv('TEDTRONICS_DEMO_ASSUME_1K', raising=False)
    assert not PipelineAtual().demo_assume_1k


def test_service_reports_demo_assumption(monkeypatch):
    from bench_service.vision import VisionSource
    monkeypatch.setenv('TEDTRONICS_DEMO_ASSUME_1K', '1')
    assert VisionSource(image='unused').state()['resistor_value_assumed'] == '1k'
