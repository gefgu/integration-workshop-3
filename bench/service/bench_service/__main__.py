"""python -m bench_service [--db bench.sqlite3] [--port 8765] [--host 0.0.0.0] [--dev]"""
import argparse
import os

import uvicorn


def main() -> None:
    parser = argparse.ArgumentParser(description="TedTronics bench service")
    parser.add_argument("--db", default=os.getenv("TEDTRONICS_BENCH_DB", "bench.sqlite3"))
    parser.add_argument("--bench-id", default=os.getenv("TEDTRONICS_BENCH_ID"))
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--dev", action="store_true", help="enable POST /dev/unlock (demo without the phone)")
    args = parser.parse_args()
    os.environ["TEDTRONICS_BENCH_DB"] = args.db
    if args.bench_id:
        os.environ["TEDTRONICS_BENCH_ID"] = args.bench_id
    if args.dev:
        os.environ["TEDTRONICS_BENCH_DEV"] = "1"
    uvicorn.run("bench_service.server:default_app", factory=True, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
