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


AUTO = 'auto'


def service_camera(value):
    """What the service is told on the command line. `0` is what older installs pass: it means "the camera", so it
    is searched for (a numbered node is a poor identity on a Pi: the Pi's own codec nodes and the camera's
    metadata node take numbers too, and numbers move when the cable does)."""
    camera = camera_argument(value)
    return AUTO if camera in (0, AUTO) or str(camera).strip() == '' else camera


def find_cameras(sys_root=Path('/sys/class/video4linux'), device_root=Path('/dev')):
    """USB camera capture nodes, each as a persistent /dev/v4l/by-id (or by-path) link when one exists.

    Looked up in sysfs, without opening anything. A USB camera also exposes a metadata node (index 1) that
    opens but never gives a picture, and the Pi has codec nodes that are not USB; both are left out.
    Returns None when the system has no sysfs list (not Linux): the caller then probes camera 0 as before."""
    root = Path(sys_root)
    if not root.is_dir():
        return None
    nodes = []
    for entry in root.glob('video*'):
        if not entry.name[5:].isdigit():
            continue
        try:
            usb = '/usb' in str((entry / 'device').resolve())
            index = (entry / 'index').read_text().strip() if (entry / 'index').exists() else '0'
        except OSError:
            continue
        if usb and index == '0':
            nodes.append(int(entry.name[5:]))
    found = []
    for number in sorted(nodes):
        pinned = persistent_camera(number, device_root)
        found.append(str(Path(device_root) / f'video{number}') if isinstance(pinned, int) else pinned)
    return found


def access_problem(device):
    """Why an existing device cannot be opened, in pt-BR (None when it looks fine or is not a file path)."""
    import os
    path = Path(str(device))
    if not path.exists():
        return None
    if not os.access(path, os.R_OK | os.W_OK):
        return 'sem permissão para abrir a câmera (o usuário do serviço precisa estar no grupo video)'
    return None
