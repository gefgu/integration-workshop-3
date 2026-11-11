"""Explicit upper-grid calibration and contrast-independent socket tracking."""
import json
import time
from functools import lru_cache
from pathlib import Path
import cv2 as cv
import numpy as np
from . import config as cfg

CANTOS = np.float32([[0, 0], [10, 0], [10, 5], [0, 5]])

# Reference of this board with its C grid established by the four-edge fit.
_REFERENCE_H = np.array([[75.4142064, -7.3069687, 265.4040750],
                         [2.3364109, 44.3020119, 377.0355578],
                         [-.0014676733, -.0097659579, 1.]])
_COMPLETED_H = np.array([[73.8337295, -4.9540240, 227.165260],
                         [-3.3460936, 44.2486666, 456.072131],
                         [-.00362749906, -.00895937683, 1.]])
REFERENCES = (('frame-00.jpg', _REFERENCE_H), ('reference-completed.jpg', _COMPLETED_H))

# The two green corner stickers on the current demonstration board, measured
# in a 1280x720 reference frame. They define a board-specific similarity
# transform, not a general four-corner perspective calibration. Keep the board
# in its marked orientation; the diagonally repeated colours cannot identify a
# 180-degree turn. Socket registration below must still accept every proposal.
_MARKER_ANCHORS = np.float32([[151.5, 95.3], [989.4, 674.9]])
_MARKER_GRID = np.float32([[167.618, 409.969], [895.826, 393.541],
                           [926.305, 637.397], [157.438, 662.056]])
_MARKER_LUT = np.uint8((np.arange(256) / 255.0) ** .4 * 255)


def calibra_por_marcadores(image):
    """Propose the current board's grid from green stickers, or return None.

    Deliberately limited to a small displacement of the reference framing.
    Two identical diagonal pairs cannot establish orientation or perspective;
    a moved sticker, rotated board, or camera perspective change needs manual
    calibration. The existing socket/inlier validation remains mandatory.
    """
    height, width = image.shape[:2]
    if width < 640 or height < 360 or abs(width / height - 1280 / 720) > .03:
        return None
    hsv = cv.cvtColor(image, cv.COLOR_BGR2HSV)
    mask = cv.inRange(hsv, np.array([70, 70, 70], np.uint8), np.array([95, 255, 255], np.uint8))
    scale = np.float32([width / 1280, height / 720])
    anchors = []
    for expected in _MARKER_ANCHORS * scale:
        x, y = expected
        rx, ry = width * .14, height * .10
        x0, x1 = max(0, int(x - rx)), min(width, int(x + rx))
        y0, y1 = max(0, int(y - ry)), min(height, int(y + ry))
        count, _, stats, centers = cv.connectedComponentsWithStats(mask[y0:y1, x0:x1])
        area_scale = width * height / (1280 * 720)
        eligible = []
        for i in range(1, count):
            _, _, w, h, area = stats[i]
            if 600 * area_scale <= area <= 4000 * area_scale and .5 < w / h < 2:
                eligible.append(centers[i] + [x0, y0])
        if len(eligible) != 1:
            return None
        anchors.append(eligible[0] / scale)
    anchors = np.float32(anchors)
    source = _MARKER_ANCHORS[1] - _MARKER_ANCHORS[0]
    target = anchors[1] - anchors[0]
    ratio = float(np.linalg.norm(target) / np.linalg.norm(source))
    angle = float(np.arctan2(target[1], target[0]) - np.arctan2(source[1], source[0]))
    if not .9 <= ratio <= 1.1 or abs(angle) > np.deg2rad(4):
        return None
    matrix = np.array([[np.cos(angle), -np.sin(angle)], [np.sin(angle), np.cos(angle)]]) * ratio
    # The green stickers alone are symmetric under 180 degrees. The fixture's
    # upper bank is dark and its lower bank has bright socket contacts. Sample
    # dispersed points in both banks; a single movable strip must not decide
    # orientation. If illumination or occlusion makes the cue ambiguous,
    # reject this proposal and fall back to the old registration.
    gray = cv.cvtColor(image, cv.COLOR_BGR2GRAY)
    bright_fractions = []
    means = []
    for y0, y1 in ((120, 300), (440, 620)):
        samples = np.float32([(x, y) for x in range(240, 900, 8) for y in range(y0, y1, 8)])
        projected = np.rint(((samples - _MARKER_ANCHORS[0]) @ matrix.T + anchors[0]) * scale).astype(int)
        inside = ((projected[:, 0] >= 0) & (projected[:, 0] < width)
                  & (projected[:, 1] >= 0) & (projected[:, 1] < height))
        if inside.mean() < .95:
            return None
        values = gray[projected[inside, 1], projected[inside, 0]]
        bright_fractions.append(float(np.mean(values > 90)))
        means.append(float(np.mean(values)))
    if bright_fractions[1] - bright_fractions[0] < .06 or means[1] - means[0] < 8:
        return None
    corners = ((_MARKER_GRID - _MARKER_ANCHORS[0]) @ matrix.T + anchors[0]) * scale
    try:
        return homografia_cantos(image, corners)
    except ValueError:
        return None


@lru_cache(maxsize=2)
def _reference_features(name):
    path = Path(__file__).parent / 'fixtures/current' / name
    image = cv.imread(str(path))
    if image is None or not hasattr(cv, 'SIFT_create'):
        return None
    points, descriptors = cv.SIFT_create().detectAndCompute(cv.cvtColor(image, cv.COLOR_BGR2GRAY), None)
    return points, descriptors


def calibra_por_referencia(image):
    """Anchor the grid using distributed, distinctive features of the board.

    The resulting mapping is only a proposal: normal socket matching and
    tracking validation must still accept it before any position is reported.
    """
    if not hasattr(cv, 'SIFT_create'):
        return None
    points, descriptors = cv.SIFT_create().detectAndCompute(cv.cvtColor(image, cv.COLOR_BGR2GRAY), None)
    if descriptors is None or len(descriptors) < 2:
        return None
    for name, reference_h in REFERENCES:
        reference = _reference_features(name)
        if reference is None or reference[1] is None:
            continue
        matches = cv.BFMatcher().knnMatch(reference[1], descriptors, k=2)
        good = [pair[0] for pair in matches if len(pair) == 2 and pair[0].distance < .7 * pair[1].distance]
        if len(good) < 20:
            continue
        source = np.float32([reference[0][m.queryIdx].pt for m in good])
        target = np.float32([points[m.trainIdx].pt for m in good])
        # OpenCV's random state is thread-local; seed every RANSAC fit so an
        # unrelated earlier OpenCV call cannot change a registration proposal.
        cv.setRNGSeed(0)
        H, mask = cv.findHomography(source, target, cv.RANSAC, 3.0)
        if H is None or mask is None or not np.isfinite(H).all():
            continue
        accepted = mask.ravel().astype(bool)
        if accepted.sum() < 20:
            continue
        locations = cv.perspectiveTransform(source[accepted][None], np.linalg.inv(reference_h))[0]
        # A cluster on one movable component cannot establish board geometry.
        if np.ptp(locations[:, 0]) < 5.5 or np.ptp(locations[:, 1]) < 4:
            continue
        candidate = H @ reference_h
        projected = cv.perspectiveTransform(CANTOS[None], candidate)[0]
        if np.isfinite(projected).all() and cv.isContourConvex(projected.reshape(-1, 1, 2)):
            return candidate
    return None


def calibra_automaticamente(image, points=None):
    """Fit an upper-grid lattice only when all four edges have support.

    An incomplete lattice does not establish absolute numbering; in that case
    return None so the caller can request explicit corner selection.
    """
    points = candidatos(image) if points is None else points
    if len(points) < 20:
        return None
    height, width = image.shape[:2]
    delta = points[:, None, :] - points[None, :, :]
    dx, dy = delta[:, :, 0], delta[:, :, 1]
    horizontal = ((dx > width * .03) & (dx < width * .10) & (abs(dy) < .20 * dx))
    vertical = ((dy > height * .04) & (dy < height * .11) & (abs(dx) < .24 * dy))
    if horizontal.sum() < 10 or vertical.sum() < 10:
        return None
    vx, vy = np.median(delta[horizontal], axis=0), np.median(delta[vertical], axis=0)
    basis = np.column_stack((vx, vy))
    if abs(np.linalg.det(basis)) < 1:
        return None
    inverse = np.linalg.inv(basis)
    best = None
    for seed in points:
        coords = (points - seed) @ inverse.T
        indices = np.rint(coords).astype(int)
        error = np.linalg.norm(coords - indices, axis=1)
        good = error < .23
        if good.sum() < 20:
            continue
        for x0 in range(indices[good, 0].min() - 10, indices[good, 0].max() + 1):
            for y0 in range(indices[good, 1].min() - 5, indices[good, 1].max() + 1):
                selected = (good & (indices[:, 0] >= x0) & (indices[:, 0] <= x0 + 10)
                            & (indices[:, 1] >= y0) & (indices[:, 1] <= y0 + 5))
                positions = indices[selected] - [x0, y0]
                if len(positions) < 20:
                    continue
                edges = [(positions[:, 0] == 0).sum(), (positions[:, 0] == 10).sum(),
                         (positions[:, 1] == 0).sum(), (positions[:, 1] == 5).sum()]
                if min(edges) < 2:
                    continue
                score = len(set(map(tuple, positions.tolist())))
                if best is None or score > best[0]:
                    best = (score, selected, positions, error)
    if best is None:
        return None
    _, selected, positions, errors = best
    candidate_points = points[selected]
    # Use each logical socket only once, even if several thresholds detected it.
    unique = {}
    for index, position in enumerate(map(tuple, positions.tolist())):
        if position not in unique or errors[selected][index] < errors[selected][unique[position]]:
            unique[position] = index
    take = list(unique.values())
    model = np.float32(positions[take])
    target = candidate_points[take]
    cv.setRNGSeed(0)
    H, mask = cv.findHomography(model, target, cv.RANSAC, float(np.linalg.norm(vx)) * .12)
    if H is None:
        return None
    inliers = mask.ravel().astype(bool)
    matched = model[inliers]
    if (len(matched) < 20 or any(n < 2 for n in
            ((matched[:, 0] == 0).sum(), (matched[:, 0] == 10).sum(),
             (matched[:, 1] == 0).sum(), (matched[:, 1] == 5).sum()))):
        return None
    # A fit spanning the empty channel between two banks can satisfy the
    # outer-edge check while inventing an entirely missing intermediate row.
    if any((matched[:, 1] == row).sum() < 2 for row in range(cfg.N_LINHAS_METADE)):
        return None
    error = np.linalg.norm(cv.perspectiveTransform(model[None], H)[0] - target, axis=1)[inliers]
    spacing = float(np.linalg.norm(vx))
    if np.median(error) > .08 * spacing or np.percentile(error, 90) > .15 * spacing:
        return None
    return H


def candidatos(image):
    gray = cv.cvtColor(image, cv.COLOR_BGR2GRAY)
    gray = cv.GaussianBlur(gray, (3, 3), 0)
    scale = image.shape[0] * image.shape[1] / (1280 * 720)
    min_distance_squared = 25 * scale
    points = []
    for threshold, polarity in ((110, cv.THRESH_BINARY), (170, cv.THRESH_BINARY), (210, cv.THRESH_BINARY), (110, cv.THRESH_BINARY_INV)):
        _, mask = cv.threshold(gray, threshold, 255, polarity)
        _, _, stats, centers = cv.connectedComponentsWithStats(mask)
        for (_, _, w, h, area), center in zip(stats[1:], centers[1:]):
            if 180 * scale < area < 2400 * scale and .55 < w / h < 1.9 and area / (w*h) > .65:
                x, y = map(float, center)
                if all((x - px) ** 2 + (y - py) ** 2 > min_distance_squared for px, py in points):
                    points.append((x, y))
    return np.float32(points).reshape(-1, 2)


def homografia_cantos(image, points):
    points = np.float32(points)
    if (points.shape != (4, 2) or not np.isfinite(points).all()
            or not cv.isContourConvex(points.reshape(-1, 1, 2))):
        raise ValueError('Select four convex corners in TL, TR, BR, BL order')
    height, width = image.shape[:2]
    if (np.any(points[:, 0] < 0) or np.any(points[:, 0] >= width)
            or np.any(points[:, 1] < 0) or np.any(points[:, 1] >= height)
            or points[0, 0] >= points[1, 0] or points[3, 0] >= points[2, 0]
            or points[0, 1] >= points[3, 1] or points[1, 1] >= points[2, 1]):
        raise ValueError('Corners must be in image in TL, TR, BR, BL order')
    H = cv.getPerspectiveTransform(CANTOS, points)
    if not np.isfinite(H).all() or abs(np.linalg.det(H)) < 1e-9:
        raise ValueError('Degenerate calibration')
    return H


def salva(path, image, points):
    H = homografia_cantos(image, points)
    with open(path, 'w') as out:
        json.dump({'profile': 'current', 'size': list(image.shape[1::-1]), 'H': H.tolist()}, out, indent=2)


def calibra_interativa(image, path):
    """Select TL/TR/BR/BL, preview numbered grid, then confirm or cancel."""
    import os
    if os.path.exists(path):
        raise FileExistsError(f'Calibration file already exists: {path}')
    window = 'Calibracao: TL TR BR BL - Enter confirma - R reinicia - Esc cancela'
    points = []
    confirm = False
    def click(event, x, y, flags, parameter):
        if not confirm and event == cv.EVENT_LBUTTONDOWN and len(points) < 4:
            points.append([x, y])
    cv.namedWindow(window)
    cv.setMouseCallback(window, click)
    try:
        while True:
            preview = image.copy()
            for index, point in enumerate(points):
                cv.circle(preview, tuple(point), 6, (0, 255, 255), 2)
                cv.putText(preview, str(index + 1), tuple(point), cv.FONT_HERSHEY_SIMPLEX,
                           .6, (0, 255, 255), 2)
            if confirm:
                H = homografia_cantos(image, points)
                projected = cv.perspectiveTransform(cfg.MODELO[:66][None], H)[0]
                for index, (x, y) in enumerate(projected):
                    point = (int(x), int(y))
                    cv.circle(preview, point, 4, (0, 255, 0), 1)
                    cv.putText(preview, f'{index // 11}:{index % 11}', point,
                               cv.FONT_HERSHEY_SIMPLEX, .28, (0, 255, 0), 1)
            cv.imshow(window, preview)
            key = cv.waitKey(20) & 255
            if key == 27:
                return False
            if key == ord('r'):
                points.clear()
                confirm = False
            if key in (10, 13) and len(points) == 4:
                if confirm:
                    salva(path, image, points)
                    return True
                try:
                    homografia_cantos(image, points)
                except ValueError as exc:
                    print(f'Calibracao invalida: {exc}; pressione R para reiniciar')
                else:
                    confirm = True
    finally:
        cv.destroyWindow(window)


# The automatic grid search is expensive (seconds on a Raspberry Pi). When it fails, retry only this
# often instead of on every frame; an explicit recalibrar() searches again at once.
INTERVALO_BUSCA_S = 2.0


class RegistradorParcial:
    def __init__(self, path=None, clock=time.monotonic):
        self.clock = clock
        self.ultima_busca = None
        self.ultimo_motivo = ''
        self.auto = path is None
        self.generation = 0
        self.last_gray = None
        self.marker_active = False
        if self.auto:
            self.size = None
            self.H = None
            self.anchor = None
            return
        with open(path) as source:
            data = json.load(source)
        if data['profile'] != 'current':
            raise ValueError('Calibration profile mismatch')
        self.size = data['size']
        self.H = np.asarray(data['H'], dtype=float)
        if (self.H.shape != (3, 3) or not np.isfinite(self.H).all()
                or abs(np.linalg.det(self.H)) < 1e-9):
            raise ValueError('Invalid homography')
        self.anchor = self.H.copy()

    def recalibrar(self):
        # Discard accumulated tracking drift and revalidate the original anchor.
        self.H = None if self.auto else self.anchor.copy()
        self.generation += 1
        self.last_gray = None
        self.ultima_busca = None
        self.marker_active = False
        if self.auto:
            self.size = None

    def _falhou(self, result, motivo):
        result['motivo'] = motivo
        self.ultimo_motivo = motivo
        if self.auto:
            self.H = None
            self.size = None
            self.last_gray = None
        return result

    def atualiza(self, image):
        result = self._atualiza(image)
        if not result['valido'] and self.marker_active:
            # Never let a marker proposal block the original automatic search.
            self.marker_active = False
            self.ultima_busca = None
            return self._atualiza(image, skip_markers=True)
        return result

    def _atualiza(self, image, skip_markers=False):
        seen = np.zeros(len(cfg.MODELO), bool)
        agora = self.clock()
        if (self.H is None and self.ultima_busca is not None
                and agora - self.ultima_busca < INTERVALO_BUSCA_S):
            # Too soon to repeat a search that just failed: skip the expensive work.
            return dict(H=None, valido=False, n_furos=0, furos=np.zeros((0, 2), np.float32),
                        inliers=0, erro=None, furos_vistos=seen, generation=self.generation,
                        motivo=self.ultimo_motivo or 'grade incompleta ou origem ambígua; use calibração manual')
        marker_h = None
        if self.auto and not skip_markers and (self.H is None or self.marker_active):
            marker_h = calibra_por_marcadores(image)
            if self.marker_active and marker_h is None:
                return self._falhou(dict(H=None, valido=False, n_furos=0, furos=np.zeros((0, 2), np.float32),
                                         inliers=0, erro=None, furos_vistos=seen, generation=self.generation),
                                    'marcadores não encontrados')
            if self.marker_active and self.H is not None:
                actual = cv.perspectiveTransform(CANTOS[None], self.H)[0]
                marked = cv.perspectiveTransform(CANTOS[None], marker_h)[0]
                spacing = np.linalg.norm(marked[1] - marked[0]) / 10
                if np.max(np.linalg.norm(actual - marked, axis=1)) > spacing * .35:
                    return self._falhou(dict(H=None, valido=False, n_furos=0, furos=np.zeros((0, 2), np.float32),
                                             inliers=0, erro=None, furos_vistos=seen, generation=self.generation),
                                        'marcadores se moveram')
                # Re-anchor each frame instead of accumulating tiny RANSAC
                # adjustments when only a few rows are visible.
                self.H = marker_h
        marker_search = marker_h is not None and (self.H is None or self.marker_active)
        points = candidatos(cv.LUT(image, _MARKER_LUT) if marker_search else image)
        if self.H is None:
            # The completed bench has two similar grids; a lattice-only fit can
            # span their gap and assign the wrong row numbers. Prefer the
            # board-specific reference when it has enough distributed matches.
            self.H = marker_h
            self.marker_active = self.H is not None
            if self.H is None:
                self.H = calibra_por_referencia(image)
            if self.H is None:
                self.H = calibra_automaticamente(image, points)
            # Remember only failed searches; losing a good grid must be reacquired at once.
            self.ultima_busca = agora if self.H is None else None
            if self.H is not None:
                self.size = list(image.shape[1::-1])
                self.generation += 1
        result = dict(H=self.H, valido=False, n_furos=len(points), furos=points,
                      inliers=0, erro=None, furos_vistos=seen, generation=self.generation,
                      motivo='')
        if self.H is None:
            return self._falhou(result, 'grade incompleta ou origem ambígua; use calibração manual')
        if list(image.shape[1::-1]) != self.size:
            return self._falhou(result, 'resolução diferente da calibração')
        if not len(points):
            return self._falhou(result, 'nenhum socket detectado')
        model = cfg.MODELO[:66]
        projected = cv.perspectiveTransform(model[None], self.H)[0]
        spacing = np.median(np.linalg.norm(projected.reshape(6,11,2)[:,1:] - projected.reshape(6,11,2)[:,:-1], axis=2))
        if not np.isfinite(projected).all() or not np.isfinite(spacing) or spacing < 1:
            return self._falhou(result, 'geometria da calibração inválida')
        height, width = image.shape[:2]
        if (np.any(projected[:, 0] < 0) or np.any(projected[:, 0] >= width)
                or np.any(projected[:, 1] < 0) or np.any(projected[:, 1] >= height)):
            return self._falhou(result, 'grade cortada pela imagem; afaste ou centralize a câmera')
        gray = cv.cvtColor(image, cv.COLOR_BGR2GRAY)
        gray = cv.resize(gray, (320, 180), interpolation=cv.INTER_AREA).astype(np.float32)
        if self.last_gray is not None:
            (shift_x, shift_y), response = cv.phaseCorrelate(self.last_gray, gray)
            displacement = np.hypot(shift_x * image.shape[1] / 320,
                                    shift_y * image.shape[0] / 180)
            if (not np.isfinite(response) or not np.isfinite(displacement)
                    or response < .2 or displacement > spacing * .35):
                return self._falhou(result, 'movimento excessivo ou imagem sem rastreamento confiável')
        distances = np.linalg.norm(points[:,None] - projected[None], axis=2)
        pairs = sorted((float(distances[i,j]),i,j) for i,j in enumerate(distances.argmin(1)))
        used, matches = set(), []
        for distance,i,j in pairs:
            if distance < spacing*.22 and j not in used:
                used.add(j); matches.append((i,j))
        if len(matches) < 12 or len({j//11 for _,j in matches}) < 3 or len({j%11 for _,j in matches}) < 4:
            return self._falhou(result, 'poucos sockets distribuídos para rastrear a grade')
        src = np.float32([model[j] for _,j in matches])
        dst = np.float32([points[i] for i,_ in matches])
        cv.setRNGSeed(0)
        if self.marker_active:
            # A free projective fit can swing the hidden top edge by a whole
            # socket when the lower rows dominate. Keep the marker geometry
            # and fit only a small translation/rotation/scale correction.
            predicted = cv.perspectiveTransform(src[None], self.H)[0]
            correction, mask = cv.estimateAffinePartial2D(predicted, dst, method=cv.RANSAC,
                                                          ransacReprojThreshold=spacing*.12)
            H = None if correction is None else np.vstack([correction, [0., 0., 1.]]) @ self.H
        else:
            H, mask = cv.findHomography(src, dst, cv.RANSAC, spacing*.12)
        if H is None or mask is None:
            return self._falhou(result, 'não foi possível ajustar a grade')
        keep = mask.ravel().astype(bool)
        matched_indices = [j for accepted, (_, j) in zip(keep, matches) if accepted]
        if (len({j // 11 for j in matched_indices}) < 3
                or len({j % 11 for j in matched_indices}) < 4):
            return self._falhou(result, 'poucos sockets distribuídos após o ajuste')
        errors = np.linalg.norm(cv.perspectiveTransform(src[None], H)[0]-dst, axis=1)[keep]
        if keep.sum() < 12 or np.median(errors) > spacing*.08 or np.percentile(errors,90) > spacing*.15:
            return self._falhou(result, 'erro alto no ajuste da grade')
        displacement = np.linalg.norm(cv.perspectiveTransform(model[None],H)[0]-projected,axis=1)
        # The printed fixture can shift slightly relative to the sticker
        # centres. Still keep the allowed correction well below half a socket.
        max_shift = .22 if self.marker_active else .18
        if not np.isfinite(displacement).all() or displacement.max() > spacing * max_shift:
            return self._falhou(result, 'deslocamento do ajuste excedeu o limite')
        adjusted = cv.perspectiveTransform(model[None], H)[0]
        if (np.any(adjusted[:, 0] < 0) or np.any(adjusted[:, 0] >= width)
                or np.any(adjusted[:, 1] < 0) or np.any(adjusted[:, 1] >= height)):
            return self._falhou(result, 'grade cortada pela imagem; afaste ou centralize a câmera')
        self.H = H
        self.last_gray = gray
        for accepted,(_,j) in zip(keep,matches):
            seen[j] = accepted
        result.update(H=H, valido=True, inliers=int(keep.sum()), erro=float(np.median(errors)))
        return result


def main():
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('image')
    parser.add_argument('--calibration', required=True)
    parser.add_argument('--select', action='store_true', help='Select TL, TR, BR, BL socket centers')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    image = cv.imread(args.image)
    if image is None:
        parser.error('Cannot read image')
    if args.select:
        if not calibra_interativa(image, args.calibration):
            return
    result = RegistradorParcial(args.calibration).atualiza(image)
    overlay = image.copy()
    if result['valido']:
        projected = cv.perspectiveTransform(cfg.MODELO[:66][None],result['H'])[0]
        for j,point in enumerate(projected):
            x,y = map(int,point)
            color = (0,255,0) if result['furos_vistos'][j] else (0,160,255)
            cv.circle(overlay,(x,y),5,color,1)
            cv.putText(overlay,f'C{j//11}:{j%11}',(x-12,y-9),cv.FONT_HERSHEY_SIMPLEX,.3,color,1)
    if not cv.imwrite(args.output,overlay):
        raise OSError('Cannot save overlay')
    print(json.dumps({k:result[k] for k in ('valido','inliers','erro')}))


if __name__ == '__main__':
    main()
