"""Checks against captured white resistor and unoccupied/other footprints."""
import tempfile
import unittest
import contextlib
import copy
import csv
import io
import json
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

import cv2 as cv
import numpy as np

from visao.calibracao import RegistradorParcial, salva
from visao.resistor_atual import resistor_branco
from visao.sockets import retifica
from visao import config as cfg
from visao.pipeline_atual import PipelineAtual
from visao.__main__ import saida_json, roda_camera, salva_debug
from visao.debug import desenha_frame, desenha_retificada, desenha_sockets, tabela_sockets
from visao.tela import desenha_tela


class TestCurrentResistor(unittest.TestCase):
    def test_captured_piece_is_the_only_matching_footprint(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        frames = sorted(folder.glob('frame-*.jpg'))
        self.assertEqual(len(frames), 5)
        with tempfile.TemporaryDirectory() as tmp:
            calibration = str(Path(tmp) / 'cal.json')
            salva(calibration, cv.imread(str(frames[0])),
                  [[260, 375], [1035, 406], [1050, 670], [237, 631]])
            tracker = RegistradorParcial(calibration)
            for path in frames:
                image = cv.imread(str(path))
                registration = tracker.atualiza(image)
                self.assertTrue(registration['valido'])
                rectified = retifica(image, registration['H'])
                found = [(row, col) for row in range(6) for col in range(10)
                         if resistor_branco(rectified, 0, row, col)]
                self.assertEqual(found, [(2, 4)], str(path))

    def test_uniform_white_or_black_is_not_a_resistor(self):
        for value in (0, 255):
            image = np.full((580, 775, 3), value, dtype=np.uint8)
            self.assertFalse(resistor_branco(image, 0, 2, 4))
            self.assertFalse(resistor_branco(image, 1, 2, 4))

    def test_brightness_variation_and_clipped_band(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        image = cv.imread(str(folder / 'frame-00.jpg'))
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / 'cal.json')
            salva(path, image, [[260, 375], [1035, 406], [1050, 670], [237, 631]])
            for alpha, beta, expected in ((1, 0, True), (.8, 0, True), (1, -20, True),
                                          (1.15, 0, False)):
                adjusted = cv.convertScaleAbs(image, alpha=alpha, beta=beta)
                registration = RegistradorParcial(path).atualiza(adjusted)
                self.assertTrue(registration['valido'])
                rectified = retifica(adjusted, registration['H'])
                found = [(row, col) for row in range(6) for col in range(10)
                         if resistor_branco(rectified, 0, row, col)]
                self.assertEqual(found, [(2, 4)] if expected else [], (alpha, beta))

    def test_reverse_band_orientation(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        image = cv.imread(str(folder / 'frame-00.jpg'))
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / 'cal.json')
            salva(path, image, [[260, 375], [1035, 406], [1050, 670], [237, 631]])
            registration = RegistradorParcial(path).atualiza(image)
            rectified = retifica(image, registration['H'])
            cx, cy = (round(v) for v in cfg.para_retificada(4.5, 2))
            patch = rectified[cy - 36:cy - 10, cx - 28:cx + 29]
            rectified[cy - 36:cy - 10, cx - 28:cx + 29] = cv.flip(patch, 1)
            self.assertTrue(resistor_branco(rectified, 0, 2, 4))

    def test_captured_resistor_sample_at_every_upper_grid_footprint(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        image = cv.imread(str(folder / 'frame-00.jpg'))
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / 'cal.json')
            salva(path, image, [[260, 375], [1035, 406], [1050, 670], [237, 631]])
            registration = RegistradorParcial(path).atualiza(image)
            rectified = retifica(image, registration['H'])
            x0, y0 = (int(round(v)) for v in cfg.para_retificada(4.5, 2))
            sample = rectified[y0 - 40:y0 + 10, x0 - 60:x0 + 60].copy()
            self.assertEqual(sample.shape[:2], (50, 120))
            for row in range(6):
                for col in range(10):
                    image_at_position = np.zeros_like(rectified)
                    x, y = (int(round(v)) for v in cfg.para_retificada(col + .5, row))
                    image_at_position[y - 40:y + 10, x - 60:x + 60] = sample
                    self.assertTrue(resistor_branco(image_at_position, 0, row, col), (row, col))

    def test_missing_camera_invalidates_previous_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'circuit.json'
            path.write_text('{"valido": true}')
            capture = mock.Mock()
            capture.isOpened.return_value = False
            args = SimpleNamespace(camera=1, travar_camera=False, profile='current', json=str(path))
            with mock.patch('visao.__main__.abre_camera', return_value=capture):
                with self.assertRaises(SystemExit):
                    roda_camera(args)
            output = json.loads(path.read_text())
            self.assertFalse(output['valido'])
            self.assertFalse(output['completo'])
            self.assertEqual(output['circuito']['componentes'], [])
            self.assertEqual(list(Path(tmp).glob('.visao-*')), [])

    def test_unchanged_live_state_has_timestamped_heartbeats(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        image = cv.imread(str(folder / 'frame-00.jpg'))
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / 'cal.json')
            salva(path, image, [[260, 375], [1035, 406], [1050, 670], [237, 631]])
            stable = PipelineAtual(path, temporal=False).processa(image)
            stable.mudou = False
            pipeline = mock.Mock()
            pipeline.processa.return_value = stable
            frames = iter([(True, image)] * 8 + [(False, None)])
            capture = mock.Mock()
            capture.isOpened.return_value = True
            capture.read.side_effect = lambda: next(frames)
            args = SimpleNamespace(camera=1, travar_camera=False, profile='current',
                                   calibration=path, json='-', verbose=False, mostrar=False)
            clock = [0.0]
            def tick():
                clock[0] += .3
                return clock[0]
            stdout, stderr = io.StringIO(), io.StringIO()
            with mock.patch('visao.__main__.abre_camera', return_value=capture), \
                 mock.patch('visao.__main__.cria_pipeline', return_value=pipeline), \
                 mock.patch('visao.__main__.time.monotonic', side_effect=tick), \
                 mock.patch('visao.__main__.time.sleep'), \
                 mock.patch('visao.__main__.cv.destroyAllWindows'), \
                 contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                roda_camera(args)
            records = [json.loads(line) for line in stdout.getvalue().splitlines()]
            self.assertGreaterEqual(sum(record['valido'] for record in records), 2)
            self.assertTrue(all(isinstance(record['gerado_em_unix'], float) for record in records))
            self.assertFalse(records[-1]['valido'])

    def test_unreadable_white_piece_does_not_become_empty(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        image = cv.imread(str(folder / 'frame-00.jpg'))
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / 'cal.json')
            salva(path, image, [[260, 375], [1035, 406], [1050, 670], [237, 631]])
            obscured = image.copy()
            obscured[430:490, 545:685] = (245, 245, 245)
            result = PipelineAtual(path, temporal=False).processa(obscured)
            self.assertTrue(result.valido)
            self.assertEqual(result.componentes, [])
            self.assertEqual(list(result.observacoes[0, 2, 4:6]), ['unknown', 'unknown'])

    def test_unrecognized_colored_region_is_not_reported_empty(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        image = cv.imread(str(folder / 'frame-00.jpg'))
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / 'cal.json')
            salva(path, image, [[260, 375], [1035, 406], [1050, 670], [237, 631]])
            baseline = PipelineAtual(path, temporal=False).processa(image)
            self.assertEqual(baseline.observacoes[0, 1, 0], 'empty')
            rectified = baseline.retificada.copy()
            x, y = (int(round(v)) for v in cfg.para_retificada(0, 1))
            cv.rectangle(rectified, (x - 10, y - 35), (x + 10, y - 12), (0, 0, 255), -1)
            with mock.patch('visao.pipeline_atual.retifica', return_value=rectified):
                result = PipelineAtual(path, temporal=False).processa(image)
            self.assertTrue(result.valido)
            self.assertEqual(result.observacoes[0, 1, 0], 'unknown')
            self.assertEqual(result.observacoes[0, 1, 1], 'empty')

    def test_component_requires_local_grid_support(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        image = cv.imread(str(folder / 'frame-00.jpg'))
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / 'cal.json')
            salva(path, image, [[260, 375], [1035, 406], [1050, 670], [237, 631]])
            obscured = image.copy()
            obscured[350:540, 420:780] = 0
            # Keep the white component visible, but hide the adjacent grid.
            obscured[425:500, 540:685] = image[425:500, 540:685]
            result = PipelineAtual(path, temporal=False).processa(obscured)
            self.assertTrue(result.valido)
            self.assertEqual(result.componentes, [])
            self.assertEqual(list(result.observacoes[0, 2, 4:6]), ['unknown', 'unknown'])
            self.assertIn((0, (1, 2)), {(p['linha'], tuple(p['colunas'])) for p in result.pecas_sem_tipo})

    def test_completeness_requires_fresh_coverage_and_known_identities(self):
        rectified = np.zeros((cfg.ALTURA_RET, cfg.LARGURA_RET, 3), np.uint8)
        for row in range(6):
            for col in range(11):
                x, y = (int(round(v)) for v in cfg.para_retificada(col, row))
                cv.rectangle(rectified, (x - 8, y - 7), (x + 8, y + 7), (255, 255, 255), -1)
        seen = np.zeros(len(cfg.MODELO), dtype=bool)
        seen[:66] = True
        registration = {'H': np.eye(3), 'valido': True, 'furos_vistos': seen,
                        'n_furos': 66, 'furos': np.empty((0, 2)),
                        'inliers': 66, 'erro': 0, 'generation': 1}
        pipeline = PipelineAtual()
        pipeline.registrador = mock.Mock()
        pipeline.registrador.atualiza.return_value = registration
        image = np.zeros((720, 1280, 3), np.uint8)
        with mock.patch('visao.pipeline_atual.retifica', return_value=rectified):
            self.assertFalse(pipeline.processa(image).completo)
            self.assertFalse(pipeline.processa(image).completo)
            complete = pipeline.processa(image)
            self.assertTrue(complete.completo)
            self.assertTrue(np.all(complete.observacoes[0] == 'empty'))
            single_frame = PipelineAtual(temporal=False)
            single_frame.registrador = pipeline.registrador
            self.assertFalse(single_frame.processa(image).completo)
            seen[0] = False
            partial = pipeline.processa(image)
            self.assertFalse(partial.completo)
            self.assertEqual(partial.atualidade[0, 0, 0], 'stale')
            seen[0] = True
            pipeline.recalibrar()
            with mock.patch('visao.pipeline_atual.corpos_azuis', return_value={(2, 4)}):
                for _ in range(3):
                    unresolved = pipeline.processa(image)
                self.assertFalse(unresolved.completo)
                self.assertEqual(unresolved.pecas_sem_tipo[0]['colunas'], [4, 5])

    def test_full_pipeline_completeness_invalidated_by_unknown_piece(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        image = cv.imread(str(folder / 'frame-00.jpg'))
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / 'cal.json')
            salva(path, image, [[260, 375], [1035, 406], [1050, 670], [237, 631]])
            registration = RegistradorParcial(path).atualiza(image)
            original = retifica(image, registration['H'])
            rectified = np.zeros_like(original)
            mask = np.zeros(original.shape[:2], np.uint8)
            mask[2:268, 15:765] = 255
            for row in range(6):
                for col in range(11):
                    x, y = (int(round(v)) for v in cfg.para_retificada(col, row))
                    cv.rectangle(rectified, (x - 12, y - 9), (x + 12, y + 9), (230, 230, 230), -1)
            transform = np.float64([[cfg.PX_X, 0, cfg.MARGEM_X * cfg.PX_X],
                                    [0, cfg.PX_Y, cfg.MARGEM_Y * cfg.PX_Y], [0, 0, 1]])
            to_camera = registration['H'] @ np.linalg.inv(transform)
            selected = cv.warpPerspective(mask, to_camera, (1280, 720)) > 0
            def project(board):
                projected = cv.warpPerspective(board, to_camera, (1280, 720))
                frame = image.copy()
                frame[selected] = projected[selected]
                return frame
            empty = project(rectified)
            empty_rectified = rectified.copy()
            now = [0.0]
            pipeline = PipelineAtual(clock=lambda: now[0])
            for _ in range(3):
                result = pipeline.processa(empty)
            self.assertTrue(result.valido)
            self.assertTrue(result.completo)
            self.assertTrue(np.all(result.observacoes[0] == 'empty'))
            x, y = (int(round(v)) for v in cfg.para_retificada(4.5, 2))
            cv.rectangle(rectified, (x - 55, y - 35), (x + 55, y - 10), (0, 0, 255), -1)
            unknown_piece = project(rectified)
            now[0] = 1
            result = pipeline.processa(unknown_piece)
            self.assertTrue(result.valido)
            self.assertFalse(result.completo)
            self.assertEqual(list(result.atualidade[0, 2, 4:6]), ['stale', 'stale'])
            now[0] = 2.1
            result = pipeline.processa(unknown_piece)
            self.assertEqual(list(result.observacoes[0, 2, 4:6]), ['unknown', 'unknown'])
            self.assertFalse(result.completo)
            for _ in range(3):
                result = pipeline.processa(empty)
            self.assertTrue(result.completo)
            # A pale bridge can belong to an unrecognized white component,
            # even when both openings below it remain individually visible.
            pale = empty_rectified.copy()
            cv.rectangle(pale, (x - 12, y - 32), (x + 12, y - 12), (230, 230, 230), -1)
            pale_frame = project(pale)
            now[0] = 3
            result = pipeline.processa(pale_frame)
            self.assertTrue(result.valido)
            self.assertFalse(result.completo)
            self.assertEqual(list(result.atualidade[0, 2, 4:6]), ['stale', 'stale'])
            now[0] = 5.1
            result = pipeline.processa(pale_frame)
            self.assertEqual(list(result.observacoes[0, 2, 4:6]), ['unknown', 'unknown'])
            self.assertFalse(result.completo)
