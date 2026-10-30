"""Do what the teacher's phone does: deliver a module to a bench, and sync the bench's events back.

  python graph_validator/tools/bench_delivery.py load --api URL --bench ws://HOST:PORT/ble --module-id N --class-id M
  python graph_validator/tools/bench_delivery.py sync --api URL --bench ws://HOST:PORT/ble

Credentials: SEED_EMAIL / SEED_PASSWORD (default: the seeded demo teacher). It speaks the same framed
protocol as the BLE link (docs/bench-protocol.md), over the bench's WebSocket simulator.
"""
import argparse
import asyncio
import itertools
import json
import os
import sys

import httpx
import websockets

from bench_service.protocol import FrameAssembler, encode_frames

counter = itertools.count(1)


def login(api: str) -> httpx.Client:
    client = httpx.Client(base_url=api, timeout=60)
    body = {"email": os.getenv("SEED_EMAIL", "professor@tedtronics.local"),
            "password": os.getenv("SEED_PASSWORD", "tedtronics")}
    response = client.post("/auth/login", json=body)
    response.raise_for_status()
    client.headers["Authorization"] = f"Bearer {response.json()['token']}"
    return client


async def request(socket, message: dict) -> tuple[dict, int]:
    """Sends one protocol message (as many frames as it needs); returns the reply and the frame count."""
    message = {**message, "id": f"m{next(counter)}"}
    frames = encode_frames(message, f"a{next(counter)}")
    for frame in frames:
        await socket.send(frame)
    assembler = FrameAssembler()
    while True:
        reply = assembler.push(await socket.recv())
        if reply is not None:
            return reply, len(frames)


async def load(args: argparse.Namespace) -> None:
    api = login(args.api)
    session = api.post("/bench/session")
    session.raise_for_status()
    package = api.get(f"/bench/package/{args.module_id}", params={"class_id": args.class_id})
    package.raise_for_status()
    package = package.json()
    async with websockets.connect(args.bench, max_size=None) as socket:
        hello, _ = await request(socket, {"type": "HELLO", "token": session.json()["token"], "protocol": 1})
        assert hello["type"] == "WELCOME", hello
        reply, frames = await request(socket, {"type": "LOAD_PACKAGE", "package": package})
        size = len(json.dumps(package, ensure_ascii=True, separators=(",", ":")))
        print(f"module {args.module_id}: {len(package['lessons'])} lessons, {size:,} bytes, {frames:,} frames of 150 chars"
              f" → {reply['type']}" + (f" ({reply.get('message')})" if reply["type"] == "ERROR" else ""))
        if reply["type"] != "PACKAGE_OK":
            sys.exit(1)


async def sync(args: argparse.Namespace) -> None:
    api = login(args.api)
    async with websockets.connect(args.bench, max_size=None) as socket:
        session = api.post("/bench/session")
        session.raise_for_status()
        hello, _ = await request(socket, {"type": "HELLO", "token": session.json()["token"], "protocol": 1})
        status = hello
        bench_id = status["bench_id"]
        total = inserted = rejected = 0
        while True:
            reply, _ = await request(socket, {"type": "PULL_EVENTS", "max": 200})
            events = reply["events"]
            if not events:
                break
            result = api.post("/bench/sync", json={"bench_id": bench_id, "events": events})
            result.raise_for_status()
            body = result.json()
            total += len(events)
            inserted += body["inserted"]
            rejected += len(body["rejected"])
            await request(socket, {"type": "ACK_EVENTS", "event_ids": body["acked"]})
        print(f"synced {total} events: {inserted} new on the server, {rejected} rejected")


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("load", "sync"):
        p = sub.add_parser(name)
        p.add_argument("--api", required=True)
        p.add_argument("--bench", required=True)
        if name == "load":
            p.add_argument("--module-id", type=int, required=True)
            p.add_argument("--class-id", type=int, required=True)
    args = parser.parse_args()
    asyncio.run(load(args) if args.command == "load" else sync(args))


if __name__ == "__main__":
    main()
