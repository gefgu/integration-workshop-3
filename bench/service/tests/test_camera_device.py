from pathlib import Path

import cv2 as cv
import pytest

from bench_service.camera_device import camera_argument, persistent_camera
from bench_service.replay import ReplayCamera
from bench_service.vision import VisionSource
import bench_service.vision as vision


def test_numeric_camera_is_pinned_even_when_device_number_changes(tmp_path):
    directory = tmp_path / 'v4l/by-id'
    directory.mkdir(parents=True)
    old = tmp_path / 'video2'
    old.touch()
    link = directory / 'usb-chosen-video-index0'
    link.symlink_to(old)
    other = directory / 'usb-other-video-index0'
    other.symlink_to(tmp_path / 'video0')
    pinned = persistent_camera(2, tmp_path)
    assert pinned == str(link)
    old.unlink()
    link.unlink()
    link.symlink_to(tmp_path / 'video7')
    assert persistent_camera(pinned, tmp_path) == pinned
    assert persistent_camera(0, tmp_path) == str(other)
    assert camera_argument('3') == 3


@pytest.mark.parametrize('first_failure', ['missing', 'read'])
@pytest.mark.parametrize('recording', [False, True])
def test_reconnects_same_path_reapplies_settings_and_clears_stale_state(monkeypatch, first_failure, recording, tmp_path):
    folder = Path(__file__).resolve().parents[3] / 'visao/fixtures/current/bench-2026-11-11'
    target = '/dev/v4l/by-id/usb-chosen-video-index0'
    source = VisionSource(camera=target, record=str(tmp_path / 'recording') if recording else None)
    source._state.update(valid=True, pieces=[{'id': 'old'}])
    source._jpeg = b'old frame'
    opened, commands, released, pipelines = [], [[], []], [], []
    real_import = vision._import_visao
    directories = []
    class RecordingProxy:
        def __init__(self, cv_module, camera, directory):
            self.camera = camera
            directories.append(directory)
        def __getattr__(self, name):
            return getattr(self.camera, name)
    monkeypatch.setattr('bench_service.recorder.RecordingCamera', RecordingProxy)

    def imports(*args):
        factory, para_dict, debug = real_import(*args)
        def make():
            result = factory()
            pipelines.append(result)
            return result
        return make, para_dict, debug

    def opening(cv_module, device):
        index = len(opened)
        opened.append(device)
        if index:
            assert source._state['pieces'] == []
            assert source._jpeg is None
        cap = ReplayCamera(folder, 1280, 720, seed=0, perturb=False)
        set_prop = cap.set
        def command(prop, value):
            commands[index].append((prop, value))
            return set_prop(prop, value)
        cap.set = command
        cap.release = lambda: released.append(index)
        if not index:
            cap.isOpened = lambda: first_failure != 'missing'
            cap.read = lambda: (False, None)
        return cap

    class PublicationState(dict):
        def update(self, *args, **kwargs):
            super().update(*args, **kwargs)
            if self.get('updated_at') is not None:
                source._stop.set()
    source._state = PublicationState(source._state)
    monkeypatch.setattr(vision, 'open_camera', opening)
    monkeypatch.setattr(vision, '_import_visao', imports)
    source._run()
    assert opened == [target, target]
    assert released == [0, 1]
    assert source._state['valid'] is True
    assert source._state['available'] is True
    assert (cv.CAP_PROP_EXPOSURE, vision.DEFAULT_EXPOSURE) in commands[1]
    if first_failure == 'read':
        assert commands[0] == commands[1]
        assert len(pipelines) == 2 and pipelines[0] is not pipelines[1]
    if recording:
        expected = [tmp_path / 'recording']
        if first_failure == 'read': expected.append(tmp_path / 'recording/reconnect-0001')
        assert directories == expected


def test_no_automatic_fallback_to_an_unidentified_camera_index(monkeypatch):
    source = VisionSource(camera=19)
    monkeypatch.setattr('bench_service.camera_device.persistent_camera', lambda camera: camera)
    def failed_session():
        source._retry_camera = True
    monkeypatch.setattr(source, '_run_once', failed_session)
    source._run()
    assert 'persistente' in source.state()['reason']
