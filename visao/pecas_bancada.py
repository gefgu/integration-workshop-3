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
    # A plain blue capacitor need not expose the grey ceramic gap expected
    # by legacy resistor candidates. Preserve its body even when the white
    # prints cannot be read. Geometry alone never supplies an electrical type.
    for tag, (_, _, width, height, area) in enumerate(stats[1:], 1):
        if 90 <= width <= 190 and 18 <= height <= 70 and area >= 1000:
            x, y = centers[tag]
            col = round(x / cfg.PX_X - cfg.MARGEM_X - .5)
            row = round((y + 22) / cfg.PX_Y - cfg.MARGEM_Y)
            if 0 <= col < cfg.N_COLUNAS - 1 and 0 <= row < cfg.N_LINHAS_METADE:
                candidates.add((row, col))
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
            # reflection joins them to a large background component. Locate
            # their dense bright face locally; a fixed y-window cut off the
            # rearranged upper 1k's bands whenever that reflection appeared.
            y0, y1 = max(0, cy - 80), min(rect.shape[0], cy + 12)
            x0, x1 = max(0, cx - 75), min(rect.shape[1], cx + 75)
            local = hsv[y0:y1, x0:x1]
            blue = cv.inRange(local, (85, 65, 35), (135, 255, 255)) > 0
            values = local[:, :, 2][blue]
            bounds = (-44, 4)
            if values.size:
                floor = max(40., float(np.percentile(values, 95)) * .45)
                profile = np.mean(blue & (local[:, :, 2] >= floor), axis=1)
                edges = np.flatnonzero(np.diff(np.r_[False, profile >= .20, False].astype(int)))
                faces = [(float(profile[a:b].sum()), int(a), int(b))
                         for a, b in zip(edges[::2], edges[1::2]) if 10 <= b - a <= 60]
                if faces:
                    _, a, b = max(faces)
                    center_y = y0 + (a + b - 1) / 2
                    bounds = (round(center_y - cy - 24), round(center_y - cy + 24))
            fallback[(row, col)] = bounds
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
    """Positive three-sided housing and dark aperture, independent of OLED text.

    The foreground can shift vertically relative to the grid because it is
    raised. Only the six user-defined electrical slots are considered, but
    every slot still requires a visible housing and aperture.
    """
    gray = cv.cvtColor(rect, cv.COLOR_BGR2GRAY)
    lab = cv.cvtColor(rect, cv.COLOR_BGR2LAB).astype(np.float32)
    # A shaded grey housing reaches HSV S=123 at V=26 in the rearranged
    # recording. HSV saturation exaggerates that small absolute colour
    # difference; perceptual Lab chroma keeps it neutral. The independent
    # three-rail geometry, aperture and contrast checks remain mandatory.
    neutral = (np.hypot(lab[:, :, 1] - 128, lab[:, :, 2] - 128) <= 18) & (gray >= 12) & (gray <= 180)
    dark = (gray < 45).astype(np.uint8)
    closed = cv.morphologyEx(dark, cv.MORPH_CLOSE, np.ones((1, 3), np.uint8))
    run_width = round(cfg.PX_X)
    long_aperture = cv.erode(closed, np.ones((1, run_width), np.uint8), borderType=cv.BORDER_CONSTANT, borderValue=0)
    planes = [cv.integral(plane.astype(np.uint8)) for plane in (neutral, dark, gray)]

    def fraction(plane, x0, x1, y0, y1):
        x0, x1 = max(0, int(x0)), min(rect.shape[1], int(x1))
        y0, y1 = max(0, int(y0)), min(rect.shape[0], int(y1))
        if x1 <= x0 or y1 <= y0:
            return 0.
        integral = planes[plane]
        return float(integral[y1, x1] - integral[y0, x1] - integral[y1, x0] + integral[y0, x0]) / ((x1 - x0) * (y1 - y0))

    def continuous_aperture(panel):
        x0, x1, y0, y1 = map(int, panel)
        half = run_width // 2
        patch = long_aperture[max(0, y0):min(rect.shape[0], y1),
                              max(0, x0 + half):min(rect.shape[1], x1 - half)]
        # Empty socket holes can have a high dark fraction too, but their
        # intervening grid pillars break horizontal runs. A real OLED
        # aperture remains continuous across more than one socket pitch.
        return bool(patch.size and np.mean(np.any(patch > 0, axis=1)) >= .35)

    found = []
    for first in (0, 4, 8):
        cx, cy = cfg.para_retificada(first + 1, 5)
        accepted = False
        for dx in range(-20, 21, 10):
            for dy in range(-24, 25, 6):
                x, y = cx + dx, cy + dy
                rails = ((x - 80, x + 80, y - 80, y - 55),
                         (x - 85, x - 55, y - 50, y - 10),
                         (x + 55, x + 85, y - 50, y - 10))
                if min(fraction(0, *r) for r in rails) < .65:
                    continue
                # The black aperture border survives changes to the active
                # display contents; there is no blue/text/mode requirement.
                panels = ((x - 40, x + 40, y - 40, y - 12),
                          (x - 40, x + 40, y - 40, y - 30))
                rail_level = min(fraction(2, *r) for r in rails)
                if any(fraction(1, *panel) >= .65 and rail_level - fraction(2, *panel) >= 12
                       and continuous_aperture(panel)
                       for panel in panels):
                    accepted = True
                    break
            if accepted:
                break
        if accepted:
            found.append(('capsula_smart', 'preto', 5, first, first + 2))
    return found


def buzzers(rect):
    """Match only the labelled PCB/cap foreground, without background circle guesses."""
    from .template_pecas import buzzer_candidates
    return buzzer_candidates(rect)
