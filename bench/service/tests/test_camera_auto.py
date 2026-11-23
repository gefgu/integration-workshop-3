from pathlib import Path

import bench_service.vision as vision
from bench_service.camera_device import find_cameras, service_camera
from bench_service.vision import VisionSource


def fake_sysfs(tmp_path, nodes):
    """nodes: {number: (is_usb, index)}; also a by-id link for video2."""
    sys_root, dev = tmp_path / 'sys', tmp_path / 'dev'
    (dev / 'v4l/by-id').mkdir(parents=True)
    for number, (usb, index) in nodes.items():
        entry = sys_root / f'video{number}'
        entry.mkdir(parents=True)
        (entry / 'index').write_text(f'{index}\n')
        parent = tmp_path / ('usb1/1-1' if usb else 'platform/codec') / f'dev{number}'
        parent.mkdir(parents=True)
        (entry / 'device').symlink_to(parent)
        (dev / f'video{number}').touch()
    (dev / 'v4l/by-id/usb-cam-video-index0').symlink_to(dev / 'video2')
    return sys_root, dev


def test_search_skips_codec_and_metadata_nodes_and_pins_by_id(tmp_path):
    sys_root, dev = fake_sysfs(tmp_path, {0: (False, 0), 1: (False, 0), 2: (True, 0), 3: (True, 1)})
    assert find_cameras(sys_root, dev) == [str(dev / 'v4l/by-id/usb-cam-video-index0')]


def test_search_without_sysfs_means_probe_camera_zero(tmp_path):
    assert find_cameras(tmp_path / 'missing', tmp_path) is None
    assert find_cameras(tmp_path, tmp_path) == []


def test_legacy_zero_means_auto():
    assert service_camera('0') == 'auto' and service_camera('auto') == 'auto'
    assert service_camera('2') == 2 and service_camera('/dev/v4l/by-id/x') == '/dev/v4l/by-id/x'


class Cap:
    def __init__(self, opens, delivers):
        self.opens, self.delivers = opens, delivers
    def isOpened(self): return self.opens
    def read(self): return (self.delivers, object() if self.delivers else None)
    def release(self): pass


def test_auto_takes_first_node_that_delivers_a_picture(monkeypatch):
    monkeypatch.setattr('bench_service.camera_device.find_cameras', lambda: ['/dev/video0', '/dev/video2'])
    caps = {'/dev/video0': Cap(True, False), '/dev/video2': Cap(True, True)}
    monkeypatch.setattr(vision, 'open_camera', lambda cv, device: caps[device])
    source = VisionSource(camera='auto')
    monkeypatch.setattr(source._stop, 'wait', lambda timeout=None: False)
    cap, problem = source._open_auto(None)
    assert cap is caps['/dev/video2'] and problem is None and source._device == '/dev/video2'
    # the next search starts with the last good camera
    monkeypatch.setattr('bench_service.camera_device.find_cameras', lambda: ['/dev/video0', '/dev/video2'])
    opened = []
    monkeypatch.setattr(vision, 'open_camera', lambda cv, device: opened.append(device) or caps[device])
    source._open_auto(None)
    assert opened == ['/dev/video2']


def test_auto_keeps_searching_and_says_why(monkeypatch):
    source = VisionSource(camera='auto')
    monkeypatch.setattr('bench_service.camera_device.find_cameras', lambda: [])
    runs = []

    def run_once():
        runs.append(1)
        source._retry_camera = True
        source._set(available=False, reason='Nenhuma câmera USB encontrada.')
        if len(runs) == 4:
            source._stop.set()

    monkeypatch.setattr(source, '_run_once', run_once)
    monkeypatch.setattr(source._stop, 'wait', lambda timeout=None: source._stop.is_set())
    source._run()
    state = source.state()
    assert len(runs) == 4 and state['searching'] and state['attempts'] == 3
