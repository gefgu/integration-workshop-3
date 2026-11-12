"""Pin a selected Linux camera to a persistent udev link, without opening it."""
from pathlib import Path


def camera_argument(value):
    return int(value) if str(value).isdigit() else str(value)


def persistent_camera(camera, device_root=Path('/dev')):
    camera = camera_argument(camera)
    root = Path(device_root)
    if isinstance(camera, str):
        path = Path(camera)
        if path.parent == root and path.name.startswith('video') and path.name[5:].isdigit():
            camera = int(path.name[5:])
    if not isinstance(camera, int):
        return camera
    node = root / f'video{camera}'
    # Prefer identity over USB port. Never select a different available camera.
    for directory in ('by-id', 'by-path'):
        for link in sorted((root / 'v4l' / directory).glob('*')):
            if link.is_symlink() and link.resolve() == node.resolve():
                return str(link)
    return camera


def has_persistent_identity(camera):
    path = Path(str(camera))
    return path.parent.name in ('by-id', 'by-path') and path.parent.parent.name == 'v4l'
