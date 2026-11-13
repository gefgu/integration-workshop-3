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


def test_rearranged_left_edge_red_led_uses_positive_pcb_evidence():
    from pathlib import Path
    from visao.calibracao_bancada import four_sticker_proposal
    from visao.sockets import retifica
    from visao.pecas_atuais import led_vermelho_kit
    base = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
    path = base / 'full-board-rearranged-2026-11-13/frame-00.jpg'
    frame = cv.imread(str(path))
    calibration = four_sticker_proposal(frame)
    assert calibration is not None
    banks = [retifica(frame, bank['H'])[:340] for bank in calibration['banks']]
    assert led_vermelho_kit(banks[1], board=True) == [('led', 'verde', 5, 0, 1)]
    # Red battery and resistor bands in the other bank are not LED lenses.
    assert led_vermelho_kit(banks[0], board=True) == []
    changed = banks[1].copy()
    changed[220:270, 20:145] = (10, 10, 10)
    assert led_vermelho_kit(changed, board=True) == []


def test_smart_housing_structure_finds_the_moved_module_and_rejects_flat_board():
    from pathlib import Path
    from visao.calibracao_bancada import four_sticker_proposal
    from visao.sockets import retifica
    from visao.pecas_bancada import smart_housings
    base = Path(__file__).resolve().parents[1] / 'visao/fixtures/current'
    frame = cv.imread(str(base / 'full-board-rearranged-2026-11-13/frame-00.jpg'))
    calibration = four_sticker_proposal(frame)
    banks = [retifica(frame, bank['H'])[:340] for bank in calibration['banks']]
    assert smart_housings(banks[0]) == [('capsula_smart', 'preto', 5, 4, 6)]
    assert smart_housings(banks[1]) == []
    # Changing active display pixels does not assign or read a mode.
    changed = banks[0].copy()
    changed[255:273, 397:448] = (255, 255, 255)
    assert smart_housings(changed) == [('capsula_smart', 'preto', 5, 4, 6)]
    for level in (15, 35, 75):
        assert smart_housings(np.full_like(banks[0], level)) == []


def test_smart_housing_keeps_its_type_in_the_recorded_dark_lighting_state():
    from pathlib import Path
    from visao.calibracao_bancada import four_sticker_proposal
    from visao.sockets import retifica
    from visao.pecas_bancada import smart_housings
    base = Path(__file__).resolve().parents[1] / 'visao/fixtures/current/full-board-rearranged-2026-11-13'
    frame = cv.imread(str(base / 'frame-01.jpg'))
    calibration = four_sticker_proposal(frame)
    banks = [retifica(frame, bank['H'])[:340] for bank in calibration['banks']]
    assert smart_housings(banks[0]) == [('capsula_smart', 'preto', 5, 4, 6)]
    assert smart_housings(banks[1]) == []


def test_plain_blue_body_is_preserved_without_becoming_a_capacitor_or_resistor_value():
    from visao.pecas_bancada import blue_bodies
    from visao.template_pecas import capacitor_candidates
    from visao.bandas_resistor import le_valor
    from visao.sockets import _T
    image = canvas()
    cx, cy = np.rint(cfg.para_retificada(4.5, 2)).astype(int)
    cv.rectangle(image, (cx - 65, cy - 40), (cx + 65, cy), (140, 80, 30), -1)
    assert (2, 4) in blue_bodies(image)
    assert capacitor_candidates(image) == []
    assert le_valor(image, _T, 2, 4, relative=True)['valor'] is None


def test_empty_socket_lattice_is_not_a_smart_housing():
    from visao.calibracao_bancada import reference_image, REFERENCE_BANKS
    from visao.sockets import retifica
    from visao.pecas_bancada import smart_housings, blue_bodies
    # Known reference geometry isolates the detector from this older photo's
    # partly clipped outer sticker; automatic calibration is not bypassed in service.
    for homography in REFERENCE_BANKS:
        rect = retifica(reference_image(), homography)[:340]
        assert smart_housings(rect) == []
        assert blue_bodies(rect) == set()
