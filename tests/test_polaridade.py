from pathlib import Path

import cv2 as cv
import numpy as np

from visao import config as cfg
from visao.calibracao_bancada import four_sticker_proposal
from visao.polaridade import read_polarity
from visao.sockets import retifica


def test_actual_printed_battery_and_opposite_led_polarities():
    path = Path(__file__).resolve().parents[1] / 'visao/fixtures/current/full-board-2026-11-13/frame-00.jpg'
    frame = cv.imread(str(path))
    h = four_sticker_proposal(frame)['banks'][0]['H']
    rect = retifica(frame, h)
    for kind, row, first, last, positive in [('vermelho_2', 5, 9, 10, 9),
                                           ('led', 2, 6, 7, 7), ('led', 2, 9, 10, 9)]:
        result = read_polarity(rect, row, first, last, kind)
        assert result['status'] == 'known', (kind, result)
        assert result['positive'] == positive
        assert result['negative'] == (last if positive == first else first)


def test_missing_or_conflicting_printed_signs_never_get_default_polarity():
    for signs in ((), ('+',), ('-',), ('+', '+'), ('-', '-')):
        image = np.zeros((cfg.ALTURA_RET, cfg.LARGURA_RET, 3), np.uint8)
        row, first, last = 2, 3, 4
        y = round(cfg.para_retificada(first, row)[1]) - 22
        for col, sign in zip((first, last), signs):
            x = round(cfg.para_retificada(col, row)[0]) + 10
            cv.line(image, (x - 6, y), (x + 6, y), (220, 220, 220), 3)
            if sign == '+':
                cv.line(image, (x, y - 6), (x, y + 6), (220, 220, 220), 3)
        assert read_polarity(image, row, first, last, 'led')['status'] == 'unknown', signs


def test_complementary_signs_in_both_directions():
    for reversed_ in (False, True):
        image = np.full((cfg.ALTURA_RET, cfg.LARGURA_RET, 3), (50, 90, 50), np.uint8)
        row, first, last = 2, 3, 4
        y = round(cfg.para_retificada(first, row)[1]) - 22
        for col, sign in zip((first, last), ('-', '+') if reversed_ else ('+', '-')):
            x = round(cfg.para_retificada(col, row)[0]) + 10
            cv.line(image, (x - 6, y), (x + 6, y), (220, 220, 220), 3)
            if sign == '+':
                cv.line(image, (x, y - 6), (x, y + 6), (220, 220, 220), 3)
        result = read_polarity(image, row, first, last, 'led')
        assert result['status'] == 'known'
        assert result['positive'] == (last if reversed_ else first)
