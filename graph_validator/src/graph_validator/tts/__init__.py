"""Tutor voice: every phrase the tutor says, synthesized once with Piper and stored as MP3."""
from __future__ import annotations

import json
from pathlib import Path

from .phrases import PLAYER_PHRASES, lesson_phrases, system_phrases
from .synth import (VOICE, PiperSynth, Synthesizer, TtsUnavailable, audio_dir, audio_file, default_synth,
                    ensure_audio, lesson_audio, normalize)

SYSTEM_MANIFEST = "system.json"

__all__ = [
    "PLAYER_PHRASES", "SYSTEM_MANIFEST", "VOICE", "PiperSynth", "Synthesizer", "TtsUnavailable", "audio_dir",
    "audio_file", "build_system_pack", "default_synth", "ensure_audio", "lesson_audio", "lesson_phrases",
    "normalize", "system_manifest", "system_phrases",
]


def build_system_pack(synth: Synthesizer | None = None, out: Path | None = None) -> dict:
    """Synthesize the shared phrases (defaults, misconnected variants, player lines) and write system.json."""
    out = out or audio_dir()
    synth = synth or default_synth()
    manifest = {"voice": synth.voice, "status": "ok", "phrases": ensure_audio(system_phrases(), synth, out),
                "player": PLAYER_PHRASES}
    (out / SYSTEM_MANIFEST).write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    return manifest


def system_manifest(out: Path | None = None) -> dict | None:
    path = (out or audio_dir()) / SYSTEM_MANIFEST
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None
