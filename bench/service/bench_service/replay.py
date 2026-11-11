"""Replay saved bench pictures through VisionSource without accessing a camera.

Example, from the repository root::

    PYTHONPATH=bench/service .venv/bin/python -m bench_service.replay \
        visao/fixtures/current/bench-2026-11-11 --frames 35 --warmup 5

Only the exposure series in that directory are real. Perturbations and any
brightness-scaled substitute exposure are synthetic, and are labelled as such.
"""
from __future__ import annotations

import argparse
import copy
import json
import re
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import cv2 as cv
import numpy as np

from bench_service import vision


class FakeClock:
    def __init__(self):
        self.now = 0.0

    def monotonic(self):
        return self.now

    def time(self):
        return 1_700_000_000.0 + self.now

    def sleep(self, seconds):
        self.now += max(0.0, seconds)


class ReplayCamera:
    """V4L2-shaped picture source; never opens a device."""

    def __init__(self, directory: Path, width: int, height: int, seed: int,
                 series: str = 'a', perturb: bool = True, normal_exposure: int = 1300):
        self.directory = Path(directory)
        self.width, self.height, self.seed = width, height, seed
        self.perturb, self.normal_exposure = perturb, normal_exposure
        self.exposure = normal_exposure
        self.read_count = 0
        self.normal_count = 0
        self.read_log = []
        self.exposures: dict[int, list[Path]] = {}
        manifest = self.directory / 'frames.jsonl'
        if manifest.exists():
            for line in manifest.read_text(encoding='utf-8').splitlines():
                entry = json.loads(line)
                exposure = entry.get('commanded_exposure')
                if exposure is not None:
                    self.exposures.setdefault(int(exposure), []).append(self.directory / entry['file'])
            self.normal = self.exposures.get(normal_exposure, [])
        else:
            self.normal = sorted(self.directory.glob('normal-*.jpg'))
            for path in sorted(self.directory.glob(f'bands-{series}-exp*.jpg')):
                match = re.search(r'exp(\d+)\.jpg$', path.name)
                if match:
                    self.exposures.setdefault(int(match.group(1)), []).append(path)
        if not self.normal:
            raise ValueError(f'no normal frames for exposure {normal_exposure} in {directory}')
        if not self.exposures:
            raise ValueError(f'no exposure series {series!r} in {directory}')
        self.exposure_counts: dict[int, int] = {}
        self._images = {}

    def isOpened(self):
        return True

    def set(self, prop, value):
        if prop == cv.CAP_PROP_EXPOSURE:
            self.exposure = float(value)
        return True

    def get(self, prop):
        return self.exposure if prop == cv.CAP_PROP_EXPOSURE else 0.0

    def release(self):
        pass

    def read(self):
        requested = self.exposure
        if requested == self.normal_exposure:
            path = self.normal[self.normal_count % len(self.normal)]
            self.normal_count += 1
            actual, synthetic_exposure = None, False
        else:
            actual = min(self.exposures, key=lambda x: (abs(x - requested), x))
            paths = self.exposures[actual]
            count = self.exposure_counts.get(actual, 0)
            path = paths[count % len(paths)]
            self.exposure_counts[actual] = count + 1
            synthetic_exposure = actual != requested
        if path not in self._images:
            image = cv.imread(str(path))
            if image is None:
                raise ValueError(f'could not read {path}')
            self._images[path] = cv.resize(image, (self.width, self.height), interpolation=cv.INTER_AREA)
        image = self._images[path].copy()
        if synthetic_exposure:
            image = np.clip(image.astype(np.float32) * (requested / actual), 0, 255).astype(np.uint8)
        index = self.read_count
        self.read_count += 1
        if self.perturb:
            rng = np.random.default_rng(np.random.SeedSequence([self.seed, index]))
            brightness = rng.uniform(.88, 1.12)
            angle = rng.uniform(-.25, .25)
            matrix = cv.getRotationMatrix2D((self.width / 2, self.height / 2), angle, 1.0)
            matrix[:, 2] += rng.uniform(-.001, .001, 2) * [self.width, self.height]
            image = cv.warpAffine(image, matrix, (self.width, self.height), borderMode=cv.BORDER_REPLICATE)
            image = np.clip(image.astype(np.float32) * brightness, 0, 255).astype(np.uint8)
            if index % 3 == 0:
                image = cv.GaussianBlur(image, (3, 3), .45)
            noise = rng.normal(0, 1.0, image.shape).astype(np.float32)
            image = np.clip(image.astype(np.float32) + noise, 0, 255).astype(np.uint8)
            quality = int(rng.integers(85, 96))
        else:
            quality = 90
        ok, jpeg = cv.imencode('.jpg', image, [cv.IMWRITE_JPEG_QUALITY, quality])
        if not ok:
            raise RuntimeError('JPEG recompression failed')
        image = cv.imdecode(jpeg, cv.IMREAD_COLOR)
        self.read_log.append({'picture': path.name, 'requested_exposure': requested,
                              'source_exposure': actual, 'synthetic_exposure': synthetic_exposure,
                              'normal_exposure_assumed': actual is None,
                              'synthetic_perturbation': self.perturb})
        return True, image


class CapturedState(dict):
    """Observe complete publication updates, including unchanged piece lists."""

    def __init__(self, initial, source, frames):
        super().__init__(initial)
        self.source, self.frames, self.published = source, frames, []

    def update(self, *args, **kwargs):
        changes = dict(*args, **kwargs)
        super().update(changes)
        if 'updated_at' in changes:
            self.published.append(copy.deepcopy(dict(self)))
            if len(self.published) >= self.frames:
                self.source.stop()


def replay(directory, frames=35, width=1280, height=720, seed=0, series='a', perturb=True):
    """Run the actual service loop synchronously, with a fake camera and clock."""
    # Use the service's normal import path setup when invoked from bench/service.
    _, para_dict, debug = vision._import_visao('current', None)
    from visao.pipeline_atual import PipelineAtual

    cv.setRNGSeed(seed)
    cv.setNumThreads(1)
    clock = FakeClock()
    camera = ReplayCamera(Path(directory), width, height, seed, series, perturb)
    source = vision.VisionSource(camera=0)
    state = CapturedState(source._state, source, frames)
    source._state = state
    fake_time = SimpleNamespace(monotonic=clock.monotonic, time=clock.time, sleep=clock.sleep)
    make_pipeline = lambda: PipelineAtual(clock=clock.monotonic)
    with patch.object(vision, 'time', fake_time), patch.object(vision, 'open_camera', return_value=camera), \
            patch.object(vision, '_import_visao', return_value=(make_pipeline, para_dict, debug)):
        source._run()
    return {'frames': state.published, 'reads': camera.read_log}


def _location(piece, editor_coordinates):
    offset = 1 if editor_coordinates else 0
    return piece['row'], piece['a'] - offset, piece['b'] - offset


def score(frames, expected, warmup=0):
    """Report wrong values separately from unknown bodies and other mismatches."""
    expected_pieces = expected['pieces']
    expected_by_location = {_location(p, False): p for p in expected_pieces}
    reports = []
    streak = longest = wrong_values = unknowns = unknown_bodies = 0
    resistor_types = {'resistor_220', 'resistor_470', 'resistor_1k'}
    for index, frame in enumerate(frames):
        seen = {}
        for piece in frame['pieces'] + frame['unknown']:
            seen.setdefault(_location(piece, True), []).append(piece['type'])
        errors = []
        if not frame['valid']:
            errors.append({'kind': 'invalid_frame', 'reason': frame['reason']})
        for location, wanted in expected_by_location.items():
            types = seen.pop(location, [])
            unknown_bodies += types.count('peca_sem_tipo')
            wanted_type = wanted['type']
            accepted = {wanted_type}
            if wanted.get('allow_unknown_body'):
                accepted.add('peca_sem_tipo')
            if not any(kind in accepted for kind in types):
                if wanted_type in resistor_types and any(t in resistor_types for t in types):
                    kind = 'wrong_value'
                    wrong_values += 1
                elif 'peca_sem_tipo' in types:
                    kind = 'unknown'
                    unknowns += wanted_type in resistor_types
                else:
                    kind = 'missing_or_wrong_type'
                errors.append({'kind': kind, 'position': location, 'expected': wanted_type, 'actual': types})
            elif len(types) > 1:
                errors.append({'kind': 'duplicate', 'position': location, 'actual': types})
        for location, types in sorted(seen.items()):
            errors.append({'kind': 'extra', 'position': location, 'actual': types})
        if index >= warmup:
            streak = streak + 1 if not errors else 0
            longest = max(longest, streak)
        reports.append({'frame': index, 'errors': errors})
    return {'frames': reports, 'longest_correct_streak': longest,
            'wrong_values': wrong_values, 'unknown_resistor_values': unknowns,
            'unknown_bodies': unknown_bodies}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('--frames', type=int, default=35)
    parser.add_argument('--warmup', type=int, default=5)
    parser.add_argument('--width', type=int, default=1280)
    parser.add_argument('--height', type=int, default=720)
    parser.add_argument('--seed', type=int, default=0)
    parser.add_argument('--series', choices=('a', 'b'), default='a')
    parser.add_argument('--no-perturb', action='store_true')
    args = parser.parse_args()
    if args.frames < 1 or not 0 <= args.warmup < args.frames:
        parser.error('frames must be positive and warmup must be less than frames')
    expected = json.loads((args.directory / 'expected.json').read_text())
    result = replay(args.directory, args.frames, args.width, args.height, args.seed, args.series, not args.no_perturb)
    print(json.dumps({'score': score(result['frames'], expected, args.warmup), **result},
                     ensure_ascii=False, sort_keys=True, separators=(',', ':')))


if __name__ == '__main__':
    main()
