from pathlib import Path

import cv2 as cv
import numpy as np

from visao.calibracao_bancada import GRID, contact_candidates, fit_bank, four_sticker_proposal

FIXTURES = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'


def test_current_populated_board_calibrates_both_banks_at_capture_sizes():
    image = cv.imread(str(FIXTURES / 'full-board-2026-11-13/frame-00.jpg'))
    for width, height in ((1280, 720), (1920, 1080)):
        frame = cv.resize(image, (width, height), interpolation=cv.INTER_AREA)
        result = four_sticker_proposal(frame)
        assert result is not None
        assert len(result['banks']) == 2
        assert all(bank['inliers'] >= 12 and bank['erro'] < 3 for bank in result['banks'])


def test_four_sticker_calibration_rejects_each_missing_marker():
    image = cv.imread(str(FIXTURES / 'full-board-2026-11-13/frame-00.jpg'))
    for x0, y0, x1, y1 in ((220, 70, 270, 130), (875, 40, 940, 100),
                            (915, 585, 980, 645), (220, 625, 280, 680)):
        missing = image.copy()
        missing[y0:y1, x0:x1] = 0
        assert four_sticker_proposal(missing) is None, (x0, y0)


def test_four_sticker_calibration_preserves_clipped_grid_rejection():
    for path in sorted(FIXTURES.glob('crowded-cropped-*.jpg')):
        assert four_sticker_proposal(cv.imread(str(path))) is None, path.name
    assert four_sticker_proposal(np.zeros((720, 1280, 3), np.uint8)) is None


def test_marker_proposal_without_distributed_socket_support_is_rejected():
    h = np.float64([[60, 0, 200], [0, 40, 300], [0, 0, 1]])
    for model in (GRID[:11], GRID[[0, 1, 2, 11, 12, 13, 22, 23, 24, 33, 34, 35]]):
        points = cv.perspectiveTransform(model[None], h)[0]
        assert fit_bank(h, points, (720, 1280, 3)) is None


def test_rectangular_dim_copper_contacts_are_found():
    image = np.zeros((720, 1280, 3), np.uint8)
    cv.rectangle(image, (200, 200), (225, 210), (65, 65, 65), -1)
    points = contact_candidates(image)
    assert np.any(np.linalg.norm(points - [212.5, 205], axis=1) < 1)
