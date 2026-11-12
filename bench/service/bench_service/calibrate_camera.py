"""Choose a provisional fixed exposure on the physical bench, when available.

This command accesses a camera and must only be run later on the bench. The
other controls come from an explicit base JSON; focus may be null if absent.
"""
from __future__ import annotations

import argparse
import json
from dataclasses import asdict, replace
from pathlib import Path

import cv2 as cv
import numpy as np

from .v4l2_controls import set_power_line_frequency
from .vision import CameraSettings, open_camera
from .camera_device import camera_argument

EXPOSURES = (600, 700, 800, 900, 1000, 1100, 1300)
REQUIRED = ('gain', 'white_balance_temperature', 'brightness', 'contrast', 'saturation',
            'gamma', 'power_line_frequency')


def sweep_exposure(cv_module, cap, exposures=EXPOSURES, target=100.0, settle_frames=4):
    """Choose nearest central-frame luminance; ties choose the lower exposure."""
    if settle_frames < 1 or not np.isfinite(target) or not 0 <= target <= 255:
        raise ValueError('invalid exposure sweep configuration')
    samples = []
    for exposure in sorted(set(exposures)):
        if exposure <= 0:
            raise ValueError('exposures must be positive')
        if not cap.set(cv_module.CAP_PROP_EXPOSURE, exposure):
            raise RuntimeError(f'camera rejected exposure {exposure}')
        frame = None
        for _ in range(settle_frames):
            ok, frame = cap.read()
            if not ok or frame is None:
                raise RuntimeError(f'camera failed during exposure {exposure}')
        height, width = frame.shape[:2]
        center = frame[int(height * .2):int(height * .8), int(width * .2):int(width * .8)]
        if not center.size:
            raise RuntimeError('camera returned an empty frame')
        gray = cv_module.cvtColor(center, cv_module.COLOR_BGR2GRAY)
        samples.append({'exposure': exposure, 'mean': float(np.mean(gray))})
    if not samples:
        raise ValueError('exposure sweep must contain at least one setting')
    selected = min(samples, key=lambda item: (abs(item['mean'] - target), item['exposure']))
    if not cap.set(cv_module.CAP_PROP_EXPOSURE, selected['exposure']):
        raise RuntimeError('camera rejected selected exposure')
    return selected['exposure'], samples


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--camera', type=camera_argument, required=True)
    parser.add_argument('--base-settings', required=True, type=Path,
                        help='JSON with gain, white balance, brightness, contrast, saturation, gamma and power line')
    parser.add_argument('--output', required=True, type=Path, help='new JSON file; never overwrites an existing file')
    parser.add_argument('--target', type=float, default=100.0, help='target mean center-frame luminance (0–255)')
    args = parser.parse_args()
    if not 0 <= args.target <= 255:
        parser.error('--target must be between 0 and 255')
    settings = CameraSettings.from_file(args.base_settings)
    missing = [name for name in REQUIRED if getattr(settings, name) is None]
    if missing:
        parser.error('base settings missing explicit controls: ' + ', '.join(missing))
    cap = open_camera(cv, args.camera)
    if not cap.isOpened():
        raise RuntimeError('could not open camera')
    try:
        settings.apply(cv, cap, lambda value: set_power_line_frequency(args.camera, value))
        exposure, samples = sweep_exposure(cv, cap, target=args.target)
        chosen = replace(settings, exposure=exposure)
        with args.output.open('x', encoding='utf-8') as output:
            json.dump(asdict(chosen), output, sort_keys=True, indent=2)
            output.write('\n')
        print(json.dumps({'chosen_exposure': exposure, 'samples': samples}, sort_keys=True))
    finally:
        cap.release()


if __name__ == '__main__':
    main()
