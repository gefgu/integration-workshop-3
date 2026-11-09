import tempfile
import unittest
from unittest import mock
from pathlib import Path
import cv2 as cv
import numpy as np
from visao.calibracao import salva, RegistradorParcial, calibra_automaticamente, calibra_interativa, CANTOS


class TestPartialCalibration(unittest.TestCase):
    def test_saved_frames_and_empty_image(self):
        root = Path(__file__).resolve().parents[1]
        frames = sorted((root / 'visao/fixtures/current').glob('frame-*.jpg'))
        self.assertEqual(len(frames), 5)
        with tempfile.TemporaryDirectory() as folder:
            path = str(Path(folder) / 'calibration.json')
            image = cv.imread(str(frames[0]))
            salva(path, image, [[260,375],[1035,406],[1050,670],[237,631]])
            tracker = RegistradorParcial(path)
            for frame in frames:
                result = tracker.atualiza(cv.imread(str(frame)))
                self.assertTrue(result['valido'], str(frame))
                self.assertGreaterEqual(result['inliers'],12)
                self.assertFalse(result['furos_vistos'][66:].any())
            self.assertFalse(tracker.atualiza(np.zeros_like(image))['valido'])
            size_mismatch = tracker.atualiza(cv.resize(image,(640,360)))
            self.assertFalse(size_mismatch['valido'])
            self.assertIn('resolução', size_mismatch['motivo'])

    def test_failed_automatic_search_is_not_repeated_every_frame(self):
        now = [100.0]
        tracker = RegistradorParcial(clock=lambda: now[0])
        blank = np.zeros((720, 1280, 3), np.uint8)
        with mock.patch('visao.calibracao.calibra_automaticamente', return_value=None) as search:
            first = tracker.atualiza(blank)
            for _ in range(5):
                now[0] += .2
                throttled = tracker.atualiza(blank)
            self.assertEqual(search.call_count, 1)
            self.assertFalse(throttled['valido'])
            self.assertEqual(throttled['motivo'], first['motivo'])
            now[0] += 2
            tracker.atualiza(blank)
            self.assertEqual(search.call_count, 2)
            tracker.recalibrar()  # explicit request searches again at once
            tracker.atualiza(blank)
            self.assertEqual(search.call_count, 3)

    def test_invalid_corner_selection(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(ValueError):
                salva(str(Path(folder)/'bad.json'),np.zeros((720,1280,3),np.uint8),[[0,0]]*4)

    def test_automatic_registration_and_ambiguous_crops(self):
        root = Path(__file__).resolve().parents[1]
        image = cv.imread(str(root / 'visao/fixtures/current/frame-00.jpg'))
        result = RegistradorParcial().atualiza(image)
        self.assertTrue(result['valido'])
        corners = cv.perspectiveTransform(CANTOS[None], result['H'])[0]
        expected = np.float32([[260, 375], [1035, 406], [1050, 670], [237, 631]])
        self.assertLess(np.linalg.norm(corners - expected, axis=1).max(), 12)
        for region in ((slice(None), slice(None, 370)), (slice(None), slice(900, None)),
                       (slice(300, 450), slice(None)), (slice(580, None), slice(None))):
            cropped = image.copy()
            cropped[region] = 0
            self.assertIsNone(calibra_automaticamente(cropped), str(region))
        disassembled = cv.imread(str(root / 'visao/fixtures/current/sem-grade.jpg'))
        self.assertIsNone(calibra_automaticamente(disassembled))
        result = RegistradorParcial().atualiza(disassembled)
        self.assertFalse(result['valido'])
        self.assertIn('origem ambígua', result['motivo'])

    def test_interactive_calibration_previews_before_saving(self):
        image = np.zeros((720, 1280, 3), np.uint8)
        callbacks = []
        clicks = [[260, 375], [1035, 406], [1050, 670], [237, 631]]
        keys = iter([0, 13, 13])
        with tempfile.TemporaryDirectory() as folder:
            path = str(Path(folder) / 'manual.json')
            def set_callback(window, callback):
                callbacks.append(callback)
            def wait(_delay):
                key = next(keys)
                if key == 0:
                    for x, y in clicks:
                        callbacks[0](cv.EVENT_LBUTTONDOWN, x, y, None, None)
                if key == 13:
                    self.assertFalse(Path(path).exists())
                return key
            with mock.patch('visao.calibracao.cv.namedWindow'), \
                 mock.patch('visao.calibracao.cv.setMouseCallback', side_effect=set_callback), \
                 mock.patch('visao.calibracao.cv.imshow') as show, \
                 mock.patch('visao.calibracao.cv.waitKey', side_effect=wait), \
                 mock.patch('visao.calibracao.cv.destroyWindow'):
                self.assertTrue(calibra_interativa(image, path))
            self.assertGreaterEqual(show.call_count, 3)
            self.assertTrue(Path(path).exists())
            self.assertEqual(RegistradorParcial(path).size, [1280, 720])

    def test_interactive_cancel_does_not_save(self):
        image = np.zeros((720, 1280, 3), np.uint8)
        with tempfile.TemporaryDirectory() as folder:
            path = str(Path(folder) / 'manual.json')
            with mock.patch('visao.calibracao.cv.namedWindow'), \
                 mock.patch('visao.calibracao.cv.setMouseCallback'), \
                 mock.patch('visao.calibracao.cv.imshow'), \
                 mock.patch('visao.calibracao.cv.waitKey', return_value=27), \
                 mock.patch('visao.calibracao.cv.destroyWindow'):
                self.assertFalse(calibra_interativa(image, path))
            self.assertFalse(Path(path).exists())

    def test_random_rectangles_do_not_form_a_board(self):
        rng = np.random.default_rng(138)
        image = np.zeros((720, 1280, 3), np.uint8)
        for x, y in rng.integers([30, 30], [1230, 675], size=(65, 2)):
            cv.rectangle(image, (int(x), int(y)), (int(x + 30), int(y + 22)), (200, 200, 200), -1)
        self.assertIsNone(calibra_automaticamente(image))
