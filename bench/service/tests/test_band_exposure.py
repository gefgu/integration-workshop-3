"""The exposure switch used to read resistor bands: lower the exposure, collect frames, restore it."""
import numpy as np

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
        elif prop == FakeCv.CAP_PROP_AUTO_EXPOSURE and value == vision.V4L2_AUTO_EXPOSURE:
            self.exposure = 1500.0
            self.pending = [1500.0] * self.delay
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


def test_exposure_that_cannot_be_restored_is_relocked_from_auto(monkeypatch):
    class NoRestore(FakeCamera):
        def set(self, prop, value):
            if prop == FakeCv.CAP_PROP_EXPOSURE and value == 1500.0 and not self.relock:
                self.sets.append((prop, value))
                return True  # the locked value does not come back
            return super().set(prop, value)

        relock = False

    cap = NoRestore()
    relocked = []

    def settle(cv, camera, seconds=0):
        cap.relock = True
        relocked.append(True)
    monkeypatch.setattr(vision, 'settle_and_lock', settle)
    frames, locked = vision.read_bands_frames(FakeCv, cap, 1500.0, 100.0)
    assert len(frames) == len(vision.BAND_EXPOSURES) * vision.BAND_FRAMES
    assert relocked == [True]
    assert (FakeCv.CAP_PROP_AUTO_EXPOSURE, vision.V4L2_AUTO_EXPOSURE) in cap.sets
