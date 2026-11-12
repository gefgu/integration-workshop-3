"""Locate blue two-socket bodies without guessing their electrical identity."""
import cv2 as cv
import numpy as np

from . import config as cfg


def resistores_azuis_kit(ret_bgr):
    """Blue resistor holders found at the normal brightness or, for dim frames, a relaxed one.

    The relaxed pass only adds holders: on the 2026-11-12 live frames at the bench's normal exposure a
    holder in the jumper's shadow reads V~118, under the strict cutoff of 135. Running the strict pass
    as well means a brighter frame can never lose a body to the relaxed pass (neighbouring blue regions
    can merge into one oversize blob at the relaxed cutoff).
    """
    return _resistores_azuis(ret_bgr, 135) | _resistores_azuis(ret_bgr, 100)


def _resistores_azuis(ret_bgr, valor_minimo):
    """Find a blue two-socket holder carrying the kit's exposed axial resistor.

    The 1 kΩ value is a kit configuration assumption, not an optical measurement.
    Plain coloured blue bodies must remain unidentified.
    """
    hsv = cv.cvtColor(ret_bgr, cv.COLOR_BGR2HSV)
    found = set()
    for row in range(cfg.N_LINHAS_METADE):
        socket_y = int(round(cfg.para_retificada(0, row)[1]))
        top, bottom = max(0, socket_y - 38), min(hsv.shape[0], socket_y + 12)
        region = hsv[top:bottom]
        # Keep the holder visible across small exposure changes; the axial
        # body and band checks below are still mandatory for identification.
        mask = cv.inRange(region, (91, 80, valor_minimo), (130, 255, 255))
        mask = cv.morphologyEx(mask, cv.MORPH_CLOSE, np.ones((7, 35), np.uint8))
        for x, y, width, height, area in cv.connectedComponentsWithStats(mask)[2][1:]:
            if not (90 <= width <= 165 and 25 <= height <= 52 and area >= 1800):
                continue
            center_x = x + width / 2
            col = round((center_x - 20) / cfg.PX_X - cfg.MARGEM_X - .5)
            if not 0 <= col < cfg.N_COLUNAS - 1:
                continue
            expected_x, _ = cfg.para_retificada(col + .5, row)
            if abs(center_x - 20 - expected_x) > 20:
                continue
            # The mounted axial part contains a dark body/lead in the middle.
            # A plain bright blue holder does not establish a resistor value.
            cx = int(round(expected_x))
            body = hsv[max(0, socket_y - 38):socket_y - 3, max(0, cx - 35):cx + 45]
            if not body.size or np.mean((body[:, :, 1] < 75) & (body[:, :, 2] > 70) & (body[:, :, 2] < 220)) < .15:
                continue
            # The exposed resistor can sit to either side of the holder's
            # midpoint. Check two narrow regions rather than only the center.
            regions = [hsv[max(0, socket_y - 38):socket_y - 3,
                           max(0, cx + offset - 10):cx + offset + 10]
                       for offset in (-15, 0, 15, 25, 30, 35)]
            if any(region.size and np.mean(region[:, :, 2] < 100) >= .10 for region in regions):
                found.add((row, col))
    return found


def pecas_kit(ret_bgr):
    """Candidate kit pieces; identities and polarity follow the test-kit convention.

    Returns (type, colour, row, first column, last column). Bright openings and
    fragments are rejected by requiring a substantial, horizontally aligned body.
    """
    hsv = cv.cvtColor(ret_bgr, cv.COLOR_BGR2HSV)
    # Estimate neutral contact brightness from socket locations. A white
    # jumper can be darker than an absolute HSV cutoff when exposure changes.
    contacts = []
    for row in range(cfg.N_LINHAS_METADE):
        for col in range(cfg.N_COLUNAS):
            sx, sy = (int(round(v)) for v in cfg.para_retificada(col, row))
            roi = hsv[sy - 5:sy + 6, sx - 5:sx + 6]
            neutral = roi[:, :, 2][roi[:, :, 1] < 60]
            if neutral.size >= 30:
                contacts.append(float(np.median(neutral)))
    reference = float(np.median(contacts)) if len(contacts) >= 20 else 0.0
    white_min = int(min(180, max(120, reference * .8))) if reference >= 150 else 180
    red = cv.inRange(hsv, (0, 80, 70), (8, 255, 255)) | cv.inRange(hsv, (165, 80, 70), (179, 255, 255))
    masks = [
        ('vermelho_2', 'vermelho', red),
        ('led', 'verde', cv.inRange(hsv, (55, 55, 80), (90, 255, 255))),
        ('jumper', 'branco', cv.inRange(hsv, (0, 0, white_min), (179, 55, 255))),
    ]
    found = []
    for kind, colour, mask in masks:
        mask = cv.morphologyEx(mask, cv.MORPH_CLOSE, np.ones((5, 11), np.uint8))
        _, labels, stats, _ = cv.connectedComponentsWithStats(mask)
        for label, (x, y, width, height, area) in enumerate(stats[1:], 1):
            # Reflections on a neighboring piece can connect to the body and
            # extend its bounding box into the next row. Keep the horizontal
            # core instead of treating that sparse tail as part of the piece.
            if (kind in ('jumper', 'led') and 85 <= width <= 370 and area >= 1500
                    and (kind != 'jumper' or height > 75)):
                component = labels[y:y + height, x:x + width] == label
                minimum = width * (.60 if kind == 'jumper' else .20)
                dense = np.flatnonzero(np.count_nonzero(component, axis=1) >= minimum)
                if dense.size:
                    height = int(dense[-1] - dense[0] + 1)
                    y += int(dense[0])
            if not (1500 <= area and 20 <= height <= 75 and 85 <= width <= (370 if kind == 'jumper' else 290)):
                continue
            if kind != 'jumper' and width > 165:
                continue
            # The colored holders project to the right of their socket centers;
            # the long white jumpers are centered on their terminals.
            span = 1 if width < 170 else round((width - 60) / cfg.PX_X)
            # Short pale bodies can be resistors. Four-gap recognition is
            # supported by a synthetic shape test, but needs a live check.
            if kind == 'jumper' and span not in (3, 4):
                continue
            if kind != 'jumper' and span != 1 or not 1 <= span <= 4:
                continue
            offset = 0 if kind == 'jumper' else 20
            first = round((x + width / 2 - offset) / cfg.PX_X - cfg.MARGEM_X - span / 2)
            row = round((y + height - 3) / cfg.PX_Y - cfg.MARGEM_Y)
            if not (0 <= row < cfg.N_LINHAS_METADE and 0 <= first < first + span < cfg.N_COLUNAS):
                continue
            expected_x, expected_y = cfg.para_retificada(first + span / 2, row)
            if abs(x + width / 2 - offset - expected_x) > 24 or abs(y + height - 3 - expected_y) > 18:
                continue
            piece_type = kind if kind != 'jumper' else {3: 'jumper_3', 4: 'jumper_4'}[span]
            found.append((piece_type, colour, row, first, first + span))
    return found


def buzzer_kit(ret_bgr):
    """Find the photographed green board with its round, dark buzzer body."""
    hsv = cv.cvtColor(ret_bgr, cv.COLOR_BGR2HSV)
    gray = cv.cvtColor(ret_bgr, cv.COLOR_BGR2GRAY)
    circles = cv.HoughCircles(cv.GaussianBlur(gray, (5, 5), 0), cv.HOUGH_GRADIENT,
                              dp=1, minDist=35, param1=70, param2=20, minRadius=17, maxRadius=29)
    found = []
    if circles is None:
        return found
    for xf, yf, radius in circles[0]:
        x, y = int(round(xf)), int(round(yf))
        if x < 60 or x + 60 >= hsv.shape[1] or y < 20 or y + 20 >= hsv.shape[0]:
            continue
        disk = hsv[y - 12:y + 12, x - 12:x + 12]
        sides = (hsv[y - 15:y + 15, x - 54:x - 28], hsv[y - 15:y + 15, x + 28:x + 54])
        green = lambda a: np.mean((a[:, :, 0] >= 35) & (a[:, :, 0] <= 100) & (a[:, :, 1] >= 20))
        if (np.mean(disk[:, :, 2] < 110) < .8
                or any(green(a) < .55 or np.median(a[:, :, 2]) < 75 for a in sides)):
            continue
        col = round((x - 20) / cfg.PX_X - cfg.MARGEM_X - .5)
        row = round((y + 27) / cfg.PX_Y - cfg.MARGEM_Y)
        if not (0 <= row < cfg.N_LINHAS_METADE and 0 <= col < cfg.N_COLUNAS - 1):
            continue
        ex, ey = cfg.para_retificada(col + .5, row)
        if abs(x - 20 - ex) <= 20 and abs(y + 27 - ey) <= 15:
            found.append(('buzzer', 'verde', row, col, col + 1))
    return found


def _fracao(mascara, x0, x1, y0, y1):
    x0, y0 = max(0, int(x0)), max(0, int(y0))
    x1, y1 = min(mascara.shape[1], int(x1)), min(mascara.shape[0], int(y1))
    return float(mascara[y0:y1, x0:x1].mean()) if x1 > x0 and y1 > y0 else 0.0


# Scores of the black housing template: the saved normal-exposure pictures with the module
# score 0.80-0.87 at its position and every picture without it 0.27 or less.
MIN_CORPO_SMART = .60
MAX_PLACA_AO_REDOR = .60


def smart_kit(ret_bgr):
    """Find the black three-position smart housing, without assuming its mode.

    The housing is a flat grey-black block about three sockets wide and three rows tall. It is
    matched as a template at each grid position: its top band and both lower corners must be
    uniformly grey while the socket columns beside it are not. The blue OLED strip on its lower
    edge is deliberately not used, because its width and brightness change with exposure and
    its glass reflects blue above it.
    """
    hsv = cv.cvtColor(ret_bgr, cv.COLOR_BGR2HSV)
    grey = cv.inRange(hsv, (0, 0, 55), (179, 75, 125)) > 0
    scored = []
    for row in range(2, cfg.N_LINHAS_METADE):
        for first in range(0, cfg.N_COLUNAS - 2):
            cx, yc = cfg.para_retificada(first + 1, row)
            top = _fracao(grey, cx - 80, cx + 80, yc - 80, yc - 55)
            corners = min(_fracao(grey, cx - 85, cx - 45, yc - 50, yc - 10),
                          _fracao(grey, cx + 45, cx + 85, yc - 50, yc - 10))
            around = max(_fracao(grey, cx - 125, cx - 108, yc - 80, yc),
                         _fracao(grey, cx + 108, cx + 125, yc - 80, yc))
            score = min(top, corners)
            if score >= MIN_CORPO_SMART and around <= MAX_PLACA_AO_REDOR:
                scored.append((score, row, first))
    found = []
    for score, row, first in sorted(scored, key=lambda item: (-item[0], item[1], item[2])):
        if not any(abs(row - r) <= 2 and abs(first - f) <= 2 for _, r, f in found):
            found.append((score, row, first))
    return sorted(('capsula_smart', 'preto', row, first, first + 2) for _, row, first in found)


def led_vermelho_kit(ret_bgr):
    """Detect the pictured red LED lens on its pale green two-position holder."""
    hsv = cv.cvtColor(ret_bgr, cv.COLOR_BGR2HSV)
    red = cv.inRange(hsv, (0, 80, 60), (12, 255, 255)) | cv.inRange(hsv, (165, 80, 60), (179, 255, 255))
    found = []
    for x, y, width, height, area in cv.connectedComponentsWithStats(red)[2][1:]:
        if not (9 <= width <= 24 and 8 <= height <= 23 and 65 <= area <= 350):
            continue
        cx, cy = x + width / 2, y + height / 2
        col = round((cx - 20) / cfg.PX_X - cfg.MARGEM_X - .5)
        row = round((cy + 27) / cfg.PX_Y - cfg.MARGEM_Y)
        if not (0 <= row < cfg.N_LINHAS_METADE and 0 <= col < cfg.N_COLUNAS - 1):
            continue
        ex, ey = cfg.para_retificada(col + .5, row)
        if abs(cx - 20 - ex) > 22 or abs(cy + 27 - ey) > 16:
            continue
        px, py = int(cx), int(cy)
        if px < 55 or px + 55 >= hsv.shape[1] or py < 14 or py + 15 >= hsv.shape[0]:
            continue
        sides = [hsv[py - 12:py + 12, px - 52:px - 25], hsv[py - 12:py + 12, px + 25:px + 52]]
        pale_green = lambda a: np.mean((a[:, :, 0] >= 35) & (a[:, :, 0] <= 95) & (a[:, :, 2] >= 120))
        if all(pale_green(side) >= .50 for side in sides):
            found.append(('led', 'verde', row, col, col + 1))
    return found


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


def suporte_smart(vistos, linha, coluna_inicial, coluna_final):
    """A wide OLED housing can cover most of its immediately adjacent sockets."""
    if suporte_local(vistos, linha, coluna_inicial, coluna_final):
        return True
    y0, y1 = max(0, linha - 2), min(cfg.N_LINHAS_METADE, linha + 3)
    x0, x1 = max(0, coluna_inicial - 2), min(cfg.N_COLUNAS, coluna_final + 3)
    rows, cols = np.nonzero(vistos[y0:y1, x0:x1])
    near = vistos[max(0, linha - 1):min(cfg.N_LINHAS_METADE, linha + 2),
                  max(0, coluna_inicial - 1):min(cfg.N_COLUNAS, coluna_final + 2)]
    return bool(near.any() and len(rows) >= 3 and len(np.unique(rows)) >= 2 and len(np.unique(cols)) >= 2)


def suporte_marcado(vistos, linha, coluna_inicial, coluna_final):
    """Distributed nearby socket evidence when an anchored piece hides adjacent openings."""
    y0, y1 = max(0, linha - 2), min(cfg.N_LINHAS_METADE, linha + 3)
    x0, x1 = max(0, coluna_inicial - 3), min(cfg.N_COLUNAS, coluna_final + 4)
    rows, cols = np.nonzero(vistos[y0:y1, x0:x1])
    if len(rows) < 4 or len(np.unique(rows)) < 2 or len(np.unique(cols)) < 2:
        return False
    abs_cols = cols + x0
    abs_rows = rows + y0
    near = ((abs_rows >= linha - 1) & (abs_rows <= linha + 1)
            & (abs_cols >= coluna_inicial - 2) & (abs_cols <= coluna_final + 2))
    return bool(near.any())


def corpos_azuis(ret_bgr):
    """Blue bodies at the normal brightness (V>=150) or a relaxed one (V>=110) for dim frames; see
    resistores_azuis_kit for why both passes are kept."""
    return _corpos_azuis(ret_bgr, 150) | _corpos_azuis(ret_bgr, 110)


def _corpos_azuis(ret_bgr, valor_minimo):
    hsv = cv.cvtColor(ret_bgr, cv.COLOR_BGR2HSV)
    mask = cv.inRange(hsv, (85, 80, valor_minimo), (130, 255, 255))
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
