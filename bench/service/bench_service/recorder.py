"""Opt-in original-MJPEG recording for later bench and Pi verification."""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import numpy as np


class RecordingCamera:
    """Wrap a capture, recording every read including temporary exposure frames.

    OpenCV normally returns decoded pixels. CONVERT_RGB=0 requests the original
    compressed capture packet (verified on the bench USB camera with OpenCV 5.0; FORMAT=-1 is
    refused there); a backend that ignores it is rejected instead
    of silently writing recompressed pictures as if they were originals.
    """

    def __init__(self, cv: Any, camera: Any, directory: str | Path, clock=time.time):
        self.cv, self.camera, self.clock = cv, camera, clock
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.manifest = (self.directory / 'frames.jsonl').open('x', encoding='utf-8')
        self.index = 0
        self.commands: dict[str, float] = {}
        self.property_names = {getattr(cv, attr): name for attr, name in (
            ('CAP_PROP_EXPOSURE', 'exposure'), ('CAP_PROP_AUTO_EXPOSURE', 'auto_exposure'),
            ('CAP_PROP_AUTO_WB', 'auto_white_balance'), ('CAP_PROP_WB_TEMPERATURE', 'white_balance_temperature'),
            ('CAP_PROP_GAIN', 'gain'), ('CAP_PROP_BRIGHTNESS', 'brightness'),
            ('CAP_PROP_CONTRAST', 'contrast'), ('CAP_PROP_SATURATION', 'saturation'),
            ('CAP_PROP_GAMMA', 'gamma'), ('CAP_PROP_AUTOFOCUS', 'auto_focus'),
            ('CAP_PROP_FOCUS', 'focus')) if hasattr(cv, attr)}
        if not camera.set(cv.CAP_PROP_CONVERT_RGB, 0):
            self.manifest.close()
            raise RuntimeError('camera backend rejected raw MJPEG capture')

    def isOpened(self):
        return self.camera.isOpened()

    def set(self, prop, value):
        accepted = self.camera.set(prop, value)
        if accepted:
            self.commands[self.property_names.get(prop, str(prop))] = float(value)
        return accepted

    def get(self, prop):
        return self.camera.get(prop)

    def note_control(self, name, value):
        """Record a successful control command issued outside OpenCV."""
        self.commands[name] = float(value)

    def read(self):
        ok, packet = self.camera.read()
        if not ok:
            return False, None
        data = np.asarray(packet, dtype=np.uint8).reshape(-1)
        if data.size < 4 or data[:2].tobytes() != b'\xff\xd8' or data[-2:].tobytes() != b'\xff\xd9':
            raise RuntimeError('camera did not return an original MJPEG frame')
        frame = self.cv.imdecode(data, self.cv.IMREAD_COLOR)
        if frame is None:
            raise RuntimeError('camera returned an invalid JPEG frame')
        filename = f'frame-{self.index:08d}.jpg'
        with (self.directory / filename).open('xb') as output:
            output.write(data.tobytes())
        metadata = {'index': self.index, 'file': filename, 'timestamp': self.clock(),
                    'format': 'MJPEG', 'size': list(frame.shape[1::-1]),
                    'commanded_exposure': self.commands.get('exposure'),
                    'commanded_controls': dict(sorted(self.commands.items()))}
        self.manifest.write(json.dumps(metadata, sort_keys=True, separators=(',', ':')) + '\n')
        self.manifest.flush()
        self.index += 1
        return True, frame

    def release(self):
        try:
            self.manifest.close()
        finally:
            self.camera.release()
