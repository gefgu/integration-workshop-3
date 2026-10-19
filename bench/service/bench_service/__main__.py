"""python -m bench_service [--db bench.sqlite3] [--port 8765] [--host 0.0.0.0] [--dev] [--ble [--adapter hci0]]"""
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
    args = parser.parse_args()
    os.environ["TEDTRONICS_BENCH_DB"] = args.db
    if args.bench_id:
        os.environ["TEDTRONICS_BENCH_ID"] = args.bench_id
    if args.dev:
        os.environ["TEDTRONICS_BENCH_DEV"] = "1"
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
