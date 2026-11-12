import unittest
from types import SimpleNamespace

import numpy as np

from bench_service.vision import PieceHold, REMOVAL_CONFIRM_FRAMES


class PieceHoldTest(unittest.TestCase):
    def setUp(self):
        self.hold = PieceHold()
        self.piece = {'id': 'led', 'type': 'led', 'row': 2, 'a': 7, 'b': 8}
        self.result = SimpleNamespace(valido=True, registro={'valido': True, 'generation': 1},
                                      atualidade=np.full((2, 6, 11), 'unknown', dtype=object),
                                      observacoes=np.full((2, 6, 11), 'unknown', dtype=object))

    def update(self, pieces):
        return self.hold.update(pieces, self.result)

    def test_miss_and_visible_removal(self):
        self.assertEqual(self.update([self.piece]), ([self.piece], False))
        self.assertEqual(self.update([]), ([self.piece], True))
        self.assertEqual(self.update([self.piece]), ([self.piece], False))
        self.result.atualidade[0, 3, 6:8] = 'fresh'
        self.result.observacoes[0, 3, 6:8] = 'empty'
        for _ in range(REMOVAL_CONFIRM_FRAMES - 1):
            self.assertEqual(self.update([]), ([self.piece], True))
        self.assertEqual(self.update([]), ([], False))

    def test_occlusion_and_new_mapping(self):
        self.update([self.piece])
        self.result.valido = False
        self.assertEqual(self.update([]), ([self.piece], True))
        self.result.valido = True
        self.assertEqual(self.update([]), ([self.piece], True))
        self.result.registro['generation'] = 2
        self.assertEqual(self.update([]), ([], False))

    def test_ambiguous_frame_resets_removal_confirmation(self):
        self.update([self.piece])
        self.result.atualidade[0, 3, 6:8] = 'fresh'
        self.result.observacoes[0, 3, 6:8] = 'empty'
        for _ in range(REMOVAL_CONFIRM_FRAMES - 1):
            self.update([])
        self.result.valido = False
        self.assertEqual(self.update([]), ([self.piece], True))
        self.result.valido = True
        for _ in range(REMOVAL_CONFIRM_FRAMES - 1):
            self.assertEqual(self.update([]), ([self.piece], True))
        self.assertEqual(self.update([]), ([], False))

    def test_fresh_unknown_body_invalidates_held_resistor_value(self):
        resistor = {'id': 'resistor', 'type': 'resistor_470', 'row': 3, 'a': 3, 'b': 4}
        self.assertEqual(self.update([resistor]), ([resistor], False))
        self.result.pecas_sem_tipo = [{'metade': 'C', 'linha': 2, 'colunas': [2, 3], 'atualidade': 'fresh'}]
        self.assertEqual(self.update([]), ([], True))
        self.result.pecas_sem_tipo = []
        self.assertEqual(self.update([]), ([], False))

    def test_demo_holds_brief_empty_readings_and_replaces_old_led_position(self):
        self.hold = PieceHold(demo_assume_1k=True)
        self.update([self.piece])
        self.result.atualidade[0, 3, 6:8] = 'fresh'
        self.result.observacoes[0, 3, 6:8] = 'empty'
        for _ in range(7):
            self.assertEqual(self.update([]), ([self.piece], True))
        new = dict(self.piece, id='moved-led', row=3)
        self.assertEqual(self.update([new]), ([new], False))
        self.result.atualidade[0, 2, 6:8] = 'fresh'
        self.result.observacoes[0, 2, 6:8] = 'empty'
        for _ in range(7):
            self.assertEqual(self.update([]), ([new], True))
        self.assertEqual(self.update([]), ([], False))

    def test_demo_move_replaces_held_position_without_removing_fresh_pieces(self):
        self.hold = PieceHold(demo_assume_1k=True)
        for kind in ('led', 'resistor_1k', 'bateria', 'jumper_3'):
            with self.subTest(kind=kind):
                old = dict(self.piece, id=f'{kind}-old', type=kind)
                new = dict(old, id=f'{kind}-new', row=4, a=2, b=3)
                self.hold = PieceHold(demo_assume_1k=True)
                self.update([old])
                self.assertEqual(self.update([new]), ([new], False))
                self.assertEqual(self.update([old, new]), ([new, old], False))

    def test_normal_mode_does_not_assume_same_type_is_same_piece(self):
        old = dict(self.piece, id='old')
        new = dict(old, id='new', row=4, a=2, b=3)
        self.update([old])
        self.assertEqual(self.update([new]), ([new, old], True))


if __name__ == '__main__':
    unittest.main()
