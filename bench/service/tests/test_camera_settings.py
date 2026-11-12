"""Camera-control setup and calibration are exercised only with fakes."""
import json
import struct

import cv2 as cv
import numpy as np
import pytest

from bench_service.calibrate_camera import sweep_exposure
from bench_service.vision import CameraSettings
from bench_service import v4l2_controls

BASE_VALUES = {'exposure': 1100, 'gain': 2, 'white_balance_temperature': 4500,
               'brightness': 100, 'contrast': 20, 'saturation': 30, 'gamma': 90,
               'power_line_frequency': 2, 'focus': 15}


class FakeCamera:
    def __init__(self):
        self.controls = []
        self.exposure = 0

    def set(self, prop, value):
        self.controls.append((prop, value))
        if prop == cv.CAP_PROP_EXPOSURE:
            self.exposure = value
        return True

    def get(self, prop):
        return -999  # intentionally stale

    def read(self):
        return True, np.full((30, 40, 3), int(self.exposure / 10), np.uint8)


def test_explicit_controls_are_loaded_and_commanded_even_with_stale_readback(tmp_path):
    config = tmp_path / 'settings.json'
    config.write_text(json.dumps(BASE_VALUES))
    settings = CameraSettings.from_file(config)
    fake = FakeCamera()
    power = []
    settings.apply(cv, fake, lambda value: power.append(value) or -999)
    assert fake.controls == [(cv.CAP_PROP_AUTO_WB, 0), (cv.CAP_PROP_AUTO_EXPOSURE, 1),
                             (cv.CAP_PROP_EXPOSURE, 1100), (cv.CAP_PROP_GAIN, 2),
                             (cv.CAP_PROP_WB_TEMPERATURE, 4500), (cv.CAP_PROP_BRIGHTNESS, 100),
                             (cv.CAP_PROP_CONTRAST, 20), (cv.CAP_PROP_SATURATION, 30),
                             (cv.CAP_PROP_GAMMA, 90), (cv.CAP_PROP_AUTOFOCUS, 0), (cv.CAP_PROP_FOCUS, 15)]
    assert power == [2] and settings.exposure == 1100


@pytest.mark.parametrize('values', [{'exposure': 0}, {'exposure': None}, {'exposure': '1000'},
                                    {'power_line_frequency': 4}, {'unexpected': 1}, []])
def test_invalid_settings_are_rejected(tmp_path, values):
    config = tmp_path / 'settings.json'
    config.write_text(json.dumps({**BASE_VALUES, **values} if isinstance(values, dict) else values))
    with pytest.raises(ValueError):
        CameraSettings.from_file(config)


def test_incomplete_settings_file_is_rejected(tmp_path):
    config = tmp_path / 'settings.json'
    config.write_text('{"exposure": 1300}')
    with pytest.raises(ValueError, match='missing explicit controls'):
        CameraSettings.from_file(config)


def test_calibration_sweep_is_deterministic_and_selects_lower_exposure_on_tie():
    fake = FakeCamera()
    chosen, samples = sweep_exposure(cv, fake, exposures=(1000, 900, 1000), target=95, settle_frames=2)
    assert chosen == fake.exposure == 900
    assert samples == [{'exposure': 900, 'mean': 90.0}, {'exposure': 1000, 'mean': 100.0}]


def test_calibration_sweep_rejects_empty_or_invalid_inputs():
    fake = FakeCamera()
    for kwargs in ({'exposures': ()}, {'exposures': (-1,)}, {'settle_frames': 0}, {'target': float('nan')}):
        with pytest.raises(ValueError):
            sweep_exposure(cv, fake, **kwargs)


def test_power_line_control_uses_v4l2_ioctl_without_opening_a_device(monkeypatch):
    calls = []
    monkeypatch.setattr(v4l2_controls.os, 'open', lambda path, flags: calls.append(path) or 42)
    monkeypatch.setattr(v4l2_controls.os, 'close', lambda fd: calls.append(('close', fd)))

    def ioctl(fd, request, data, mutate):
        calls.append((fd, request, struct.unpack('=Ii', data)))
        if request == v4l2_controls.VIDIOC_G_CTRL:
            data[:] = struct.pack('=Ii', v4l2_controls.V4L2_CID_POWER_LINE_FREQUENCY, 1)

    monkeypatch.setattr(v4l2_controls.fcntl, 'ioctl', ioctl)
    assert v4l2_controls.set_power_line_frequency(3, 2) == 1
    assert calls[0] == '/dev/video3'
    assert calls[1] == (42, v4l2_controls.VIDIOC_S_CTRL, (v4l2_controls.V4L2_CID_POWER_LINE_FREQUENCY, 2))
    assert calls[-1] == ('close', 42)


class NoAutoWhiteBalance(FakeCamera):
    """The bench's USB camera: no auto white-balance switch (readback -1, set refused)."""

    def set(self, prop, value):
        if prop == cv.CAP_PROP_AUTO_WB:
            return False
        return super().set(prop, value)

    def get(self, prop):
        return -1.0 if prop == cv.CAP_PROP_AUTO_WB else -999


def test_missing_auto_white_balance_switch_does_not_stop_the_explicit_controls():
    fake = NoAutoWhiteBalance()
    CameraSettings(exposure=1300, white_balance_temperature=4500).apply(cv, fake)
    assert (cv.CAP_PROP_EXPOSURE, 1300) in fake.controls
    assert (cv.CAP_PROP_WB_TEMPERATURE, 4500) in fake.controls


def test_other_refused_controls_and_a_supported_refused_switch_still_fail_closed():
    class RefusesExposure(FakeCamera):
        def set(self, prop, value):
            return False if prop == cv.CAP_PROP_EXPOSURE else super().set(prop, value)

    with pytest.raises(RuntimeError, match='rejected'):
        CameraSettings(exposure=1300).apply(cv, RefusesExposure())

    class RefusesSupportedSwitch(FakeCamera):
        def set(self, prop, value):
            return False if prop == cv.CAP_PROP_AUTO_WB else super().set(prop, value)

        def get(self, prop):
            return 1.0  # the switch exists and reads a real value

    with pytest.raises(RuntimeError, match='rejected'):
        CameraSettings(exposure=1300).apply(cv, RefusesSupportedSwitch())
