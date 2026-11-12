"""Read only the kit's three complete resistor patterns from camera frames.

Only three values exist in the kit: 220 Ω (red red brown), 470 Ω (yellow violet
brown) and 1 kΩ (brown black red). The decoder still refuses to answer unless every
band of the body is accounted for, so a washed-out, clipped, misaligned or unfamiliar
body stays unknown instead of receiving a guessed value:

* three warm (red/brown) bands, nothing else          -> 220 Ω
* one warm, one violet, one yellow band (violet between) -> 470 Ω
* two warm bands and a dark band between them          -> 1 kΩ

The direction of reading does not matter with this set. Reading either way, no other
three-band pattern of these colours is a member of the set.

Exposure must preserve the bands. Clipped highlights are refused before any
strip is decoded; enlargement rectifies geometry without inventing detail.
"""
import cv2 as cv
import numpy as np

from . import config as cfg
from .sockets import _T

ESCALA = 3
VALORES = {220: 'resistor_220', 470: 'resistor_470', 1000: 'resistor_1k'}
# Rectified-pixel window around the body, relative to the pair-of-sockets centre.
_JANELA = (-85, 95, -44, 4)
_LINHAS_FAIXA = (40, 90)       # rows of the 3x crop that cross the bands
MIN_LARGURA = 9                # 3x pixels
MAX_SATURADO = .02             # share of clipped pixels that makes the exposure unusable


def recorte_corpo(frame, H, linha, coluna):
    """3x rectified crop of the resistor body at (row, column), or None outside the frame."""
    M = np.diag([ESCALA, ESCALA, 1.0]) @ _T @ np.linalg.inv(H)
    cx, cy = cfg.para_retificada(coluna + .5, linha)
    x0, x1 = int((cx + _JANELA[0]) * ESCALA), int((cx + _JANELA[1]) * ESCALA)
    y0, y1 = int((cy + _JANELA[2]) * ESCALA), int((cy + _JANELA[3]) * ESCALA)
    if x0 < 0 or y0 < 0:
        return None
    size = (cfg.LARGURA_RET * ESCALA, cfg.ALTURA_RET * ESCALA)
    # Only warp the window that is needed.
    shift = np.array([[1, 0, -x0], [0, 1, -y0], [0, 0, 1.0]])
    crop = cv.warpPerspective(frame, shift @ M, (x1 - x0, y1 - y0))
    return crop if crop.shape[1] == x1 - x0 and size[0] > x1 and size[1] > y1 else None


def _runs(mask, minimum, gap=2):
    """(start, end) of runs of True, closing gaps of up to `gap` columns."""
    cols = np.flatnonzero(mask)
    runs = []
    for c in cols:
        if runs and c - runs[-1][1] <= gap + 1:
            runs[-1][1] = c
        else:
            runs.append([c, c])
    return [(a, b) for a, b in runs if b - a + 1 >= minimum]


def _corpo(hsv, linhas=_LINHAS_FAIXA):
    """Columns of the grey ceramic body, between the blue holder's two ends."""
    band = hsv[linhas[0]:linhas[1]]
    blue = ((band[:, :, 0] >= 88) & (band[:, :, 0] <= 110) & (band[:, :, 1] >= 150) & (band[:, :, 2] >= 40))
    runs = _runs(blue.mean(axis=0) >= .35, 18, gap=4)
    if len(runs) < 2:
        return None
    left, right = runs[0], runs[-1]
    start, end = left[1] + 4, right[0] - 4
    return (start, end) if end - start >= 150 else None


def _le_faixas(crop, linhas):
    """Per-body reading: dict(valor=int|None, motivo=str, faixas=[(start, end, name)])."""
    def recusa(motivo, faixas=()):
        return dict(valor=None, motivo=motivo, faixas=list(faixas))

    if crop is None or crop.size == 0:
        return recusa('corpo fora da imagem')
    clipped = float(np.mean(crop.max(axis=2) >= 250))
    if clipped > MAX_SATURADO:
        return recusa('imagem estourada; reduza a exposição')
    hsv = cv.cvtColor(cv.GaussianBlur(crop, (5, 5), 0), cv.COLOR_BGR2HSV)
    span = _corpo(hsv, linhas)
    if span is None:
        return recusa('corpo azul do resistor não encontrado')
    x0, x1 = span
    strip = hsv[linhas[0]:linhas[1], x0:x1]
    # Column medians of each channel (hue is only read where saturation says it is colour).
    h, s, v = (np.median(strip[:, :, i], axis=0) for i in range(3))
    warm = ((h <= 14) | (h >= 165)) & (s >= 60) & (v >= 80)
    yellow = (h >= 22) & (h <= 45) & (s >= 70) & (v >= 110)
    violet = (h >= 110) & (h <= 150) & (s >= 45) & (v >= 18)
    # Close sub-band holes caused by interpolation/JPEG: four 3x pixels
    # are smaller than the minimum accepted band, not a missing colour band.
    bands = ([(a + x0, b + x0, 'warm') for a, b in _runs(warm, MIN_LARGURA, gap=4)]
             + [(a + x0, b + x0, 'yellow') for a, b in _runs(yellow, MIN_LARGURA, gap=4)]
             + [(a + x0, b + x0, 'violet') for a, b in _runs(violet, MIN_LARGURA, gap=4)])
    bands.sort()
    # A band must not overlap another one of a different colour.
    for first, second in zip(bands, bands[1:]):
        if second[0] <= first[1]:
            return recusa('faixas sobrepostas', bands)
    names = [b[2] for b in bands]
    centres = [(a + b) / 2 for a, b, _ in bands]
    warm_count = names.count('warm')

    def equal_spacing(points):
        gaps = np.diff(points)
        return len(gaps) == 2 and min(gaps) >= .6 * max(gaps)

    if names == ['warm'] * 3:
        if not equal_spacing(centres):
            return recusa('faixas irregulares', bands)
        return dict(valor=220, motivo='', faixas=bands)
    if warm_count == 1 and sorted(names) == ['violet', 'warm', 'yellow'] and names[1] == 'violet':
        if not equal_spacing(centres):
            return recusa('faixas irregulares', bands)
        return dict(valor=470, motivo='', faixas=bands)
    if names == ['warm', 'warm']:
        gap = centres[1] - centres[0]
        # Equal spacing puts the black band exactly halfway between the other two.
        if not 100 <= gap <= 220:
            return recusa('faixas irregulares', bands)
        middle = (centres[0] + centres[1]) / 2
        half = max(MIN_LARGURA, int(gap * .12))
        a, b = int(middle - half), int(middle + half)
        inside = v[a - x0:b - x0 + 1]
        # Reference: the body's grey on both sides of the black band, away from the colour bands.
        reference = np.concatenate([v[int(bands[0][1] - x0) + 6:a - x0 - 4], v[b - x0 + 5:int(bands[1][0] - x0) - 5]])
        dark = (strip[:, a - x0:b - x0 + 1, 2] < 0.78 * np.median(reference)).mean() if reference.size else 0
        if reference.size >= 10 and dark >= .12:
            return dict(valor=1000, motivo='', faixas=bands)
        return recusa('faixa preta não confirmada', bands)
    return recusa('padrão de faixas desconhecido', bands)


def le_bandas(crop):
    """Decode only kit patterns; require agreement across body strips.

    Socket edges, glare and the curved ceramic surface affect different rows.
    Each strip must independently account for the complete three-band pattern.
    A conflicting value is refused, including when a majority would win.
    """
    reads = [_le_faixas(crop, rows) for rows in
             (_LINHAS_FAIXA, (20, 50), (40, 65), (65, 90), (60, 100), (75, 105),
              (30, 80), (50, 85))]
    decoded = [read for read in reads if read['valor'] is not None]
    values = {read['valor'] for read in decoded}
    if len(values) > 1:
        return dict(valor=None, motivo='leituras de faixas conflitantes', faixas=[])
    if len(decoded) >= 2:
        return decoded[0]
    if decoded:
        return dict(valor=None, motivo='faixas sem confirmação entre linhas', faixas=decoded[0]['faixas'])
    return reads[0]


def le_valor(frame, H, linha, coluna):
    """Value in ohms (220, 470 or 1000) of the resistor at (row, column), with the reading details."""
    return le_bandas(recorte_corpo(frame, H, linha, coluna))
