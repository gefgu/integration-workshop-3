"""python -m graph_validator.tts system | lesson <lesson.json> | say <text> <out.mp3>"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from . import build_system_pack, default_synth, lesson_audio, lesson_phrases, system_phrases


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m graph_validator.tts", description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("system", help="build the shared system pack (audio/system.json)")
    lp = sub.add_parser("lesson", help="synthesize a teacher lesson file's phrases")
    lp.add_argument("lesson", type=Path)
    sp = sub.add_parser("say", help="synthesize one phrase to an mp3 (pronunciation checks)")
    sp.add_argument("text")
    sp.add_argument("out", type=Path)
    args = ap.parse_args(argv)

    start = time.monotonic()
    if args.cmd == "system":
        print(f"{len(system_phrases())} phrases...", file=sys.stderr)
        manifest = build_system_pack()
        print(f"system pack: {len(manifest['phrases'])} phrases in {time.monotonic() - start:.1f} s")
    elif args.cmd == "lesson":
        doc = json.loads(args.lesson.read_text(encoding="utf-8"))
        audio = lesson_audio(lesson_phrases(doc))
        print(json.dumps(audio, ensure_ascii=False, indent=1))
        return 0 if audio["status"] == "ok" else 1
    else:
        args.out.write_bytes(default_synth().mp3(args.text))
        print(f"{args.out} in {time.monotonic() - start:.1f} s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
