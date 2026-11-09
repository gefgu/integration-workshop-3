"""Locate blue two-socket bodies without guessing their electrical identity."""
import cv2 as cv
import numpy as np

from . import config as cfg


def suporte_local(vistos, linha, coluna_inicial, coluna_final):
    """Require nearby grid matches on multiple rows and columns."""
    y0, y1 = max(0, linha - 1), min(cfg.N_LINHAS_METADE, linha + 2)
    x0, x1 = max(0, coluna_inicial - 1), min(cfg.N_COLUNAS, coluna_final + 2)
    rows, cols = np.nonzero(vistos[y0:y1, x0:x1])
    if len(rows) >= 3 and len(np.unique(rows)) >= 2 and len(np.unique(cols)) >= 2:
        return True
    # A piece may cover most immediately adjacent sockets, especially at the
    # edge of the grid. Allow a wider neighborhood only with at least one
    # immediate match and enough matches spread over both dimensions.
    if not len(rows):
        return False
    y0, y1 = max(0, linha - 2), min(cfg.N_LINHAS_METADE, linha + 3)
    x0, x1 = max(0, coluna_inicial - 2), min(cfg.N_COLUNAS, coluna_final + 3)
    rows, cols = np.nonzero(vistos[y0:y1, x0:x1])
    return len(rows) >= 4 and len(np.unique(rows)) >= 2 and len(np.unique(cols)) >= 2


def corpos_azuis(ret_bgr):
    hsv = cv.cvtColor(ret_bgr, cv.COLOR_BGR2HSV)
    mask = cv.inRange(hsv, (85, 80, 150), (130, 255, 255))
    masks = [cv.morphologyEx(mask, cv.MORPH_CLOSE, np.ones((7, width), np.uint8))
             for width in (20, 35)]
    found = set()
    for x, y, width, height, area in (stat for image in masks
                                      for stat in cv.connectedComponentsWithStats(image)[2][1:]):
        # Current printed pieces bridge two sockets; clipping, glare or a
        # fragmented body is deliberately left unknown.
        if not (90 <= width <= 165 and 25 <= height <= 70 and area >= 1900):
            continue
        center_x = x + width / 2
        center_y = y + height - 3
        col = round(center_x / cfg.PX_X - cfg.MARGEM_X - .5)
        row = round(center_y / cfg.PX_Y - cfg.MARGEM_Y)
        if not (0 <= col < cfg.N_COLUNAS - 1 and 0 <= row < cfg.N_LINHAS_METADE):
            continue
        expected_x, expected_y = cfg.para_retificada(col + .5, row)
        if abs(center_x - expected_x) > 28 or abs(center_y - expected_y) > 14:
            continue
        found.add((row, col))
    return found


def abertura_vazia(ret_bgr, linha, coluna):
    """Check for a bright opening with dark borders on all four sides.

    Call only for a socket matched by registration. A match alone can also
    come from a component or background reflection.
    """
    x, y = (int(round(v)) for v in cfg.para_retificada(coluna, linha))
    if x < 25 or y < 17 or x + 25 > ret_bgr.shape[1] or y + 17 > ret_bgr.shape[0]:
        return False
    gray = cv.cvtColor(ret_bgr[y - 17:y + 17, x - 25:x + 25], cv.COLOR_BGR2GRAY)
    center = float(np.mean(gray[10:25, 17:34]))
    left = float(np.mean(gray[10:25, 0:7]))
    right = float(np.mean(gray[10:25, 43:50]))
    top = float(np.mean(gray[0:5, 17:34]))
    bottom = float(np.mean(gray[29:34, 17:34]))
    contrast = max(30, center * .4)
    return bool(center >= 80 and center - (left + right) / 2 > contrast
                and center - (top + bottom) / 2 > contrast)


def regiao_colorida(ret_bgr, linha, coluna):
    """A colored object near an opening makes an empty reading ambiguous."""
    x, y = (int(round(v)) for v in cfg.para_retificada(coluna, linha))
    if x < 12 or y < 36 or x + 13 > ret_bgr.shape[1]:
        return True
    hsv = cv.cvtColor(ret_bgr[y - 36:y - 10, x - 12:x + 13], cv.COLOR_BGR2HSV)
    colorful = (hsv[:, :, 1] > 80) & (hsv[:, :, 2] > 120)
    return bool(colorful.mean() > .08)


def ponte_clara(ret_bgr, linha, coluna):
    """A pale bridge may be an unidentified white piece, not empty holes."""
    x, y = (int(round(v)) for v in cfg.para_retificada(coluna + .5, linha))
    half_step = int(round(cfg.PX_X / 2))
    if x < half_step + 6 or y < 35 or x + half_step + 7 > ret_bgr.shape[1]:
        return False
    hsv = cv.cvtColor(ret_bgr[y - 35:y - 10, x - 6:x + 7], cv.COLOR_BGR2HSV)
    ends = [ret_bgr[y - 7:y + 8, x + offset - 6:x + offset + 7]
            for offset in (-half_step, half_step)]
    reference = np.percentile(np.concatenate([np.max(end, axis=2).ravel() for end in ends]), 70)
    cutoff = max(70, min(160, .7 * reference))
    pale = (hsv[:, :, 1] < 65) & (hsv[:, :, 2] > cutoff)
    return bool(pale.mean() > .30)
