"""Resistor colour bands, read from the Nov 11 low-exposure stills of the live bench.

Positions (row, first column) on the board: 220 Ω at (1, 1), 1 kΩ at (1, 4), 470 Ω at
(3, 2); the banded-less capacitor body is at (1, 8). The values come from the colour bands
in the images, not from the kit inventory. `bands-2026-11-11-1.jpg` is the normal exposure;
`-exp800` and `-exp1000` are the exposures the service uses for the band read.
"""
import unittest
from pathlib import Path
from unittest import mock

import cv2 as cv
import numpy as np

from visao.bandas_resistor import le_valor
from visao.pipeline_atual import MIN_ASSINATURA, PipelineAtual, assinatura_corpo

FIXTURES = Path(__file__).resolve().parents[1] / 'visao' / 'fixtures' / 'current'
BODIES = {(1, 1): 220, (1, 4): 1000, (3, 2): 470}
CAPACITOR = (1, 8)


def load(name, small=False):
    image = cv.imread(str(FIXTURES / f'bands-2026-11-11-{name}.jpg'))
    return cv.resize(image, (1280, 720), interpolation=cv.INTER_AREA) if small else image


def registered(small=False):
    pipeline = PipelineAtual(temporal=False)
    result = pipeline.processa(load('1', small))
    assert result.valido, result.motivo
    return pipeline, result


class BandDecoderTest(unittest.TestCase):
    def test_values_at_the_service_exposures_in_both_resolutions(self):
        for small in (False, True):
            pipeline, _ = registered(small)
            for exposure in ('exp800', 'exp1000'):
                frame = load(exposure, small)
                for pos, ohms in BODIES.items():
                    with self.subTest(small=small, exposure=exposure, pos=pos):
                        self.assertEqual(le_valor(frame, pipeline.registrador.H, *pos)['valor'], ohms)

    def test_capacitor_and_empty_positions_are_never_a_resistor(self):
        pipeline, _ = registered()
        for exposure in ('exp800', 'exp1000', 'exp1300'):
            for pos in (CAPACITOR, (3, 8), (0, 3), (5, 0)):
                with self.subTest(exposure=exposure, pos=pos):
                    self.assertIsNone(le_valor(load(exposure), pipeline.registrador.H, *pos)['valor'])

    def test_normal_exposure_is_refused_instead_of_guessed(self):
        pipeline, _ = registered()
        for name in ('1', '2', '3'):
            for pos in BODIES:
                with self.subTest(frame=name, pos=pos):
                    self.assertIsNone(le_valor(load(name), pipeline.registrador.H, *pos)['valor'])

    def test_too_dark_or_too_bright_exposure_is_never_a_wrong_value(self):
        pipeline, _ = registered()
        for exposure in ('exp1300', 'exp400'):
            for pos, ohms in BODIES.items():
                with self.subTest(exposure=exposure, pos=pos):
                    self.assertIn(le_valor(load(exposure), pipeline.registrador.H, *pos)['valor'], (None, ohms))


class PipelineBandsTest(unittest.TestCase):
    def setUp(self):
        self.now = [0.0]
        self.pipeline = PipelineAtual(temporal=False, clock=lambda: self.now[0])
        self.normal = load('1')
        self.result = self.pipeline.processa(self.normal)
        self.assertTrue(self.result.valido, self.result.motivo)

    def kinds(self, result):
        return {(c.tipo, c.linha, tuple(c.colunas)) for c in result.componentes}

    def unknown(self, result):
        return {(q['linha'], tuple(q['colunas'])) for q in result.pecas_sem_tipo}

    def test_bodies_are_unknown_until_their_bands_are_read(self):
        self.assertFalse(any(k[0].startswith('resistor') for k in self.kinds(self.result)))
        self.assertTrue({(1, (1, 2)), (1, (4, 5)), (3, (2, 3)), (1, (8, 9))} <= self.unknown(self.result))
        self.assertTrue(self.pipeline.precisa_bandas())

    def test_read_bands_publish_three_distinct_resistors_and_leave_the_capacitor_unknown(self):
        read = self.pipeline.registra_bandas([load('exp800'), load('exp1000')])
        self.assertEqual(read, {(1, 1): 220, (1, 4): 1000, (1, 8): None, (3, 2): 470})
        result = self.pipeline.processa(self.normal)
        self.assertTrue({('resistor_220', 1, (1, 2)), ('resistor_1k', 1, (4, 5)),
                         ('resistor_470', 3, (2, 3))} <= self.kinds(result))
        self.assertIn((1, (8, 9)), self.unknown(result))
        self.assertNotIn((1, (1, 2)), self.unknown(result))

    def test_one_decoded_frame_is_not_enough(self):
        self.assertEqual(self.pipeline.registra_bandas([load('exp800'), load('1')]),
                         {(1, 1): None, (1, 4): None, (1, 8): None, (3, 2): None})

    def test_conflicting_frames_remove_the_value(self):
        self.pipeline.registra_bandas([load('exp800'), load('exp1000')])
        replies = iter([{'valor': 220}, {'valor': 470}] * 4)
        with mock.patch('visao.pipeline_atual.le_valor', side_effect=lambda *a: next(replies)):
            read = self.pipeline.registra_bandas([load('exp800'), load('exp1000')])
        self.assertIsNone(read[(1, 1)])
        self.assertNotIn((1, 1), self.pipeline.valores_resistor)

    def test_failed_readings_back_off_and_a_new_body_resets_the_wait(self):
        self.pipeline.registra_bandas([load('exp800'), load('exp1000')])
        self.assertFalse(self.pipeline.precisa_bandas())
        self.now[0] += 5
        self.assertFalse(self.pipeline.precisa_bandas())
        self.now[0] += 2  # the capacitor is retried after 6 s
        self.assertTrue(self.pipeline.precisa_bandas())
        self.pipeline.registra_bandas([load('exp800'), load('exp1000')])
        self.assertEqual(self.pipeline.tentativa_bandas[CAPACITOR]['intervalo'], 12.0)
        self.pipeline.tentativa_bandas[CAPACITOR]['assinatura'] = -self.pipeline.assinaturas[CAPACITOR]
        self.pipeline.processa(self.normal)
        self.assertNotIn(CAPACITOR, self.pipeline.tentativa_bandas)
        self.assertTrue(self.pipeline.precisa_bandas())

    def test_values_are_reverified_periodically(self):
        self.pipeline.registra_bandas([load('exp800'), load('exp1000')])
        self.pipeline.tentativa_bandas.clear()
        self.now[0] += 21
        self.assertTrue(self.pipeline.precisa_bandas())

    def test_a_different_body_at_the_same_position_loses_the_value_at_once(self):
        self.pipeline.registra_bandas([load('exp800'), load('exp1000')])
        # The same physical body keeps its value across frames...
        for name in ('2', '3'):
            result = self.pipeline.processa(load(name))
            self.assertIn(('resistor_220', 1, (1, 2)), self.kinds(result))
        # ...while a body that no longer looks like the one that was read does not.
        self.pipeline.valores_resistor[(1, 1)]['assinatura'] = self.pipeline.assinaturas[(1, 4)]
        result = self.pipeline.processa(self.normal)
        self.assertNotIn((1, 1), self.pipeline.valores_resistor)
        self.assertNotIn(('resistor_220', 1, (1, 2)), self.kinds(result))
        self.assertIn((1, (1, 2)), self.unknown(result))

    def test_body_signatures_separate_the_physical_resistors(self):
        _, result = registered()
        sigs = {pos: assinatura_corpo(result.retificada, *pos) for pos in list(BODIES) + [CAPACITOR]}
        for a in sigs:
            for b in sigs:
                if a != b:
                    self.assertLess(float(sigs[a] @ sigs[b]), MIN_ASSINATURA - .2, (a, b))
        for name in ('2', '3'):
            again = PipelineAtual(temporal=False).processa(load(name))
            for pos in sigs:
                self.assertGreater(float(sigs[pos] @ assinatura_corpo(again.retificada, *pos)), .9, (name, pos))

    def test_a_lost_grid_blocks_band_reads(self):
        self.pipeline.processa(np.zeros((720, 1280, 3), np.uint8))
        self.assertFalse(self.pipeline.precisa_bandas())
        self.assertEqual(self.pipeline.registra_bandas([load('exp800'), load('exp1000')]), {})


if __name__ == '__main__':
    unittest.main()
