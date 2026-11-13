from pathlib import Path

import cv2 as cv
import numpy as np

from visao import config as cfg
from visao.calibracao_bancada import four_sticker_proposal
from visao.sockets import retifica
from visao.template_pecas import buzzer_candidates, buzzer_template, capacitor_candidates, capacitor_template

FIXTURES = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'


def test_buzzer_and_capacitor_templates_hold_out_the_second_camera_capture():
    for folder in ('full-board-2026-11-13', 'full-board-fixed-2026-11-13'):
        frame = cv.imread(str(FIXTURES / folder / 'frame-00.jpg'))
        registration = four_sticker_proposal(frame)
        assert registration is not None
        banks = [retifica(frame, b['H'])[:300] for b in registration['banks']]
        assert not buzzer_candidates(banks[0])
        assert buzzer_candidates(banks[1]) == [('buzzer', 'verde', 1, 9, 10)]
        # All five banded holders, the LEDs and OLED screens are negatives.
        caps = capacitor_candidates(banks[0])
        assert [item['piece'] for item in caps] == [('capacitor', 'azul', 4, 5, 6)]
        assert caps[0]['polarity']['status'] == 'known'
        assert caps[0]['polarity']['positive'] == 6
        assert not capacitor_candidates(banks[1])


def paste_template(reference, row, col, mirrored=False):
    image, mask, _, anchor = reference
    if mirrored:
        image, mask = cv.flip(image, 1), cv.flip(mask, 1)
        anchor = anchor.copy()
        anchor[0] = image.shape[1] - 1 - (anchor[0] + cfg.PX_X)
    canvas = np.full((300, cfg.LARGURA_RET, 3), 15, np.uint8)
    x, y = np.rint(np.float32(cfg.para_retificada(col, row)) - anchor).astype(int)
    assert x >= 0 and y >= 0
    patch = canvas[y:y + image.shape[0], x:x + image.shape[1]]
    patch[mask > .5] = image[mask > .5]
    return canvas


def test_buzzer_template_localizes_translated_body_without_assuming_its_old_slot():
    for row, col in ((0, 0), (2, 4), (5, 9)):
        image = paste_template(buzzer_template(), row, col)
        assert buzzer_candidates(image) == [('buzzer', 'verde', row, col, col + 1)]


def test_capacitor_prints_localize_and_reverse_polarity_on_synthetic_translations():
    for mirrored in (False, True):
        image = paste_template(capacitor_template(), 2, 3, mirrored=mirrored)
        found = capacitor_candidates(image)
        assert len(found) == 1
        assert found[0]['piece'] == ('capacitor', 'azul', 2, 3, 4)
        assert found[0]['polarity']['status'] == 'known'
        assert found[0]['polarity']['positive'] == (3 if mirrored else 4)


def test_capacitor_requires_every_printed_mark_not_merely_a_blue_body():
    image, mask, support, anchor = capacitor_template()
    n, labels = cv.connectedComponents(mask.astype(np.uint8))
    assert n == 4
    for label in range(1, n):
        erased = image.copy()
        erased[labels == label] = (140, 80, 30)
        canvas = paste_template((erased, mask, support, anchor), 2, 3)
        assert not capacitor_candidates(canvas), label


def test_smart_housings_use_complete_cases_and_hold_out_second_capture():
    from visao.template_pecas import smart_candidates
    for folder in ('full-board-2026-11-13', 'full-board-fixed-2026-11-13'):
        frame = cv.imread(str(FIXTURES / folder / 'frame-00.jpg'))
        registration = four_sticker_proposal(frame)
        banks = [retifica(frame, b['H'])[:340] for b in registration['banks']]
        assert smart_candidates(banks[0]) == []
        assert smart_candidates(banks[1]) == [
            ('capsula_smart', 'preto', 5, 0, 2), ('capsula_smart', 'preto', 5, 4, 6)]


def test_smart_housing_template_moves_to_each_allowed_slot_without_display_pixels():
    from visao.template_pecas import smart_candidates, smart_templates
    for image, mask, support, anchor in smart_templates():
        for col in (0, 4, 8):
            canvas = np.full((340, cfg.LARGURA_RET, 3), 15, np.uint8)
            x, y = np.rint(np.float32(cfg.para_retificada(col, 5)) - anchor).astype(int)
            patch = canvas[y:y + image.shape[0], x:x + image.shape[1]]
            patch[mask > .5] = image[mask > .5]
            # Only the labelled plastic case is pasted. OLED content is absent.
            assert smart_candidates(canvas) == [('capsula_smart', 'preto', 5, col, col + 2)]
    assert smart_candidates(np.full((340, cfg.LARGURA_RET, 3), 15, np.uint8)) == []
