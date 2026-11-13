"""Synthetic geometry checks; these do not establish physical slot accuracy."""
import cv2 as cv
import numpy as np
from visao import config as cfg
from visao.pecas_bancada import white_jumpers, potentiometers


def canvas():
    return np.full((340, cfg.LARGURA_RET, 3), 8, np.uint8)


def jumper(image, row, first, last, shadow=False):
    left, cy = np.rint(cfg.para_retificada(first, row)).astype(int)
    right = round(cfg.para_retificada(last, row)[0])
    cv.rectangle(image, (left - 30, cy - 50), (right + 30, cy - 12), (210, 210, 210), -1)
    if shadow:
        cv.rectangle(image, (left - 30, cy - 25), (right + 30, cy - 12), (80, 80, 80), -1)


def test_raised_white_body_is_assigned_once_despite_crossing_preceding_row():
    for shadow in (False, True):
        image = canvas()
        jumper(image, 3, 8, 10, shadow)
        assert white_jumpers(image) == [('jumper_longo', 'branco', 3, 8, 10)]


def test_adjacent_white_bodies_do_not_merge_or_hide_each_other():
    image = canvas()
    jumper(image, 1, 1, 3)
    jumper(image, 2, 3, 5)
    assert white_jumpers(image) == [('jumper_longo', 'branco', 1, 1, 3),
                                   ('jumper_longo', 'branco', 2, 3, 5)]


def test_a_shadow_alone_never_seeds_a_white_body():
    image = canvas()
    cv.rectangle(image, (560, 140), (800, 190), (65, 65, 65), -1)
    assert white_jumpers(image) == []
    assert potentiometers(image) == []
