"""Recording tests use only saved JPEGs and a fake capture."""
import json
from pathlib import Path

import cv2 as cv
import numpy as np
import pytest

from bench_service.recorder import RecordingCamera
from bench_service.replay import ReplayCamera

PHOTO = (Path(__file__).resolve().parents[3]
         / 'visao/fixtures/current/bench-2026-11-11/normal-1.jpg')


class FakeCapture:
    def __init__(self, packet, raw_supported=True):
        self.packet = packet
        self.raw_supported = raw_supported
        self.sets = []
        self.released = False

    def set(self, prop, value):
        self.sets.append((prop, value))
        return self.raw_supported if prop == cv.CAP_PROP_CONVERT_RGB else True

    def get(self, prop):
        return 9999  # intentionally stale; metadata must report commanded settings

    def isOpened(self):
        return True

    def read(self):
        return True, self.packet

    def release(self):
        self.released = True


def test_original_jpeg_bytes_and_per_frame_commands_are_recorded(tmp_path):
    original = PHOTO.read_bytes()
    fake = FakeCapture(np.frombuffer(original, dtype=np.uint8).reshape(1, -1))
    camera = RecordingCamera(cv, fake, tmp_path, clock=lambda: 123.0)
    camera.set(cv.CAP_PROP_EXPOSURE, 1000)
    camera.note_control('power_line_frequency', 2)
    ok, first = camera.read()
    camera.set(cv.CAP_PROP_EXPOSURE, 1600)
    camera.read()
    camera.release()
    assert ok and first.shape == (1080, 1920, 3)
    assert (tmp_path / 'frame-00000000.jpg').read_bytes() == original
    assert (tmp_path / 'frame-00000001.jpg').read_bytes() == original
    records = [json.loads(line) for line in (tmp_path / 'frames.jsonl').read_text().splitlines()]
    assert [r['index'] for r in records] == [0, 1]
    assert [r['commanded_exposure'] for r in records] == [1000, 1600]
    assert records[0]['commanded_controls']['exposure'] == 1000
    assert records[0]['commanded_controls']['power_line_frequency'] == 2
    assert all(r['timestamp'] == 123.0 and r['format'] == 'MJPEG' for r in records)
    assert fake.released


def test_decoded_pixels_are_not_misrepresented_as_original_bytes(tmp_path):
    fake = FakeCapture(cv.imread(str(PHOTO)))
    camera = RecordingCamera(cv, fake, tmp_path)
    with pytest.raises(RuntimeError, match='original MJPEG'):
        camera.read()
    camera.release()
    assert (tmp_path / 'frames.jsonl').read_text() == ''
    assert not list(tmp_path.glob('*.jpg'))


def test_unsupported_raw_capture_is_rejected(tmp_path):
    fake = FakeCapture(None, raw_supported=False)
    with pytest.raises(RuntimeError, match='rejected raw MJPEG'):
        RecordingCamera(cv, fake, tmp_path)


def test_existing_recording_is_not_overwritten(tmp_path):
    (tmp_path / 'frames.jsonl').write_text('existing\n')
    with pytest.raises(FileExistsError):
        RecordingCamera(cv, FakeCapture(None), tmp_path)
    assert (tmp_path / 'frames.jsonl').read_text() == 'existing\n'


def test_recording_can_be_used_as_an_exposure_aware_replay(tmp_path):
    fake = FakeCapture(np.frombuffer(PHOTO.read_bytes(), dtype=np.uint8).reshape(1, -1))
    camera = RecordingCamera(cv, fake, tmp_path, clock=lambda: 123.0)
    for exposure in (1600, 1000):
        camera.set(cv.CAP_PROP_EXPOSURE, exposure)
        camera.read()
    camera.release()
    replay = ReplayCamera(tmp_path, 1280, 720, seed=0, perturb=False)
    replay.read()
    assert replay.read_log[-1]['picture'] == 'frame-00000000.jpg'
    replay.set(cv.CAP_PROP_EXPOSURE, 1000)
    replay.read()
    assert replay.read_log[-1]['picture'] == 'frame-00000001.jpg'
    assert not replay.read_log[-1]['synthetic_exposure']
    replay.set(cv.CAP_PROP_EXPOSURE, 1100)
    replay.read()
    assert replay.read_log[-1]['synthetic_exposure']


def test_service_records_raw_fake_camera_frames(tmp_path, monkeypatch):
    import bench_service.vision as vision
    vision._import_visao('current', None)  # make the repository vision package importable
    from visao import debug
    from visao.circuito import para_dict
    from visao.pipeline_atual import PipelineAtual

    original = PHOTO.read_bytes()
    source = vision.VisionSource(camera=0, record=str(tmp_path))

    class TwoFrames(FakeCapture):
        reads = 0

        def read(self):
            self.reads += 1
            if self.reads == 2:
                source.stop()
            return super().read()

    class PipelineWithoutBandSwitch(PipelineAtual):
        def precisa_bandas(self):
            return False

    fake = TwoFrames(np.frombuffer(original, dtype=np.uint8).reshape(1, -1))
    monkeypatch.setattr(cv, 'VideoCapture', lambda *args: pytest.fail('opened a real camera'))
    monkeypatch.setattr(vision, 'open_camera', lambda *args: fake)
    monkeypatch.setattr(vision, '_import_visao', lambda *args: (PipelineWithoutBandSwitch, para_dict, debug))
    source._run()
    assert fake.released
    assert len((tmp_path / 'frames.jsonl').read_text().splitlines()) == 2
    assert (tmp_path / 'frame-00000000.jpg').read_bytes() == original
    assert (tmp_path / 'frame-00000001.jpg').read_bytes() == original
