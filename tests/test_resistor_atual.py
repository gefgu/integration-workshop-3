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
    def test_new_camera_frame_recognizes_first_row_blue_piece(self):
        image = cv.imread(str(Path(__file__).resolve().parents[1] /
                              'visao/fixtures/current/live-2026-11-09/frame-00.png'))
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / 'cal.json')
            salva(path, image, [[240, 420], [1020, 420], [1040, 681], [235, 681]])
            result = PipelineAtual(path, temporal=False).processa(image)
        self.assertTrue(result.valido)
        self.assertEqual({(p['linha'], tuple(p['colunas'])) for p in result.pecas_sem_tipo},
                         {(0, (1, 2)), (4, (2, 3))})
        self.assertEqual([(c.tipo, c.linha, c.colunas) for c in result.componentes],
                         [('resistor_1k', 2, [5, 6])])

    def test_new_camera_frames_register_automatically(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current/live-2026-11-09'
        for path in sorted(folder.glob('frame-*.png')):
            with self.subTest(frame=path.name):
                result = PipelineAtual(temporal=False).processa(cv.imread(str(path)))
                self.assertTrue(result.valido, result.motivo)
                self.assertEqual([(c.tipo, c.linha, c.colunas) for c in result.componentes],
                                 [('resistor_1k', 2, [5, 6])])
                self.assertEqual({(p['linha'], tuple(p['colunas'])) for p in result.pecas_sem_tipo},
                                 {(0, (1, 2)), (4, (2, 3))})

    def test_live_frame_with_wider_resistor_mark(self):
        path = Path(__file__).resolve().parents[1] / 'visao/fixtures/current/live-2026-11-09/frame-later.png'
        result = PipelineAtual(temporal=False).processa(cv.imread(str(path)))
        self.assertTrue(result.valido, result.motivo)
        self.assertEqual([c.id for c in result.componentes], ['resistor_1k@C2:5-6'])

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

    def test_full_pipeline_on_synthetic_resistor_relocations(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        image = cv.imread(str(folder / 'frame-00.jpg'))
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / 'cal.json')
            salva(path, image, [[260, 375], [1035, 406], [1050, 670], [237, 631]])
            registration = RegistradorParcial(path).atualiza(image)
            rectified = retifica(image, registration['H'])
            transform = np.float64([[cfg.PX_X, 0, cfg.MARGEM_X * cfg.PX_X],
                                    [0, cfg.PX_Y, cfg.MARGEM_Y * cfg.PX_Y], [0, 0, 1]])
            to_camera = registration['H'] @ np.linalg.inv(transform)
            sx, sy = (int(round(v)) for v in cfg.para_retificada(4.5, 2))
            bx, by = (int(round(v)) for v in cfg.para_retificada(4.5, 4))
            piece = rectified[sy - 40:sy + 10, sx - 60:sx + 60].copy()
            empty = rectified[by - 40:by + 10, bx - 60:bx + 60].copy()
            for row, col in ((row, col) for row in range(6) for col in range(10)):
                changed = rectified.copy()
                mask = np.zeros(rectified.shape[:2], np.uint8)
                changed[sy - 40:sy + 10, sx - 60:sx + 60] = empty
                mask[sy - 40:sy + 10, sx - 60:sx + 60] = 255
                x, y = (int(round(v)) for v in cfg.para_retificada(col + .5, row))
                changed[y - 40:y + 10, x - 60:x + 60] = piece
                mask[y - 40:y + 10, x - 60:x + 60] = 255
                projected = cv.warpPerspective(changed, to_camera, (1280, 720))
                changed_pixels = cv.warpPerspective(mask, to_camera, (1280, 720)) > 0
                synthetic = image.copy()
                synthetic[changed_pixels] = projected[changed_pixels]
                result = PipelineAtual(temporal=False).processa(synthetic)
                self.assertTrue(result.valido, (row, col))
                self.assertEqual([c.id for c in result.componentes],
                                 [f'resistor_1k@C{row}:{col}-{col + 1}'])

    def test_full_pipeline_separates_three_adjacent_blue_bodies(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        image = cv.imread(str(folder / 'frame-00.jpg'))
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / 'cal.json')
            salva(path, image, [[260, 375], [1035, 406], [1050, 670], [237, 631]])
            registration = RegistradorParcial(path).atualiza(image)
            rectified = retifica(image, registration['H'])
            sx, sy = (int(round(v)) for v in cfg.para_retificada(2.5, 4))
            tx, ty = (int(round(v)) for v in cfg.para_retificada(4.5, 4))
            sample = rectified[sy - 40:sy + 10, sx - 60:sx + 60].copy()
            changed = rectified.copy()
            changed[ty - 40:ty + 10, tx - 60:tx + 60] = sample
            mask = np.zeros(rectified.shape[:2], np.uint8)
            mask[ty - 40:ty + 10, tx - 60:tx + 60] = 255
            transform = np.float64([[cfg.PX_X, 0, cfg.MARGEM_X * cfg.PX_X],
                                    [0, cfg.PX_Y, cfg.MARGEM_Y * cfg.PX_Y], [0, 0, 1]])
            to_camera = registration['H'] @ np.linalg.inv(transform)
            projected = cv.warpPerspective(changed, to_camera, (1280, 720))
            changed_pixels = cv.warpPerspective(mask, to_camera, (1280, 720)) > 0
            synthetic = image.copy()
            synthetic[changed_pixels] = projected[changed_pixels]
            result = PipelineAtual(temporal=False).processa(synthetic)
            self.assertTrue(result.valido)
            positions = {(p['linha'], tuple(p['colunas'])) for p in result.pecas_sem_tipo}
            self.assertTrue({(4, (2, 3)), (4, (4, 5)), (4, (6, 7))} <= positions)
            self.assertEqual([c.id for c in result.componentes], ['resistor_1k@C2:4-5'])

    def test_pipeline_requires_stable_identity_and_discards_on_tracking_loss(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        image = cv.imread(str(folder / 'frame-00.jpg'))
        with tempfile.TemporaryDirectory() as tmp:
            calibration = str(Path(tmp) / 'cal.json')
            salva(calibration, image, [[260, 375], [1035, 406], [1050, 670], [237, 631]])
            pipeline = PipelineAtual(calibration)
            self.assertEqual(pipeline.processa(image).componentes, [])
            self.assertEqual(pipeline.processa(image).componentes, [])
            result = pipeline.processa(image)
            self.assertEqual([c.id for c in result.componentes], ['resistor_1k@C2:4-5'])
            output = saida_json(result)
            self.assertFalse(output['completo'])
            self.assertEqual(output['observacoes'][0][2][4:6], ['occupied', 'occupied'])
            self.assertEqual(output['observacoes'][1][0][0], 'unknown')
            table = tabela_sockets(result)
            self.assertEqual(table[2 * 11 + 4]['atualidade'], 'fresh')
            self.assertFalse(table[66]['ativo'])
            self.assertEqual(desenha_frame(image, result).shape, image.shape)
            self.assertIsNotNone(desenha_retificada(result))
            self.assertIsNotNone(desenha_sockets(image, result))
            self.assertIsNotNone(desenha_tela(result))
            lost = pipeline.processa(np.zeros_like(image))
            self.assertFalse(lost.valido)
            self.assertEqual(lost.componentes, [])
            self.assertTrue(lost.mudou)
            disassembled = cv.imread(str(folder / 'sem-grade.jpg'))
            self.assertFalse(pipeline.processa(disassembled).valido)

    def test_stale_observation_expires_and_does_not_enter_graph(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        image = cv.imread(str(folder / 'frame-00.jpg'))
        with tempfile.TemporaryDirectory() as tmp:
            calibration = str(Path(tmp) / 'cal.json')
            salva(calibration, image, [[260, 375], [1035, 406], [1050, 670], [237, 631]])
            now = [10.0]
            pipeline = PipelineAtual(calibration, clock=lambda: now[0])
            for _ in range(3):
                result = pipeline.processa(image)
            self.assertEqual(result.atualidade[0, 2, 4], 'fresh')
            now[0] += 1
            stale = pipeline.processa(np.zeros_like(image))
            self.assertEqual(stale.observacoes[0, 2, 4], 'occupied')
            self.assertEqual(stale.atualidade[0, 2, 4], 'stale')
            self.assertEqual(len(stale.grafo), 0)
            now[0] += 1.1
            expired = pipeline.processa(np.zeros_like(image))
            self.assertEqual(expired.observacoes[0, 2, 4], 'unknown')
            self.assertEqual(expired.atualidade[0, 2, 4], 'unknown')
            self.assertTrue(expired.mudou)

    def test_grid_fit_without_any_readable_position_is_invalid(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        image = cv.imread(str(folder / 'frame-00.jpg'))
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / 'cal.json')
            salva(path, image, [[260, 375], [1035, 406], [1050, 670], [237, 631]])
            pipeline = PipelineAtual(path)
            for _ in range(3):
                stable = pipeline.processa(image)
            self.assertTrue(stable.valido)
            glare = np.full((cfg.ALTURA_RET, cfg.LARGURA_RET, 3), 255, np.uint8)
            with mock.patch('visao.pipeline_atual.retifica', return_value=glare):
                unreadable = pipeline.processa(image)
            self.assertTrue(unreadable.registro['valido'])
            self.assertFalse(unreadable.valido)
            self.assertIn('nenhuma posição', unreadable.motivo)
            self.assertEqual(unreadable.componentes, [])
            self.assertEqual(unreadable.atualidade[0, 2, 4], 'stale')
            self.assertFalse(unreadable.completo)

    def test_automatic_reacquisition_clears_previous_mapping(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        image = cv.imread(str(folder / 'frame-00.jpg'))
        now = [10.0]
        pipeline = PipelineAtual(clock=lambda: now[0])
        for _ in range(3):
            stable = pipeline.processa(image)
        self.assertEqual(stable.observacoes[0, 2, 4], 'occupied')
        lost = pipeline.processa(np.zeros_like(image))
        self.assertEqual(lost.atualidade[0, 2, 4], 'stale')
        recovered = pipeline.processa(image)
        self.assertTrue(recovered.valido)
        self.assertEqual(recovered.observacoes[0, 2, 4], 'unknown')
        self.assertEqual(recovered.atualidade[0, 2, 4], 'unknown')
        self.assertEqual(recovered.componentes, [])
        self.assertEqual(recovered.pecas_sem_tipo, [])
        pipeline.processa(image)
        recovered = pipeline.processa(image)
        self.assertEqual([c.tipo for c in recovered.componentes], ['resistor_1k'])

    def test_whole_column_camera_shift_cannot_relabel_a_piece(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        image = cv.imread(str(folder / 'frame-00.jpg'))
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / 'cal.json')
            salva(path, image, [[260, 375], [1035, 406], [1050, 670], [237, 631]])
            for shift in (-78, 78):
                pipeline = PipelineAtual(path, temporal=False)
                self.assertEqual(pipeline.processa(image).componentes[0].colunas, [4, 5])
                moved = cv.warpAffine(image, np.float32([[1, 0, shift], [0, 1, 0]]), (1280, 720))
                result = pipeline.processa(moved)
                self.assertFalse(result.valido, shift)
                self.assertIn('movimento', result.motivo)
                self.assertEqual(result.componentes, [])
                self.assertTrue(all(p['atualidade'] == 'stale' for p in result.pecas_sem_tipo))

    def test_gradual_camera_motion_preserves_resistor_coordinates(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        image = cv.imread(str(folder / 'frame-00.jpg'))
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / 'cal.json')
            salva(path, image, [[260, 375], [1035, 406], [1050, 670], [237, 631]])
            pipeline = PipelineAtual(path, temporal=False)
            for shift in range(0, 79, 6):
                matrix = np.float32([[1, 0, shift], [0, 1, 0]])
                moved = cv.warpAffine(image, matrix, (1280, 720))
                result = pipeline.processa(moved)
                self.assertTrue(result.valido, shift)
                self.assertEqual([component.id for component in result.componentes],
                                 ['resistor_1k@C2:4-5'], shift)
            pipeline = PipelineAtual(path, temporal=False)
            for angle in (0, .5, 1, 2, 3, 2, 1, 0):
                matrix = cv.getRotationMatrix2D((640, 360), angle, 1)
                rotated = cv.warpAffine(image, matrix, (1280, 720))
                result = pipeline.processa(rotated)
                self.assertTrue(result.valido, angle)
                self.assertEqual([component.id for component in result.componentes],
                                 ['resistor_1k@C2:4-5'], angle)

    def test_live_json_stdout_includes_tracking_loss(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        image = cv.imread(str(folder / 'frame-00.jpg'))
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / 'cal.json')
            salva(path, image, [[260, 375], [1035, 406], [1050, 670], [237, 631]])
            pipeline = PipelineAtual(path, temporal=False)
            frames = iter([(True, image), (True, np.zeros_like(image)), (False, None)])
            capture = mock.Mock()
            capture.isOpened.return_value = True
            capture.read.side_effect = lambda: next(frames)
            args = SimpleNamespace(camera=1, travar_camera=False, profile='current',
                                   calibration=path, json='-', verbose=False, mostrar=False)
            stdout, stderr = io.StringIO(), io.StringIO()
            with mock.patch('visao.__main__.abre_camera', return_value=capture), \
                 mock.patch('visao.__main__.cria_pipeline', return_value=pipeline), \
                 mock.patch('visao.__main__.time.sleep'), \
                 mock.patch('visao.__main__.cv.destroyAllWindows'), \
                 contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                roda_camera(args)
            records = [json.loads(line) for line in stdout.getvalue().splitlines()]
            self.assertEqual([record['valido'] for record in records], [False, True, False, False])
            self.assertEqual(records[0]['motivo'], 'aguardando câmera')
            self.assertEqual(records[1]['circuito']['componentes'][0]['tipo'], 'resistor_1k')
            self.assertEqual(records[2]['circuito']['componentes'], [])
            self.assertEqual(records[2]['atualidade'][0][2][4], 'stale')
            self.assertEqual(records[3]['motivo'], 'falha ao ler frame')
            self.assertEqual(records[3]['atualidade'][0][2][4], 'unknown')
            capture.release.assert_called_once()

    def test_debug_capture_preserves_original_pixels_and_observation_table(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        image = cv.imread(str(folder / 'frame-00.jpg'))
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / 'cal.json')
            salva(path, image, [[260, 375], [1035, 406], [1050, 670], [237, 631]])
            result = PipelineAtual(path, temporal=False).processa(image)
            output = Path(tmp) / 'debug'
            salva_debug(str(output), 'sample', image, result)
            self.assertTrue(np.array_equal(cv.imread(str(output / 'sample_bruta.png')), image))
            self.assertTrue((output / 'sample_frame.jpg').exists())
            self.assertTrue((output / 'sample_placa.png').exists())
            with (output / 'sample_sockets.csv').open(newline='') as stream:
                rows = list(csv.DictReader(stream))
            resistor = next(row for row in rows if row['metade'] == 'C'
                            and row['linha'] == '2' and row['coluna'] == '4')
            self.assertEqual(resistor['observacao'], 'occupied')
            self.assertEqual(resistor['atualidade'], 'fresh')

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

    def test_blue_positions_are_stable_but_not_in_the_circuit_graph(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        image = cv.imread(str(folder / 'frame-00.jpg'))
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / 'cal.json')
            salva(path, image, [[260, 375], [1035, 406], [1050, 670], [237, 631]])
            pipeline = PipelineAtual(path)
            for index in range(5):
                result = pipeline.processa(cv.imread(str(folder / f'frame-{index:02}.jpg')))
                if index < 2:
                    self.assertEqual(result.pecas_sem_tipo, [])
                    continue
                positions = {(p['linha'], tuple(p['colunas']), p['atualidade'])
                             for p in result.pecas_sem_tipo}
                expected = {(0, (1, 2), 'fresh'), (0, (7, 8), 'fresh'),
                            (4, (2, 3), 'fresh'), (4, (6, 7), 'fresh'), (4, (9, 10), 'fresh')}
                self.assertEqual(positions, expected)
                self.assertEqual([c.tipo for c in result.componentes], ['resistor_1k'])
                self.assertFalse(result.completo)
                self.assertEqual(result.observacoes[0, 4, 2], 'occupied')
            without_blue = copy.copy(result)
            without_blue.pecas_sem_tipo = []
            self.assertFalse(np.array_equal(desenha_tela(result), desenha_tela(without_blue)))
            self.assertFalse(np.array_equal(desenha_frame(image, result), desenha_frame(image, without_blue)))

    def test_blue_positions_with_lighting_change_and_local_occlusion(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        image = cv.imread(str(folder / 'frame-00.jpg'))
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / 'cal.json')
            salva(path, image, [[260, 375], [1035, 406], [1050, 670], [237, 631]])
            expected = {(0, (1, 2)), (0, (7, 8)), (4, (2, 3)), (4, (6, 7)), (4, (9, 10))}
            for alpha, beta in ((1, 0), (.8, 0), (1, -20)):
                adjusted = cv.convertScaleAbs(image, alpha=alpha, beta=beta)
                result = PipelineAtual(path, temporal=False).processa(adjusted)
                found = {(p['linha'], tuple(p['colunas'])) for p in result.pecas_sem_tipo}
                self.assertEqual(found, expected, (alpha, beta))
            now = [0.0]
            pipeline = PipelineAtual(path, clock=lambda: now[0])
            for _ in range(3):
                pipeline.processa(image)
            covered = image.copy()
            covered[525:605, 375:515] = 0
            now[0] = 1.0
            result = pipeline.processa(covered)
            self.assertTrue(result.valido)
            states = {(p['linha'], tuple(p['colunas'])): p['atualidade'] for p in result.pecas_sem_tipo}
            self.assertEqual(states[(4, (2, 3))], 'stale')
            self.assertTrue(all(states[key] == 'fresh' for key in expected - {(4, (2, 3))}))
            self.assertEqual([c.tipo for c in result.componentes], ['resistor_1k'])
            now[0] = 2.1
            result = pipeline.processa(covered)
            self.assertNotIn((4, (2, 3)), {(p['linha'], tuple(p['colunas'])) for p in result.pecas_sem_tipo})
            self.assertEqual(result.atualidade[0, 4, 2], 'unknown')

    def test_resistor_terminal_occlusion_removes_it_from_current_graph(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        image = cv.imread(str(folder / 'frame-00.jpg'))
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / 'cal.json')
            salva(path, image, [[260, 375], [1035, 406], [1050, 670], [237, 631]])
            for left, right in ((540, 580), (645, 685)):
                pipeline = PipelineAtual(path)
                for _ in range(3):
                    stable = pipeline.processa(image)
                self.assertEqual([c.tipo for c in stable.componentes], ['resistor_1k'])
                covered = image.copy()
                covered[425:500, left:right] = 0
                result = pipeline.processa(covered)
                self.assertTrue(result.valido)
                self.assertEqual(result.componentes, [])
                self.assertEqual(result.atualidade[0, 2, 4], 'stale')
                self.assertEqual(len(result.pecas_sem_tipo), 5)

    def test_blue_terminal_occlusion_does_not_publish_footprint(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        image = cv.imread(str(folder / 'frame-00.jpg'))
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / 'cal.json')
            salva(path, image, [[260, 375], [1035, 406], [1050, 670], [237, 631]])
            for left, right in ((375, 410), (475, 515)):
                covered = image.copy()
                covered[525:605, left:right] = 0
                result = PipelineAtual(path, temporal=False).processa(covered)
                self.assertTrue(result.valido)
                self.assertNotIn((4, (2, 3)), {(p['linha'], tuple(p['colunas']))
                                               for p in result.pecas_sem_tipo})
                self.assertEqual([c.tipo for c in result.componentes], ['resistor_1k'])

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

    def test_large_local_occlusion_preserves_other_observations(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        image = cv.imread(str(folder / 'frame-00.jpg'))
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / 'cal.json')
            salva(path, image, [[260, 375], [1035, 406], [1050, 670], [237, 631]])
            now = [0.0]
            pipeline = PipelineAtual(path, clock=lambda: now[0])
            for _ in range(3):
                pipeline.processa(image)
            covered = image.copy()
            covered[320:700, :510] = 0
            now[0] = 1.0
            result = pipeline.processa(covered)
            self.assertTrue(result.valido)
            self.assertEqual(result.atualidade[0, 0, 1], 'stale')
            self.assertEqual(result.atualidade[0, 2, 4], 'fresh')
            self.assertEqual([c.tipo for c in result.componentes], ['resistor_1k'])
            now[0] = 2.1
            result = pipeline.processa(covered)
            self.assertEqual(result.observacoes[0, 0, 1], 'unknown')
            self.assertEqual(result.atualidade[0, 2, 4], 'fresh')

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

    def test_automatic_registration_with_camera_rotation(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        image = cv.imread(str(folder / 'frame-00.jpg'))
        expected = {(0, (1, 2)), (0, (7, 8)), (4, (2, 3)), (4, (6, 7)), (4, (9, 10))}
        for angle in (-3, 0, 3):
            matrix = cv.getRotationMatrix2D((640, 360), angle, 1)
            rotated = cv.warpAffine(image, matrix, (1280, 720))
            result = PipelineAtual(temporal=False).processa(rotated)
            self.assertTrue(result.valido, angle)
            self.assertEqual([c.id for c in result.componentes], ['resistor_1k@C2:4-5'])
            self.assertEqual({(p['linha'], tuple(p['colunas'])) for p in result.pecas_sem_tipo}, expected)

    def test_automatic_registration_with_perspective_change(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        image = cv.imread(str(folder / 'frame-00.jpg'))
        corners = np.float32([[0, 0], [1279, 0], [1279, 719], [0, 719]])
        expected = {(0, (1, 2)), (0, (7, 8)), (4, (2, 3)), (4, (6, 7)), (4, (9, 10))}
        for offset in (-20, 20, 45):
            target = corners + np.float32([[offset, 0], [-offset, 0], [0, 0], [0, 0]])
            matrix = cv.getPerspectiveTransform(corners, target)
            transformed = cv.warpPerspective(image, matrix, (1280, 720))
            result = PipelineAtual(temporal=False).processa(transformed)
            self.assertTrue(result.valido, offset)
            self.assertEqual([c.id for c in result.componentes], ['resistor_1k@C2:4-5'])
            self.assertEqual({(p['linha'], tuple(p['colunas'])) for p in result.pecas_sem_tipo}, expected)

    def test_each_captured_frame_auto_calibrates_independently(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        expected = {(0, (1, 2)), (0, (7, 8)), (4, (2, 3)), (4, (6, 7)), (4, (9, 10))}
        for path in sorted(folder.glob('frame-*.jpg')):
            with self.subTest(frame=path.name):
                result = PipelineAtual(temporal=False).processa(cv.imread(str(path)))
                self.assertTrue(result.valido)
                self.assertFalse(result.completo)
                self.assertEqual([c.id for c in result.componentes], ['resistor_1k@C2:4-5'])
                self.assertEqual({(p['linha'], tuple(p['colunas'])) for p in result.pecas_sem_tipo}, expected)
                self.assertTrue(all(result.observacoes[0, row, col] == 'occupied'
                                    for row, cols in expected for col in cols))

    def test_empty_openings_need_stability_and_never_cover_known_pieces(self):
        folder = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
        image = cv.imread(str(folder / 'frame-00.jpg'))
        occupied = {(0, 1), (0, 2), (0, 7), (0, 8), (2, 4), (2, 5),
                    (4, 2), (4, 3), (4, 6), (4, 7), (4, 9), (4, 10)}
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / 'cal.json')
            salva(path, image, [[260, 375], [1035, 406], [1050, 670], [237, 631]])
            now = [0.0]
            pipeline = PipelineAtual(path, clock=lambda: now[0])
            self.assertEqual(pipeline.processa(image).observacoes[0, 1, 0], 'unknown')
            pipeline.processa(image)
            result = pipeline.processa(image)
            self.assertEqual(result.observacoes[0, 1, 0], 'empty')
            self.assertEqual(result.atualidade[0, 1, 0], 'fresh')
            self.assertTrue(all(result.observacoes[0, row, col] == 'occupied' for row, col in occupied))
            lost = pipeline.processa(np.zeros_like(image))
            self.assertEqual(lost.observacoes[0, 1, 0], 'empty')
            self.assertEqual(lost.atualidade[0, 1, 0], 'stale')
            now[0] = 2.1
            self.assertEqual(pipeline.processa(np.zeros_like(image)).observacoes[0, 1, 0], 'unknown')
            for alpha, beta in ((.8, 0), (1, -20), (1.15, 0), (1, 20)):
                adjusted = cv.convertScaleAbs(image, alpha=alpha, beta=beta)
                result = PipelineAtual(path, temporal=False).processa(adjusted)
                self.assertTrue(all(result.observacoes[0, row, col] != 'empty' for row, col in occupied),
                                (alpha, beta))

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
