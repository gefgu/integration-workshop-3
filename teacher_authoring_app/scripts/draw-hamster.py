"""Draws the TedTronics hamster tutor as 32x32 pixel art, saved 4x (128x128) like the fox sprites.

Usage: python scripts/draw-hamster.py src/assets/mascots
"""
import sys
from PIL import Image

N, S = 32, 4
OUT = sys.argv[1]

OUTLINE = (74, 44, 26, 255)
FUR = (222, 150, 74, 255)
FUR_DARK = (190, 116, 52, 255)
FUR_LIGHT = (240, 184, 112, 255)
CREAM = (250, 236, 210, 255)
CREAM_DARK = (228, 206, 172, 255)
PINK = (238, 150, 150, 255)
PINK_DARK = (200, 100, 104, 255)
BLACK = (32, 24, 20, 255)
WHITE = (255, 255, 255, 255)
SCARF = (198, 113, 57, 255)  # terracotta, the app's accent colour
SCARF_DARK = (150, 80, 36, 255)


def ell(cx, cy, rx, ry):
    return {(x, y) for x in range(N) for y in range(N) if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1}


def draw(talking: bool) -> Image.Image:
    px: dict[tuple[int, int], tuple] = {}
    body = ell(16, 19.5, 11.5, 10.5)
    ears = ell(8.5, 9.5, 3.2, 3.2) | ell(23.5, 9.5, 3.2, 3.2)
    feet = ell(10.5, 29.6, 3, 1.4) | ell(21.5, 29.6, 3, 1.4)
    shape = body | ears | feet
    for p in shape:
        px[p] = FUR
    # shading: lower-right rim darker, upper-left lighter
    for (x, y) in body:
        if (x + 1, y + 1) not in body or (x, y + 2) not in body:
            px[(x, y)] = FUR_DARK
    for (x, y) in body:
        if ((x - 1, y - 1) not in body or (x, y - 1) not in body) and y < 16:
            px[(x, y)] = FUR_LIGHT
    for p in ears:
        px[p] = FUR
    for p in ell(8.5, 9.8, 1.6, 1.6) | ell(23.5, 9.8, 1.6, 1.6):
        px[p] = PINK
    # cream face and belly
    belly = (ell(16, 24, 8, 6.5) | ell(16, 18.5, 5.5, 3.5)) & body
    for p in belly:
        px[p] = CREAM
    for (x, y) in belly:
        if (x, y + 1) not in belly and (x, y + 1) in body:
            px[(x, y)] = CREAM_DARK
    for p in feet:
        px[p] = PINK
    for (x, y) in feet:
        if y == max(yy for (_, yy) in feet):
            px[(x, y)] = PINK_DARK
    # scarf
    for x in range(8, 24):
        if (x, 21) in body:
            px[(x, 21)] = SCARF
        if (x, 22) in body:
            px[(x, 22)] = SCARF_DARK if x % 3 == 0 else SCARF
    for p in [(20, 23), (21, 23), (20, 24), (21, 24)]:
        px[p] = SCARF_DARK
    # paws holding the scarf
    for p in [(12, 23), (13, 23), (18, 23), (19, 23)]:
        px[p] = PINK
    # eyes with highlight
    for ex in (10, 20):
        for dx in range(2):
            for dy in range(3):
                px[(ex + dx, 14 + dy)] = BLACK
        px[(ex, 14)] = WHITE
    # cheeks
    for p in [(7, 18), (8, 18), (23, 18), (24, 18)]:
        px[p] = PINK
    # nose
    px[(15, 17)] = PINK_DARK
    px[(16, 17)] = PINK_DARK
    # mouth
    if talking:
        for p in [(14, 18), (15, 18), (16, 18), (17, 18), (15, 19), (16, 19)]:
            px[p] = BLACK
        px[(15, 19)] = PINK
        px[(16, 19)] = PINK
        for p in [(14, 20), (17, 20)]:
            px.pop(p, None)
            px[p] = CREAM
        for p in [(15, 20), (16, 20)]:
            px[p] = BLACK
    else:
        px[(14, 18)] = OUTLINE
        px[(15, 19)] = OUTLINE
        px[(16, 19)] = OUTLINE
        px[(17, 18)] = OUTLINE
    # outline around the whole silhouette
    for (x, y) in list(shape):
        for (nx, ny) in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if (nx, ny) not in shape and 0 <= nx < N and 0 <= ny < N:
                px[(nx, ny)] = OUTLINE
    img = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    for (x, y), c in px.items():
        if 0 <= x < N and 1 <= y < N:  # drawn one pixel up so the feet clear the bottom edge
            img.putpixel((x, y - 1), c)
    return img.resize((N * S, N * S), Image.NEAREST)


draw(False).save(f'{OUT}/hamster-idle.png')
draw(True).save(f'{OUT}/hamster-talking.png')
