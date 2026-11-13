"""Four-sticker proposals for the fixed, two-bank November bench.

The green/white diagonal pattern does not encode a 180 degree orientation.
This profile deliberately keeps the original board orientation. Marker matches
are only proposals: distributed contacts must validate each bank independently.
"""
from functools import lru_cache
from itertools import combinations, product
from pathlib import Path

import cv2 as cv
import numpy as np

from .calibracao import _MARKER_GRID, candidatos

GRID = np.float32([(c, r) for r in range(6) for c in range(11)])
OUTLINE = np.float32([[0, 0], [10, 0], [10, 5], [0, 5]])
# Annotations of existing stickers and socket contacts in the saved empty board.
# These describe this physical board; they are not component positions.
MARKS = np.float32([[151.5, 95.3], [889., 94.], [989.4, 674.9], [96., 700.]])
REFERENCE_BANKS = (
    cv.getPerspectiveTransform(OUTLINE, _MARKER_GRID),
    cv.getPerspectiveTransform(OUTLINE, np.float32([[191, 129], [852, 123], [873, 316], [183, 320]])),
)


@lru_cache(maxsize=1)
def reference_image():
    return cv.imread(str(Path(__file__).parent / 'fixtures/current/marked-empty-2026-11-11.jpg'))


def contact_candidates(image):
    """Include the actual rectangular copper contacts, not just square holes.

    At 720p the exposed upper-bank contacts are about 25 by 10 pixels. The
    legacy square-hole aspect limit discards these. Socket spacing, uniqueness,
    row/column distribution and reprojection error are checked separately.
    """
    # The dim copper patches have JPEG-sized holes at their borders. Smooth
    # those pixels before measuring the same .65 fill used by the original
    # socket detector; do not mistake unfiltered compression speckles for
    # the contact's physical outline.
    gray = cv.GaussianBlur(cv.cvtColor(image, cv.COLOR_BGR2GRAY), (3, 3), 0)
    scale = image.shape[0] * image.shape[1] / (1280 * 720)
    points = list(candidatos(image))
    separation = 5 * np.sqrt(scale)
    buckets = {}
    for point in points:
        key = (int(point[0] // separation), int(point[1] // separation))
        buckets.setdefault(key, []).append(point)
    for threshold in (200, 160, 120, 90, 70, 50, 35, 25, 15):
        _, mask = cv.threshold(gray, threshold, 255, cv.THRESH_BINARY)
        _, _, stats, centers = cv.connectedComponentsWithStats(mask)
        widths, heights, areas = stats[1:, 2], stats[1:, 3], stats[1:, 4]
        eligible = np.flatnonzero((areas >= 110 * scale) & (areas <= 900 * scale)
                                  & (widths >= 1.2 * heights) & (widths <= 3.5 * heights)
                                  & (areas >= .65 * widths * heights)) + 1
        for index in eligible:
            center = centers[index]
            x, y = map(float, center)
            key = (int(x // separation), int(y // separation))
            near = (p for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                    for p in buckets.get((key[0] + dx, key[1] + dy), ()))
            if all((x - p[0]) ** 2 + (y - p[1]) ** 2 > separation ** 2 for p in near):
                points.append(center)
                buckets.setdefault(key, []).append(center)
    return np.asarray(points, np.float32).reshape(-1, 2)


def fit_bank(proposal, points, shape, minimum=12):
    """Refine a marker proposal; never use a lattice to invent its origin."""
    projected = cv.perspectiveTransform(GRID[None], proposal)[0]
    height, width = shape[:2]
    if (not np.isfinite(projected).all() or np.any(projected < 0)
            or np.any(projected[:, 0] >= width) or np.any(projected[:, 1] >= height)
            or len(points) < minimum):
        return None
    spacing = float(np.median(np.linalg.norm(np.diff(projected.reshape(6, 11, 2), axis=1), axis=2)))
    if spacing < 10:
        return None
    distances = np.linalg.norm(projected[:, None] - points[None], axis=2)
    pairs = sorted((float(distances[j, i]), j, int(i)) for j, i in enumerate(distances.argmin(axis=1)))
    used, matches = set(), []
    for distance, j, i in pairs:
        if distance < spacing * .28 and i not in used:
            used.add(i)
            matches.append((j, i))
    if len(matches) < minimum:
        return None
    source = np.float32([GRID[j] for j, _ in matches])
    target = np.float32([points[i] for _, i in matches])
    cv.setRNGSeed(0)
    # The four markings already establish perspective. A free projective
    # fit from a crowded bank can swing its hidden edge by half a column.
    # Permit a small affine correction for the bank's printed pitch/shear,
    # preserving the projective denominator established by the four markings.
    predicted_matches = cv.perspectiveTransform(source[None], proposal)[0]
    correction, mask = cv.estimateAffine2D(predicted_matches, target, method=cv.RANSAC,
                                           ransacReprojThreshold=spacing * .10)
    if correction is None or mask is None:
        return None
    h = np.vstack([correction, [0., 0., 1.]]) @ proposal
    keep = mask.ravel().astype(bool)
    model = source[keep]
    if (len(model) < minimum or len(set(model[:, 0])) < 4 or len(set(model[:, 1])) < 3
            or np.ptp(model[:, 0]) < 6 or np.ptp(model[:, 1]) < 3):
        return None
    fitted = cv.perspectiveTransform(GRID[None], h)[0]
    error = np.linalg.norm(cv.perspectiveTransform(source[None], h)[0] - target, axis=1)[keep]
    if (not np.isfinite(fitted).all() or np.any(fitted < 0)
            or np.any(fitted[:, 0] >= width) or np.any(fitted[:, 1] >= height)
            or np.max(np.linalg.norm(fitted - projected, axis=1)) > spacing * .35
            or np.median(error) > spacing * .08 or np.percentile(error, 90) > spacing * .15):
        return None
    seen = np.zeros(66, bool)
    for accepted, (j, _) in zip(keep, matches):
        seen[j] = accepted
    return dict(H=h, inliers=int(keep.sum()), erro=float(np.median(error)), seen=seen)


def validate_fixed_bank(h, points, shape):
    """Validate a fixed camera without re-estimating hidden grid coordinates."""
    projected = cv.perspectiveTransform(GRID[None], h)[0]
    height, width = shape[:2]
    if (not len(points) or not np.isfinite(projected).all() or np.any(projected < 0)
            or np.any(projected[:, 0] >= width) or np.any(projected[:, 1] >= height)):
        return None
    spacing = float(np.median(np.linalg.norm(np.diff(projected.reshape(6, 11, 2), axis=1), axis=2)))
    distances = np.linalg.norm(projected[:, None] - points[None], axis=2)
    pairs = sorted((float(distances[j, i]), j, int(i)) for j, i in enumerate(distances.argmin(axis=1)))
    used, accepted = set(), []
    for distance, j, i in pairs:
        if distance <= spacing * .15 and i not in used:
            used.add(i)
            accepted.append((distance, j))
    model = GRID[[j for _, j in accepted]]
    if (len(accepted) < 12 or len(set(model[:, 0])) < 4 or len(set(model[:, 1])) < 3
            or np.ptp(model[:, 0]) < 6 or np.ptp(model[:, 1]) < 3
            or np.median([d for d, _ in accepted]) > spacing * .08):
        return None
    seen = np.zeros(66, bool)
    seen[[j for _, j in accepted]] = True
    return dict(H=h, inliers=len(accepted), erro=float(np.median([d for d, _ in accepted])), seen=seen)


def _white_options(gray, warped, predicted):
    """Several local maxima are checked against sockets; a jumper cannot win by brightness alone."""
    x, y = np.rint(predicted).astype(int)
    half = 18
    if x < half or y < half or x + half >= gray.shape[1] or y + half >= gray.shape[0]:
        return []
    patch = warped[y - half:y + half + 1, x - half:x + half + 1]
    # Two diagonal greens provide only a similarity seed. In the newer
    # perspective the lower white marking is ~73 px from that seed. Include
    # its whole patch within two reference socket spacings, then let the
    # four-point fit and distributed sockets reject competing white pieces.
    radius = 130
    x0, y0 = max(0, x - radius), max(0, y - radius)
    search = gray[y0:min(gray.shape[0], y + radius), x0:min(gray.shape[1], x + radius)]
    scores = cv.matchTemplate(search, patch, cv.TM_CCOEFF_NORMED)
    out = []
    for _ in range(16):
        _, score, _, loc = cv.minMaxLoc(scores)
        if score < .50:
            break
        out.append((np.float32([x0 + loc[0] + half, y0 + loc[1] + half]), score))
        cv.rectangle(scores, (max(0, loc[0] - 8), max(0, loc[1] - 8)), (loc[0] + 8, loc[1] + 8), -1, -1)
    return out


def four_sticker_proposal(image):
    """Return validated C/B homographies from four observed corner regions, or None."""
    height, width = image.shape[:2]
    if width < 640 or abs(width / height - 16 / 9) > .03:
        return None
    ref = reference_image()
    if ref is None:
        return None
    small = cv.resize(image, (1280, 720), interpolation=cv.INTER_AREA)
    hsv = cv.cvtColor(small, cv.COLOR_BGR2HSV)
    # At the measured 1000–1300 settings the genuine green sticker has
    # V~20–30. Its chroma and rectangle remain strong; an absolute V=35
    # cutoff removed that reference before socket validation could run.
    greens = []
    for value in (35, 25, 15):
        mask = cv.inRange(hsv, (65, 65, value), (100, 255, 255))
        n, _, stats, centers = cv.connectedComponentsWithStats(mask)
        for i in range(1, n):
            if (600 <= stats[i, 4] <= 2400 and .5 < stats[i, 2] / stats[i, 3] < 1.8
                    and all(np.linalg.norm(centers[i] - p) > 8 for p in greens)):
                greens.append(centers[i])
    greens.sort(key=lambda p: (float(p.sum()), float(p[0])))
    contacts = contact_candidates(small)
    if len(contacts) < 24:
        return None
    gray = cv.cvtColor(small, cv.COLOR_BGR2GRAY)
    ranked = []
    for tl, br in combinations(greens, 2):
        if br[0] - tl[0] < 400 or br[1] - tl[1] < 350:
            continue
        u, v = MARKS[2] - MARKS[0], br - tl
        a, b = float(u @ v / (u @ u)), float((u[0] * v[1] - u[1] * v[0]) / (u @ u))
        if not .65 <= np.hypot(a, b) <= 1.35 or abs(np.arctan2(b, a)) > np.deg2rad(15):
            continue
        linear = np.float32([[a, -b], [b, a]])
        similarity = np.column_stack([linear, tl - linear @ MARKS[0]])
        predicted = cv.transform(MARKS[None], similarity)[0]
        warped = cv.cvtColor(cv.warpAffine(ref, similarity, (1280, 720)), cv.COLOR_BGR2GRAY)
        options = [_white_options(gray, warped, predicted[i]) for i in (1, 3)]
        for (tr, s1), (bl, s2) in product(*options):
            marks = np.float32([tl, tr, br, bl])
            if not cv.isContourConvex(marks):
                continue
            transform = cv.getPerspectiveTransform(MARKS, marks)
            banks = [fit_bank(transform @ h, contacts, small.shape) for h in REFERENCE_BANKS]
            if any(bank is None for bank in banks):
                continue
            score = sum(bank['inliers'] for bank in banks)
            error = sum(bank['erro'] for bank in banks)
            ranked.append(((-score, error, -s1 - s2, tuple(marks.ravel())), banks, marks))
    if not ranked:
        return None
    _, banks, marks = min(ranked, key=lambda item: item[0])
    scale = np.diag([width / 1280, height / 720, 1.])
    for bank in banks:
        bank['H'] = scale @ bank['H']
    return dict(banks=banks, marks=marks * [width / 1280, height / 720])
