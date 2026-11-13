"""Candidate geometry for the populated board, in fixed socket pixels."""
import cv2 as cv
import numpy as np

from . import config as cfg
from .pecas_atuais import corpos_azuis, resistores_azuis_kit, _fracao


def white_jumpers(rect, white_level=220):
    """Read each socket row independently so touching reflections cannot join rows."""
    hsv = cv.cvtColor(rect, cv.COLOR_BGR2HSV)
    cutoff = max(60, min(120, white_level * .4))
    white = ((hsv[:, :, 1] < 60) & (hsv[:, :, 2] >= cutoff)).astype(np.uint8)
    # The shaded lower face can be less than half as bright as the top.
    # It extends an already positively detected bright body; it never seeds
    # a candidate by itself (foreground hysteresis).
    shaded = ((hsv[:, :, 1] < 60) & (hsv[:, :, 2] >= cutoff * .6)).astype(np.uint8)
    left = round((cfg.MARGEM_X - .7) * cfg.PX_X)
    right = round((10 + cfg.MARGEM_X + .7) * cfg.PX_X)
    white[:, :max(0, left)] = 0
    white[:, right:] = 0
    found = []
    for row in range(6):
        cy = round(cfg.para_retificada(0, row)[1])
        profiles = [cv.blur(white[cy + top:cy + bottom].mean(axis=0).astype(np.float32)[None], (3, 1))[0]
                    for top, bottom in ((-45, -20), (-35, -10), (-25, 0))]
        # Keep strips independent: taking their pixelwise union joins a
        # jumper to the tail of the jumper in the preceding socket row.
        proposals = []
        for coverage, (top, bottom) in zip(profiles, ((-45, -20), (-35, -10), (-25, 0))):
            present = (coverage >= .45).astype(np.uint8)[None]
            present = cv.morphologyEx(present, cv.MORPH_CLOSE, np.ones((1, 5), np.uint8))[0].astype(bool)
            edges = np.flatnonzero(np.diff(np.r_[False, present, False].astype(int)))
            for start, end in zip(edges[::2], edges[1::2]):
                width = end - start
                if not 90 <= width <= 370 or float(coverage[start:end].mean()) < .65:
                    continue
                # Follow the dense horizontal body vertically. Bright contact
                # tails can connect neighbouring pieces, so a global blob's
                # bottom is insufficient; require most of this span's width.
                y0, y1 = max(0, cy - 65), min(white.shape[0], cy + 45)
                dense = (shaded[y0:y1, start:end].mean(axis=1) >= .65).astype(np.uint8)
                dense = cv.morphologyEx(dense[:, None], cv.MORPH_CLOSE, np.ones((3, 1), np.uint8))[:, 0]
                borders = np.flatnonzero(np.diff(np.r_[False, dense > 0, False].astype(int)))
                segments = [(max(0, min(y0 + b, cy + bottom) - max(y0 + a, cy + top)), y0 + b - 1)
                            for a, b in zip(borders[::2], borders[1::2]) if b - a >= 8]
                if not segments:
                    continue
                overlap, lower_edge = max(segments)
                if overlap == 0 or round(lower_edge / cfg.PX_Y - cfg.MARGEM_Y) != row:
                    continue
                span = round((width - 60) / cfg.PX_X)
                if span not in (1, 2, 3, 4):
                    continue
                center = (start + end) / 2
                first = round(center / cfg.PX_X - cfg.MARGEM_X - span / 2)
                if 0 <= first < first + span <= 10:
                    expected, _ = cfg.para_retificada(first + span / 2, row)
                    if abs(center - expected) <= cfg.PX_X * .3:
                        proposals.append((width, first, span))
        selected = []
        for width, first, span in sorted(set(proposals), reverse=True):
            if any(max(first, other) <= min(first + span, other + length) for other, length in selected):
                continue
            selected.append((first, span))
        for first, span in sorted(selected):
            kind = {1: 'jumper_curto', 2: 'jumper_longo', 3: 'jumper_3', 4: 'jumper_4'}[span]
            found.append((kind, 'branco', row, first, first + span))
    return found


def blue_bodies(rect, details=False, blocked=()):
    """Assign each visible holder blob once, including holders on edge columns."""
    candidates = corpos_azuis(rect, relative=True) | resistores_azuis_kit(rect)
    hsv = cv.cvtColor(rect, cv.COLOR_BGR2HSV)
    mask = cv.inRange(hsv, (85, 65, 35), (135, 255, 255))
    mask = cv.morphologyEx(mask, cv.MORPH_CLOSE, np.ones((3, 35), np.uint8))
    _, labels, stats, centers = cv.connectedComponentsWithStats(mask)
    by_blob = {}
    fallback = {}
    for row, col in sorted(candidates):
        if (row, col) in blocked:
            continue
        cx, cy = map(round, cfg.para_retificada(col + .5, row))
        window = labels[max(0, cy - 50):cy + 10, max(0, cx - 75):cx + 75]
        tags, counts = np.unique(window[window > 0], return_counts=True)
        if not len(tags):
            continue
        tag = int(tags[np.argmax(counts)])
        if stats[tag, cv.CC_STAT_WIDTH] > 190:
            # Paired local holder ends remain evidence even if a dark blue
            # reflection joins them to a large background component.
            fallback[(row, col)] = (-44, 4)
            continue
        score = abs(float(centers[tag, 1]) - (cy - 22))
        previous = by_blob.get(tag)
        if previous is None or (score, row, col) < previous:
            by_blob[tag] = (score, row, col)
    found = {}
    for tag, (_, row, col) in by_blob.items():
        cy = cfg.para_retificada(0, row)[1]
        # Sample the actual holder's centre, rather than a canonical row
        # offset. Raised pieces in the upper bank project further upward.
        center_y = float(centers[tag, 1])
        found[(row, col)] = (round(center_y - cy - 24), round(center_y - cy + 24))
    found.update(fallback)
    return found if details else set(found)


def potentiometers(rect):
    hsv = cv.cvtColor(rect, cv.COLOR_BGR2HSV)
    mask = cv.inRange(hsv, (15, 35, 75), (40, 255, 255))
    mask = cv.morphologyEx(mask, cv.MORPH_CLOSE, np.ones((5, 13), np.uint8))
    found = []
    _, labels, stats, _ = cv.connectedComponentsWithStats(mask)
    for label, (x, y, width, height, area) in enumerate(stats[1:], 1):
        if width >= 160:
            body = labels[y:y + height, x:x + width] == label
            dense = np.flatnonzero(np.count_nonzero(body, axis=1) >= width * .35)
            if dense.size:
                core = body[dense[0]:dense[-1] + 1]
                columns = np.flatnonzero(np.count_nonzero(core, axis=0) >= core.shape[0] * .35)
                y += int(dense[0])
                height = int(dense[-1] - dense[0] + 1)
                if columns.size:
                    x += int(columns[0])
                    width = int(columns[-1] - columns[0] + 1)
        if not (160 <= width <= 250 and 25 <= height <= 80 and area >= 3000):
            continue
        first = round((x + width / 2) / cfg.PX_X - cfg.MARGEM_X - 1)
        row = round((y + height - 3) / cfg.PX_Y - cfg.MARGEM_Y)
        if 0 <= first <= 8 and 0 <= row < 6:
            ex, ey = cfg.para_retificada(first + 1, row)
            if abs(x + width / 2 - ex) < cfg.PX_X * .45 and abs(y + height - 3 - ey) < 16:
                found.append(('potenciometro', 'amarelo', row, first, first + 2))
    return found


def smart_housings(rect):
    """Positive case, screen aperture and OLED evidence in the six permitted slots."""
    hsv = cv.cvtColor(rect, cv.COLOR_BGR2HSV)
    gray = cv.cvtColor(rect, cv.COLOR_BGR2GRAY)
    neutral = (hsv[:, :, 1] < 100) & (gray >= 20) & (gray < 145)
    blue = (hsv[:, :, 0] >= 90) & (hsv[:, :, 0] <= 145) & (hsv[:, :, 1] >= 40) & (hsv[:, :, 2] >= 30)
    dark = gray < 45
    found = []
    for first in (0, 4, 8):
        row = 5
        cx, cy = cfg.para_retificada(first + 1, row)
        case = min(_fracao(neutral, cx - 85, cx + 85, cy - 95, cy - 70),
                   _fracao(neutral, cx - 85, cx - 55, cy - 60, cy - 10),
                   _fracao(neutral, cx + 55, cx + 85, cy - 60, cy - 10))
        screen = max(_fracao(dark, cx + dx - 42, cx + dx + 42, cy + dy - 58, cy + dy - 37)
                     for dx in (-24, -12, 0, 12, 24) for dy in (-8, 0, 8))
        oled = _fracao(blue, cx - 65, cx + 65, cy - 35, cy - 5)
        if case >= .40 and screen >= .45 and oled >= .10:
            found.append(('capsula_smart', 'preto', row, first, first + 2))
    return found



def buzzers(rect):
    """Match only the labelled PCB/cap foreground, without background circle guesses."""
    from .template_pecas import buzzer_candidates
    return buzzer_candidates(rect)
