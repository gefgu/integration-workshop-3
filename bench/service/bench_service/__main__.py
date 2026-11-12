"""python -m bench_service [--db bench.sqlite3] [--port 8765] [--host 0.0.0.0] [--dev] [--ble [--adapter hci0]]
                           [--camera 0 | --vision-image foto.jpg] [--controls /dev/serial0]"""
import argparse
import asyncio
import os

import uvicorn


def main() -> None:
    parser = argparse.ArgumentParser(description="TedTronics bench service")
    parser.add_argument("--db", default=os.getenv("TEDTRONICS_BENCH_DB", "bench.sqlite3"))
    parser.add_argument("--bench-id", default=os.getenv("TEDTRONICS_BENCH_ID"))
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--dev", action="store_true", help="enable POST /dev/unlock (demo without the phone)")
    parser.add_argument("--ble", action="store_true",
                        help="also run the BLE GATT peripheral (BlueZ, pip install -e '.[ble]')")
    parser.add_argument("--adapter", default=None, help="Bluetooth adapter for --ble, e.g. hci0")
    parser.add_argument("--camera", default=None,
                        help="camera index or persistent /dev/v4l/by-id path (pip install -e '.[vision]')")
    parser.add_argument("--vision-image", default=None, help="demo: run the vision pipeline on this photo in a loop")
    parser.add_argument("--record", default=None, metavar="DIR",
                        help="record original MJPEG camera frames and control commands for later replay")
    parser.add_argument("--camera-settings", default=None, metavar="FILE",
                        help="JSON file of explicitly commanded camera controls")
    parser.add_argument("--vision-profile", choices=("current", "legacy"), default=None,
                        help="board profile: current (default, half-populated kit board) or legacy (full board)")
    parser.add_argument("--calibration", default=None,
                        help="manual calibration file made with `python -m visao --calibrate FILE` (current profile)")
    parser.add_argument("--controls", default=None,
                        help="serial port of the ESP32 controls, e.g. /dev/serial0 (pip install -e '.[controls]')")
    args = parser.parse_args()
    if args.record and (args.camera is None or args.vision_image):
        parser.error('--record requires --camera and cannot be used with --vision-image')
    os.environ["TEDTRONICS_BENCH_DB"] = args.db
    if args.bench_id:
        os.environ["TEDTRONICS_BENCH_ID"] = args.bench_id
    if args.dev:
        os.environ["TEDTRONICS_BENCH_DEV"] = "1"
    if args.camera is not None:
        os.environ["TEDTRONICS_BENCH_CAMERA"] = str(args.camera)
    if args.vision_image:
        os.environ["TEDTRONICS_BENCH_VISION_IMAGE"] = os.path.abspath(args.vision_image)
    if args.vision_profile:
        os.environ["TEDTRONICS_BENCH_VISION_PROFILE"] = args.vision_profile
    if args.calibration:
        os.environ["TEDTRONICS_BENCH_CALIBRATION"] = os.path.abspath(args.calibration)
    if args.record:
        os.environ["TEDTRONICS_BENCH_RECORD"] = os.path.abspath(args.record)
    if args.camera_settings:
        os.environ["TEDTRONICS_BENCH_CAMERA_SETTINGS"] = os.path.abspath(args.camera_settings)
    if args.controls:
        os.environ["TEDTRONICS_BENCH_CONTROLS"] = args.controls
    if not args.ble:
        uvicorn.run("bench_service.server:default_app", factory=True, host=args.host, port=args.port)
        return
    asyncio.run(serve_with_ble(args.host, args.port, args.adapter))


async def serve_with_ble(host: str, port: int, adapter: str | None) -> None:
    """HTTP/WebSocket and BLE in one event loop, sharing one BenchStore (one unlock, one event queue)."""
    from .ble import serve
    from .server import default_app

    app = default_app()
    http = uvicorn.Server(uvicorn.Config(app, host=host, port=port))
    ble = asyncio.create_task(serve(app.state.store, adapter))
    # No adapter or BlueZ down: stop the HTTP side too instead of serving a bench nobody can pair with.
    ble.add_done_callback(lambda task: setattr(http, "should_exit", True))
    try:
        await http.serve()
    finally:
        ble.cancel()
        await asyncio.gather(ble, return_exceptions=True)
    if not ble.cancelled() and ble.exception() is not None:
        raise ble.exception()


if __name__ == "__main__":
    main()
