"""Read printed plus/minus marks; never infer polarity from type or position."""
import cv2 as cv
import numpy as np

from . import config as cfg


def _responses(gray, plus):
    best = np.full(gray.shape, -np.inf, np.float32)
    for size in ((9, 11, 13, 15, 17, 19) if plus else (9, 13, 17, 21)):
        middle = size // 2
        stroke = max(1, size // 6)
        corners = np.ones((size, size), np.float32)
        corners[middle - stroke:middle + stroke + 1, :] = 0
        corners[:, middle - stroke:middle + stroke + 1] = 0
        corners /= corners.sum()
        if plus:
            arms = []
            for x0, y0, x1, y1 in ((middle - stroke, 0, middle + stroke + 1, middle),
                                    (middle - stroke, middle + 1, middle + stroke + 1, size),
                                    (0, middle - stroke, middle, middle + stroke + 1),
                                    (middle + 1, middle - stroke, size, middle + stroke + 1)):
                arm = np.zeros((size, size), np.float32)
                arm[y0:y1, x0:x1] = 1
                arm /= arm.sum()
                arms.append(cv.filter2D(gray, cv.CV_32F, arm - corners))
            response = np.minimum.reduce(arms)
        else:
            line = np.zeros((size, size), np.float32)
            line[middle - 1:middle + 2, :] = 1
            line /= line.sum()
            above = np.zeros_like(line)
            above[:middle - 2, :] = 1
            below = np.zeros_like(line)
            below[middle + 3:, :] = 1
            above /= above.sum()
            below /= below.sum()
            response = np.minimum(cv.filter2D(gray, cv.CV_32F, line - above),
                                  cv.filter2D(gray, cv.CV_32F, line - below))
        best = np.maximum(best, response)
    return best


def read_polarity(rect, row, first, last, kind):
    """Return known terminal columns only with complementary printed signs."""
    cy = int(round(cfg.para_retificada(0, row)[1]))
    origin_x = max(0, int(round(cfg.para_retificada(first, row)[0])) - 45)
    origin_y = max(0, cy - 60)
    end_x = min(rect.shape[1], int(round(cfg.para_retificada(last, row)[0])) + 50)
    rect = rect[origin_y:min(rect.shape[0], cy + 10), origin_x:end_x]
    cy -= origin_y
    gray = cv.cvtColor(rect, cv.COLOR_BGR2GRAY).astype(np.float32)
    hsv = cv.cvtColor(rect, cv.COLOR_BGR2HSV)
    plus = _responses(gray, True)
    minus = _responses(gray, False)
    neutral = (hsv[:, :, 1] < 110) & (hsv[:, :, 2] >= 90)
    top, bottom = (cy - 24, cy - 2) if kind == 'vermelho_2' else (cy - 39, cy - 8)
    top, bottom = max(0, top), min(rect.shape[0], bottom)
    if bottom <= top:
        return dict(status='unknown', reason='polarity_crop_clipped')
    scores = []
    locations = []
    for col in (first, last):
        cx = int(round(cfg.para_retificada(col, row)[0])) - origin_x
        x0, x1 = max(0, cx - 22), min(rect.shape[1], cx + 33)
        allowed = neutral[top:bottom, x0:x1]
        side, positions = [], []
        for response in (plus, minus):
            roi = np.where(allowed, response[top:bottom, x0:x1], -1000)
            y, x = np.unravel_index(np.argmax(roi), roi.shape)
            side.append(float(roi[y, x]))
            positions.append((int(x + x0), int(y + top)))
        scores.append(side)
        locations.append(positions)
    left = min(scores[0][0], scores[1][1])
    right = min(scores[1][0], scores[0][1])
    winner = 0 if left > right else 1
    strong, weak = max(left, right), min(left, right)
    if strong < 8 or strong - weak < 4:
        return dict(status='unknown', reason='printed_signs_ambiguous')
    positive, negative = ((first, last) if winner == 0 else (last, first))
    return dict(status='known', positive=positive, negative=negative,
                reason='complementary_printed_signs', score=round(strong, 2))
