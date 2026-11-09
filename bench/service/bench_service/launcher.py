"""TedTronics bench in one program: starts the bench service and opens the bench screen.

    python -m bench_service.launcher [--kiosk] [--camera 0 | --no-camera | --vision-image foto.jpg] [--no-demo]

Used by the Raspberry Pi service (bench/raspberry-pi) and to run the whole bench on a PC. The service serves the bench screen
itself, so nothing else has to run. The screen opens in a Chrome/Edge/Chromium app window sized like the 7"
monitor (1024x600), or full screen with --kiosk; closing that window stops the bench.
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

APP_NAME = "TedTronics Bancada"


def data_dir() -> Path:
    """Where the bench keeps its database and the browser profile."""
    if sys.platform == "win32":
        base = Path(os.getenv("LOCALAPPDATA") or Path.home() / "AppData" / "Local")
        path = base / "TedTronics" / "Bancada"
    else:
        path = Path(os.getenv("XDG_DATA_HOME") or Path.home() / ".local" / "share") / "tedtronics-bancada"
    path.mkdir(parents=True, exist_ok=True)
    return path


def find_browser() -> str | None:
    """A Chromium-based browser that supports --app / --kiosk."""
    names = ["chromium-browser", "chromium", "google-chrome", "microsoft-edge", "msedge", "chrome"]
    for name in names:
        found = shutil.which(name)
        if found:
            return found
    if sys.platform == "win32":
        roots = [os.getenv("PROGRAMFILES"), os.getenv("PROGRAMFILES(X86)"), os.getenv("LOCALAPPDATA")]
        tails = [r"Google\Chrome\Application\chrome.exe", r"Microsoft\Edge\Application\msedge.exe"]
        for root in filter(None, roots):
            for tail in tails:
                candidate = Path(root) / tail
                if candidate.is_file():
                    return str(candidate)
    return None


def wait_until_up(url: str, seconds: float = 60) -> bool:
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(f"{url}/status", timeout=2):
                return True
        except Exception:
            time.sleep(0.4)
    return False


def main() -> None:
    parser = argparse.ArgumentParser(prog=APP_NAME, description="Liga o serviço da bancada e abre a tela da bancada.")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--host", default="0.0.0.0", help="0.0.0.0 lets the teacher app connect over Wi-Fi")
    camera = parser.add_mutually_exclusive_group()
    camera.add_argument("--camera", type=int, default=0, help="camera index for the vision pipeline (default 0)")
    camera.add_argument("--no-camera", action="store_true", help="no camera: the board is simulated on screen")
    camera.add_argument("--vision-image", help="demo: run the vision pipeline on this photo in a loop")
    camera.add_argument("--vision-profile", choices=("current", "legacy"), default=None,
                        help="board profile: current (default) or legacy (full board)")
    camera.add_argument("--calibration", help="manual calibration file from `python -m visao --calibrate FILE`")
    parser.add_argument("--no-demo", action="store_true", help="hide the demo mode (the teacher app must unlock)")
    parser.add_argument("--kiosk", action="store_true", help="full screen (the real bench's 7\" monitor)")
    parser.add_argument("--no-browser", action="store_true", help="only run the service")
    parser.add_argument("--db", default=None, help="bench database (default: in the user's data folder)")
    parser.add_argument("--ble", action="store_true", help="also run the Bluetooth peripheral for the teacher app (BlueZ)")
    parser.add_argument("--adapter", default=None, help="Bluetooth adapter for --ble, e.g. hci0")
    parser.add_argument("--controls", default=None,
                        help="serial port of the ESP32 joystick + Energizar: auto (USB or GPIO), /dev/ttyUSB0, /dev/serial0, COM4")
    args = parser.parse_args()

    data = data_dir()
    os.environ["TEDTRONICS_BENCH_DB"] = args.db or str(data / "bench.sqlite3")
    if not args.no_demo:
        os.environ["TEDTRONICS_BENCH_DEV"] = "1"
    if args.controls:
        os.environ["TEDTRONICS_BENCH_CONTROLS"] = args.controls
    if args.vision_profile:
        os.environ["TEDTRONICS_BENCH_VISION_PROFILE"] = args.vision_profile
    if args.calibration:
        os.environ["TEDTRONICS_BENCH_CALIBRATION"] = os.path.abspath(args.calibration)
    if args.vision_image:
        os.environ["TEDTRONICS_BENCH_VISION_IMAGE"] = os.path.abspath(args.vision_image)
    elif not args.no_camera:
        os.environ["TEDTRONICS_BENCH_CAMERA"] = str(args.camera)

    if args.ble:
        # Bluetooth and HTTP share one event loop and one store (the Raspberry Pi service; no window).
        import asyncio

        from .__main__ import serve_with_ble

        print(f"{APP_NAME}: serviço com Bluetooth na porta {args.port}", flush=True)
        asyncio.run(serve_with_ble(args.host, args.port, args.adapter))
        return

    import uvicorn

    from .server import default_app

    app = default_app()
    server = uvicorn.Server(uvicorn.Config(app, host=args.host, port=args.port, log_level="warning"))
    thread = threading.Thread(target=server.run, name="bench-service", daemon=True)
    thread.start()

    url = f"http://127.0.0.1:{args.port}"
    print(f"{APP_NAME}: iniciando em {url} …", flush=True)
    if not wait_until_up(url):
        print("O serviço da bancada não iniciou. A porta pode estar em uso por outro programa.", flush=True)
        sys.exit(1)
    print(f"{APP_NAME} pronta. Tela: {url}/  (feche a janela da bancada para desligar)", flush=True)

    browser = None if args.no_browser else find_browser()
    if browser:
        flags = ["--kiosk"] if args.kiosk else ["--window-size=1024,600"]
        profile = data / "tela"
        proc = subprocess.Popen(
            [browser, f"--app={url}/", *flags, f"--user-data-dir={profile}", "--no-first-run",
             "--disable-features=Translate", "--autoplay-policy=no-user-gesture-required",
             "--password-store=basic"]
        )
        try:
            proc.wait()  # the bench screen's window closed: stop the bench
        except KeyboardInterrupt:
            proc.terminate()
    else:
        if not args.no_browser:
            webbrowser.open(f"{url}/")
            print("Nenhum Chrome/Edge/Chromium encontrado: a tela abriu no navegador padrão.", flush=True)
        print("Pressione Ctrl+C para desligar a bancada.", flush=True)
        try:
            while thread.is_alive():
                time.sleep(0.5)
        except KeyboardInterrupt:
            pass
    server.should_exit = True
    thread.join(timeout=5)
    os._exit(0)  # the vision thread is a daemon; leave without waiting for the camera


if __name__ == "__main__":
    main()
