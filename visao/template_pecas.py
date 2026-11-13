"""Masked kit appearance templates, independent of board inventory/placement.

The first template labels the current buzzer's PCB and cap, excluding the
neighbouring jumper/background. Resistor values never use these templates.
"""
from functools import lru_cache
from pathlib import Path

import cv2 as cv
import numpy as np

from . import config as cfg
from .calibracao_bancada import four_sticker_proposal
from .sockets import retifica


@lru_cache(maxsize=1)
def _reference_board():
    source = cv.imread(str(Path(__file__).parent / 'fixtures/current/full-board-2026-11-13/frame-00.jpg'))
    calibration = None if source is None else four_sticker_proposal(source)
    return source, calibration


@lru_cache(maxsize=1)
def buzzer_template():
    source, calibration = _reference_board()
    if calibration is None:
        return None
    mask = np.zeros(source.shape[:2], np.uint8)
    # Labelled component silhouette in the saved photograph, not an allowed
    # detection position. Matching runs over the entire rectified bank.
    cv.fillConvexPoly(mask, np.int32([[796, 87], [899, 84], [892, 126], [795, 143]]), 255)
    cv.ellipse(mask, (846, 100), (24, 18), 0, 0, 360, 255, -1)
    h = calibration['banks'][1]['H']
    rect = retifica(source, h)
    plane = retifica(cv.cvtColor(mask, cv.COLOR_GRAY2BGR), h)[:, :, 0] > 220
    x, y, width, height = cv.boundingRect(plane.astype(np.uint8))
    image = rect[y:y + height, x:x + width]
    plane = plane[y:y + height, x:x + width].astype(np.float32)
    hsv = cv.cvtColor(image, cv.COLOR_BGR2HSV)
    green = ((hsv[:, :, 0] >= 35) & (hsv[:, :, 0] <= 100) & (hsv[:, :, 1] >= 15)
             & (hsv[:, :, 2] >= 25)).astype(np.float32) * plane
    anchor = np.float32(cfg.para_retificada(9, 1)) - [x, y]
    return image, plane, green, anchor


@lru_cache(maxsize=1)
def capacitor_template():
    """Only the three printed white signs and their blue surrounds are labelled."""
    source, calibration = _reference_board()
    if calibration is None:
        return None
    mask = np.zeros(source.shape[:2], np.uint8)
    for x0, y0, x1, y1 in ((580, 540, 599, 555), (612, 535, 639, 556), (650, 534, 674, 556)):
        mask[y0:y1, x0:x1] = 255
    h = calibration['banks'][0]['H']
    rect = retifica(source, h)
    plane = retifica(cv.cvtColor(mask, cv.COLOR_GRAY2BGR), h)[:, :, 0] > 220
    x, y, width, height = cv.boundingRect(plane.astype(np.uint8))
    image = rect[y:y + height, x:x + width]
    plane = plane[y:y + height, x:x + width].astype(np.float32)
    hsv = cv.cvtColor(image, cv.COLOR_BGR2HSV)
    blue = ((hsv[:, :, 0] >= 85) & (hsv[:, :, 0] <= 135) & (hsv[:, :, 1] >= 65)
            & (hsv[:, :, 2] >= 25)).astype(np.float32) * plane
    anchor = np.float32(cfg.para_retificada(5, 4)) - [x, y]
    return image, plane, blue, anchor


@lru_cache(maxsize=1)
def smart_templates():
    """Plastic housing only: OLED contents never identify the module's mode."""
    source, calibration = _reference_board()
    if calibration is None:
        return []
    h = calibration['banks'][1]['H']
    rect = retifica(source, h)
    templates = []
    annotations = (
        (0, [[234, 240], [403, 237], [426, 337], [237, 354]], (266, 267, 377, 337)),
        (4, [[477, 235], [640, 232], [658, 333], [480, 351]], (529, 264, 639, 334)),
    )
    for first, polygon, screen in annotations:
        mask = np.zeros(source.shape[:2], np.uint8)
        cv.fillConvexPoly(mask, np.int32(polygon), 255)
        x0, y0, x1, y1 = screen
        mask[y0:y1, x0:x1] = 0
        plane = retifica(cv.cvtColor(mask, cv.COLOR_GRAY2BGR), h)[:, :, 0] > 220
        x, y, width, height = cv.boundingRect(plane.astype(np.uint8))
        image = rect[y:y + height, x:x + width]
        plane = plane[y:y + height, x:x + width].astype(np.float32)
        hsv = cv.cvtColor(image, cv.COLOR_BGR2HSV)
        neutral = ((hsv[:, :, 1] < 100) & (hsv[:, :, 2] >= 20) & (hsv[:, :, 2] < 180)).astype(np.float32) * plane
        anchor = np.float32(cfg.para_retificada(first, 5)) - [x, y]
        templates.append((image, plane, neutral, anchor))
    return templates


def masked_correlation(gray, template, mask):
    """Brightness-offset/scale invariant correlation with a foreground-only mask."""
    gray, template, mask = gray.astype(np.float32), template.astype(np.float32), mask.astype(np.float32)
    count = float(mask.sum())
    mean = float((template * mask).sum() / count)
    centered = (template - mean) * mask
    template_variance = float((centered * centered).sum())
    numerator = cv.matchTemplate(gray, centered, cv.TM_CCORR)
    total = cv.matchTemplate(gray, mask, cv.TM_CCORR)
    total_squared = cv.matchTemplate(gray * gray, mask, cv.TM_CCORR)
    variance = np.maximum(0., total_squared - total * total / count)
    denominator = np.sqrt(variance * template_variance)
    return np.where(variance / count >= 12, numerator / np.maximum(denominator, 1e-6), -1.)


def buzzer_candidates(rect):
    reference = buzzer_template()
    if reference is None:
        return []
    image, mask, green_mask, anchor = reference
    if image.shape[0] > rect.shape[0] or image.shape[1] > rect.shape[1]:
        return []
    gray = cv.cvtColor(rect, cv.COLOR_BGR2GRAY)
    hsv = cv.cvtColor(rect, cv.COLOR_BGR2HSV)
    green = ((hsv[:, :, 0] >= 35) & (hsv[:, :, 0] <= 100) & (hsv[:, :, 1] >= 15)
             & (hsv[:, :, 2] >= 25)).astype(np.float32)
    correlation = masked_correlation(gray, cv.cvtColor(image, cv.COLOR_BGR2GRAY), mask)
    colour = cv.matchTemplate(green, green_mask, cv.TM_CCORR) / max(1., float(green_mask.sum()))
    correlation[colour < .5] = -1
    found = {}
    for _ in range(66):
        _, score, _, (x, y) = cv.minMaxLoc(correlation)
        if score < .88:
            break
        px, py = np.float32([x, y]) + anchor
        col = round(float(px / cfg.PX_X - cfg.MARGEM_X))
        row = round(float(py / cfg.PX_Y - cfg.MARGEM_Y))
        if 0 <= row < 6 and 0 <= col < 10:
            ex, ey = cfg.para_retificada(col, row)
            if abs(px - ex) < cfg.PX_X * .3 and abs(py - ey) < cfg.PX_Y * .3:
                key = ('buzzer', 'verde', row, col, col + 1)
                found[key] = max(found.get(key, 0.), score)
        cv.rectangle(correlation, (max(0, x - image.shape[1] // 2), max(0, y - image.shape[0] // 2)),
                     (x + image.shape[1] // 2, y + image.shape[0] // 2), -1, -1)
    return sorted(found)


def capacitor_candidates(rect):
    """Positive printed-mark evidence, including reversed signs; no plain-blue default."""
    reference = capacitor_template()
    if reference is None:
        return []
    image, mask, blue_mask, anchor = reference
    gray = cv.cvtColor(rect, cv.COLOR_BGR2GRAY)
    hsv = cv.cvtColor(rect, cv.COLOR_BGR2HSV)
    blue = ((hsv[:, :, 0] >= 85) & (hsv[:, :, 0] <= 135) & (hsv[:, :, 1] >= 65)
            & (hsv[:, :, 2] >= 25)).astype(np.float32)
    found = {}
    _, glyph_labels = cv.connectedComponents(mask.astype(np.uint8))
    glyphs = [(glyph_labels == label) for label in range(1, int(glyph_labels.max()) + 1)]
    for mirrored in (False, True):
        template, stencil, support = (cv.flip(item, 1) if mirrored else item for item in (image, mask, blue_mask))
        offset = anchor.copy()
        if mirrored:
            offset[0] = image.shape[1] - 1 - (anchor[0] + cfg.PX_X)
        correlation = masked_correlation(gray, cv.cvtColor(template, cv.COLOR_BGR2GRAY), stencil)
        colour = cv.matchTemplate(blue, support, cv.TM_CCORR) / max(1., float(support.sum()))
        correlation[colour < .5] = -1
        for _ in range(66):
            _, score, _, (x, y) = cv.minMaxLoc(correlation)
            if score < .88:
                break
            patch = gray[y:y + image.shape[0], x:x + image.shape[1]].astype(np.float32)
            template_gray = cv.cvtColor(template, cv.COLOR_BGR2GRAY).astype(np.float32)
            all_marks = True
            for group in glyphs:
                region = cv.flip(group.astype(np.uint8), 1).astype(bool) if mirrored else group
                actual, wanted = patch[region], template_gray[region]
                actual = actual - actual.mean()
                wanted = wanted - wanted.mean()
                denominator = float(np.linalg.norm(actual) * np.linalg.norm(wanted))
                if float(np.std(actual)) < 3 or denominator < 1 or float(actual @ wanted) / denominator < .70:
                    all_marks = False
                    break
            px, py = np.float32([x, y]) + offset
            col = round(float(px / cfg.PX_X - cfg.MARGEM_X))
            row = round(float(py / cfg.PX_Y - cfg.MARGEM_Y))
            if all_marks and 0 <= row < 6 and 0 <= col < 10:
                ex, ey = cfg.para_retificada(col, row)
                if abs(px - ex) < cfg.PX_X * .3 and abs(py - ey) < cfg.PX_Y * .3:
                    found.setdefault((row, col), []).append((score, mirrored))
            cv.rectangle(correlation, (max(0, x - image.shape[1] // 2), max(0, y - image.shape[0] // 2)),
                         (x + image.shape[1] // 2, y + image.shape[0] // 2), -1, -1)
    out = []
    for (row, first), votes in sorted(found.items()):
        votes.sort(reverse=True)
        score, mirrored = votes[0]
        opposite = max((v for v, m in votes if m != mirrored), default=0.)
        polarity = dict(status='unknown', reason='printed_signs_ambiguous')
        if score - opposite >= .06:
            polarity = dict(status='known', positive=first if mirrored else first + 1,
                            negative=first + 1 if mirrored else first,
                            reason='printed_capacitor_mark_pattern')
        out.append(dict(piece=('capacitor', 'azul', row, first, first + 1), polarity=polarity, score=score))
    return out


def smart_candidates(rect):
    """Housing evidence in six slots; display pixels are masked out.

    On the Nov 13 recording housing correlation ranges from .75 upwards,
    versus at most .36 at the other four slots. Use .70 plus independent
    neutral-plastic support; no OLED colour or displayed mode is required.
    """
    gray = cv.cvtColor(rect, cv.COLOR_BGR2GRAY)
    hsv = cv.cvtColor(rect, cv.COLOR_BGR2HSV)
    neutral = ((hsv[:, :, 1] < 100) & (hsv[:, :, 2] >= 20)).astype(np.float32)
    found = set()
    for image, mask, support, anchor in smart_templates():
        height, width = image.shape[:2]
        for col in (0, 4, 8):
            ex, ey = cfg.para_retificada(col, 5)
            x, y = np.rint(np.float32([ex, ey]) - anchor).astype(int)
            dx, dy = round(cfg.PX_X * .3), round(cfg.PX_Y * .3)
            x0, y0 = max(0, x - dx), max(0, y - dy)
            x1, y1 = min(rect.shape[1], x + width + dx + 1), min(rect.shape[0], y + height + dy + 1)
            if x1 - x0 < width or y1 - y0 < height:
                continue
            correlation = masked_correlation(gray[y0:y1, x0:x1], cv.cvtColor(image, cv.COLOR_BGR2GRAY), mask)
            colour = cv.matchTemplate(neutral[y0:y1, x0:x1], support, cv.TM_CCORR) / max(1., float(support.sum()))
            # Dim housing pixels develop chroma noise: the darkest real
            # Nov 13 frames retain .479 neutral support, not .55. Shape
            # correlation remains an independent necessary condition.
            correlation[colour < .45] = -1
            if float(correlation.max()) >= .70:
                found.add(('capsula_smart', 'preto', 5, col, col + 2))
    return sorted(found)
