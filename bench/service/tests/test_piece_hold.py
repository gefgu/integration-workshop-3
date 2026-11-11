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
        self.result.atualidade[0, 2, 6:8] = 'fresh'
        self.result.observacoes[0, 2, 6:8] = 'empty'
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
        self.result.atualidade[0, 2, 6:8] = 'fresh'
        self.result.observacoes[0, 2, 6:8] = 'empty'
        for _ in range(REMOVAL_CONFIRM_FRAMES - 1):
            self.update([])
        self.result.valido = False
        self.assertEqual(self.update([]), ([self.piece], True))
        self.result.valido = True
        for _ in range(REMOVAL_CONFIRM_FRAMES - 1):
            self.assertEqual(self.update([]), ([self.piece], True))
        self.assertEqual(self.update([]), ([], False))


if __name__ == '__main__':
    unittest.main()
