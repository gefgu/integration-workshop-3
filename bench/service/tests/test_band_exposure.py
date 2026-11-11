"""The exposure switch used to read resistor bands: lower the exposure, collect frames, restore it."""
import numpy as np
import pytest

import bench_service.vision as vision


class FakeCv:
    CAP_PROP_EXPOSURE = 15
    CAP_PROP_AUTO_EXPOSURE = 21
    CAP_PROP_AUTO_WB = 44


class FakeCamera:
    """Frame brightness follows the exposure with a few frames of delay, like a real UVC camera."""

    def __init__(self, exposure=1500.0, delay=2, restores=True):
        self.exposure, self.delay, self.restores = exposure, delay, restores
        self.pending = []
        self.sets = []
        self.shown = exposure

    def set(self, prop, value):
        self.sets.append((prop, value))
        if prop == FakeCv.CAP_PROP_EXPOSURE:
            self.exposure = value
            self.pending = [value] * self.delay
        return True

    def get(self, prop):
        return self.exposure

    def read(self):
        if self.pending:
            self.shown = self.pending.pop(0)
        value = self.shown if self.restores or self.exposure != 1500.0 or self.shown in vision.BAND_EXPOSURES else 1000.0
        return True, np.full((72, 128, 3), value / 15.0, np.float32)


def test_exposure_is_lowered_for_the_frames_and_restored():
    cap = FakeCamera()
    frames, locked = vision.read_bands_frames(FakeCv, cap, 1500.0, 100.0)
    assert len(frames) == len(vision.BAND_EXPOSURES) * vision.BAND_FRAMES
    assert all(float(f.mean()) <= 100.0 * vision.BAND_DARKER for f in frames)
    exposures = [value for prop, value in cap.sets if prop == FakeCv.CAP_PROP_EXPOSURE]
    assert exposures == [*vision.BAND_EXPOSURES, 1500.0]
    assert locked == 1500.0


def test_exposure_that_does_not_take_aborts_the_read_and_still_restores():
    class Stuck(FakeCamera):
        def set(self, prop, value):
            if prop == FakeCv.CAP_PROP_EXPOSURE and value in vision.BAND_EXPOSURES:
                self.sets.append((prop, value))
                return True  # ignored by the camera
            return super().set(prop, value)

    cap = Stuck()
    frames, locked = vision.read_bands_frames(FakeCv, cap, 1500.0, 100.0)
    assert frames == []
    assert cap.exposure == 1500.0 and locked == 1500.0


def test_exposure_that_cannot_be_restored_fails_closed_without_auto_relock():
    class NoRestore(FakeCamera):
        def set(self, prop, value):
            if prop == FakeCv.CAP_PROP_EXPOSURE and value == 1500.0:
                self.sets.append((prop, value))
                return True  # the locked value does not come back
            return super().set(prop, value)

    cap = NoRestore()
    with pytest.raises(vision.ExposureRestoreError):
        vision.read_bands_frames(FakeCv, cap, 1500.0, 100.0)
    assert (FakeCv.CAP_PROP_EXPOSURE, 1500.0) in cap.sets
    assert not any(prop in (FakeCv.CAP_PROP_AUTO_EXPOSURE, FakeCv.CAP_PROP_AUTO_WB) for prop, _ in cap.sets)


def test_settings_and_restore_use_commanded_value_when_readback_is_stale():
    class StaleReadback(FakeCamera):
        def get(self, prop):
            return 1300.0  # stale for every setting, including exposure

    cap = StaleReadback()
    settings = vision.CameraSettings(exposure=1500.0)
    settings.apply(FakeCv, cap)
    frames, locked = vision.read_bands_frames(FakeCv, cap, settings.exposure, 100.0)
    assert len(frames) == len(vision.BAND_EXPOSURES) * vision.BAND_FRAMES
    assert locked == cap.exposure == 1500.0
    assert [value for prop, value in cap.sets if prop == FakeCv.CAP_PROP_EXPOSURE] == [1500.0, 1000, 1100, 1500.0]


def test_unavailable_readback_does_not_change_commanded_settings():
    class NoReadback(FakeCamera):
        def get(self, prop):
            raise OSError('readback unsupported')

    cap = NoReadback()
    settings = vision.CameraSettings(exposure=1500.0)
    settings.apply(FakeCv, cap)
    assert cap.exposure == settings.exposure
