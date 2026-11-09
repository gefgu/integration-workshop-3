"""Recognition of the currently available white, three-mark resistor.

The marks identify the physical piece; resistance is an inventory setting,
not a value inferred from the colors in an image.
"""
import cv2 as cv
import numpy as np

from . import config as cfg


def resistor_branco(ret_bgr, metade, linha, coluna):
    """Return whether a two-socket footprint has the observed three marks.

    Requires a registered, rectified image and a left-hand socket. This is a
    per-frame observation; callers must separately verify footprint coverage
    and temporal stability before publishing a component.
    """
    if metade != 0 or not (0 <= linha < cfg.N_LINHAS_METADE and 0 <= coluna < cfg.N_COLUNAS - 1):
        return False
    x, y = cfg.coord_modelo(metade, linha, coluna + .5)
    cx, cy = (int(round(v)) for v in cfg.para_retificada(x, y))
    if cy < 36 or cx < 28 or cy - 10 >= ret_bgr.shape[0] or cx + 29 > ret_bgr.shape[1]:
        return False
    patch = ret_bgr[cy - 36:cy - 10, cx - 28:cx + 29]
    hsv = cv.cvtColor(patch, cv.COLOR_BGR2HSV)
    h, s, v = np.median(hsv, axis=0).T
    # White plastic dominates the bridge; blue parts and bare dark dividers
    # should not become resistors just because they contain vertical edges.
    white = float(np.percentile(v, 80))
    if white < 140 or (v > white - 20).mean() < .65 or np.median(s) > 45:
        return False
    # The marks alone describe only the bridge. Require visible white body
    # at each end too, so a hand over one terminal cannot create a component.
    for offset in (-34, 34):
        left, right = cx + offset - 8, cx + offset + 9
        if left < 0 or right > ret_bgr.shape[1]:
            return False
        end = cv.cvtColor(ret_bgr[cy - 36:cy - 10, left:right], cv.COLOR_BGR2HSV)
        visible_white = (end[:, :, 1] < 60) & (end[:, :, 2] > white - 45)
        if visible_white.mean() < .70:
            return False
    marks = ((v < white - 25) | ((h < 25) & (s > 20))).astype(np.uint8)[None, :]
    _, _, stats, _ = cv.connectedComponentsWithStats(marks)
    runs = [(int(row[cv.CC_STAT_LEFT]), int(row[cv.CC_STAT_WIDTH])) for row in stats[1:]
            if 2 <= row[cv.CC_STAT_WIDTH] <= 12]
    if len(runs) != 3:
        return False
    centers = [left + width / 2 for left, width in runs]
    gaps = np.diff(centers)
    return bool(9 <= gaps[0] <= 24 and 9 <= gaps[1] <= 24 and max(gaps) / min(gaps) < 1.8)
