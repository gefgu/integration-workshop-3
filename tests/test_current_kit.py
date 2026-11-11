"""Regression checks for the photographed test-kit arrangement."""
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import cv2 as cv

from visao.pipeline_atual import PipelineAtual

FIXTURES = Path(__file__).resolve().parents[1] / 'visao' / 'fixtures' / 'current'


class CurrentKitTest(unittest.TestCase):
    def test_edge_battery_remains_recognized_across_real_frames(self):
        expected = {'buzzer', 'jumper_4', 'led', 'vermelho_2', 'resistor_1k'}
        for prefix in ('edge-test', 'edge-occluded'):
            for index in range(8):
                image = cv.imread(str(FIXTURES / f'{prefix}-{index}.jpg'))
                result = PipelineAtual(temporal=False).processa(image)
                self.assertTrue(result.valido, (prefix, index, result.motivo))
                self.assertEqual({part.tipo for part in result.componentes}, expected, (prefix, index))

    def test_four_gap_white_jumper_shape(self):
        import numpy as np
        from visao import config as cfg
        from visao.pecas_atuais import pecas_kit
        image = np.zeros((cfg.ALTURA_RET, cfg.LARGURA_RET, 3), dtype=np.uint8)
        cx, cy = cfg.para_retificada(3, 3)
        left = int(cx + 20 - 166)
        cv.rectangle(image, (left, int(cy - 35)), (left + 331, int(cy + 3)), (230, 230, 230), -1)
        self.assertIn(('jumper_4', 'branco', 3, 1, 5), pecas_kit(image))

    def test_photographed_buzzer_and_smart_presence(self):
        for index in (1, 2, 3):
            result = PipelineAtual(temporal=False).processa(cv.imread(str(FIXTURES / f'buzzer-smart-frame-{index}.jpg')))
            self.assertTrue(result.valido, result.motivo)
            pieces = {(c.tipo, c.linha, tuple(c.colunas)) for c in result.componentes}
            self.assertIn(('buzzer', 2, (6, 7)), pieces)
            self.assertIn(('capsula_smart', 5, (4, 5, 6)), pieces)
            self.assertIn(('resistor_1k', 3, (8, 9)), pieces)

    def test_smart_component_is_not_assumed_to_have_a_mode(self):
        from bench_service.vision import to_pieces
        from visao.circuito import para_dict
        image = cv.imread(str(FIXTURES / 'buzzer-smart-frame-1.jpg'))
        result = PipelineAtual(temporal=False).processa(image)
        pieces, unknown = to_pieces(para_dict(result.grafo))
        self.assertFalse(any(p['type'].startswith('capsula_') for p in pieces))
        self.assertTrue(any(p['type'] == 'capsula_smart' for p in unknown))

    def test_red_led_lens_is_not_misidentified_as_buzzer_or_battery(self):
        image = cv.imread(str(FIXTURES / 'led-buzzer-smart-2026-11-11.jpg'))
        result = PipelineAtual(temporal=False).processa(image)
        self.assertTrue(result.valido, result.motivo)
        pieces = {(c.tipo, c.linha, tuple(c.colunas)) for c in result.componentes}
        self.assertIn(('led', 4, (7, 8)), pieces)
        self.assertIn(('buzzer', 2, (6, 7)), pieces)
        self.assertIn(('capsula_smart', 5, (4, 5, 6)), pieces)

    def test_current_colour_diagnostics_are_computed_only_when_requested(self):
        from visao.debug import tabela_sockets
        from visao.sockets import le_placa
        image = cv.imread(str(FIXTURES / 'reference-completed.jpg'))
        with patch('visao.sockets.le_placa', wraps=le_placa) as classify:
            result = PipelineAtual(temporal=False).processa(image)
            self.assertTrue(result.valido, result.motivo)
            self.assertIsNone(result.cores)
            classify.assert_not_called()
            table = tabela_sockets(result)
            classify.assert_called_once()
            self.assertEqual([row['cor'] for row in table], result.cores.ravel().tolist())
            tabela_sockets(result)
            classify.assert_called_once()

    def test_busy_linux_camera_does_not_open_a_different_device(self):
        from visao.__main__ import abre_camera
        camera = MagicMock()
        camera.isOpened.return_value = False
        with patch('visao.__main__.sys.platform', 'linux'), patch('visao.__main__.cv.VideoCapture', return_value=camera) as open_camera:
            self.assertIs(abre_camera(3, False), camera)
        open_camera.assert_called_once_with(3, cv.CAP_V4L2)

    def test_photographed_test_kit(self):
        image = cv.imread(str(FIXTURES / 'kit-test-2026-11-10.jpg'))
        result = PipelineAtual(temporal=False).processa(image)
        self.assertTrue(result.valido, result.motivo)
        pieces = {(c.tipo, c.linha, tuple(c.colunas)) for c in result.componentes}
        self.assertIn(('vermelho_2', 4, (9, 10)), pieces)
        self.assertIn(('led', 2, (7, 8)), pieces)
        self.assertIn(('jumper_3', 1, (7, 8, 9, 10)), pieces)
        self.assertIn(('resistor_1k', 3, (8, 9)), pieces)

    def test_completed_board_reacquires_four_pieces(self):
        image = cv.imread(str(FIXTURES / 'reference-completed.jpg'))
        result = PipelineAtual(temporal=False).processa(image)
        self.assertTrue(result.valido, result.motivo)
        self.assertEqual({(c.tipo, c.linha, tuple(c.colunas)) for c in result.componentes}, {
            ('jumper_3', 0, (7, 8, 9, 10)), ('led', 2, (7, 8)),
            ('vermelho_2', 4, (9, 10)), ('resistor_1k', 3, (8, 9)),
        })

    def test_nearby_led_and_jumper_remain_separate(self):
        for filename in ('kit-test-overlap-2026-11-10.jpg', 'kit-test-overlap-locked-2026-11-10.jpg'):
            with self.subTest(image=filename):
                image = cv.imread(str(FIXTURES / filename))
                result = PipelineAtual(temporal=False).processa(image)
                self.assertTrue(result.valido, result.motivo)
                self.assertEqual({(c.tipo, c.linha, tuple(c.colunas)) for c in result.componentes}, {
                    ('jumper_3', 1, (6, 7, 8, 9)), ('led', 2, (6, 7)),
                    ('vermelho_2', 4, (8, 9)), ('resistor_1k', 3, (7, 8)),
                })

    def test_lattice_fit_does_not_span_the_gap_between_banks(self):
        from visao.calibracao import calibra_automaticamente
        image = cv.imread(str(FIXTURES / 'kit-test-overlap-locked-2026-11-10.jpg'))
        self.assertIsNone(calibra_automaticamente(image))

    def test_older_bodies_are_not_confused_with_test_kit(self):
        for index in range(5):
            image = cv.imread(str(FIXTURES / f'frame-0{index}.jpg'))
            result = PipelineAtual(temporal=False).processa(image)
            self.assertTrue(result.valido, result.motivo)
            self.assertEqual([c.tipo for c in result.componentes], [])

    def test_multiple_blue_bodies_are_not_guessed_as_one_kilohm(self):
        image = cv.imread(str(FIXTURES / 'frame-00.jpg'))
        result = PipelineAtual(temporal=False).processa(image)
        self.assertTrue(result.valido, result.motivo)
        self.assertGreaterEqual(len(result.pecas_sem_tipo), 2)
        self.assertFalse(any(c.tipo == 'resistor_1k' for c in result.componentes))

    def test_moved_resistor_at_slow_frame_rate(self):
        for filename in ('kit-test-moved-2026-11-10.jpg', 'kit-test-locked-2026-11-10.jpg'):
            with self.subTest(image=filename):
                image = cv.imread(str(FIXTURES / filename))
                now = [0.0]
                pipeline = PipelineAtual(clock=lambda: now[0])
                results = []
                for _ in range(4):
                    results.append(pipeline.processa(image))
                    now[0] += 1 / .7
                self.assertTrue(all(r.valido for r in results))
                self.assertFalse(any(c.tipo == 'resistor_1k' for c in results[1].componentes))
                for result in results[2:]:
                    self.assertIn(('resistor_1k', 1, (5, 6)),
                                  {(c.tipo, c.linha, tuple(c.colunas)) for c in result.componentes})


if __name__ == '__main__':
    unittest.main()
