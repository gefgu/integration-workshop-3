"""Text-to-speech for the tutor: Piper (pt_BR-cadu-medium) to MP3, cached by content hash."""
from __future__ import annotations

import hashlib
import io
import os
import re
import wave
from collections.abc import Iterable
from pathlib import Path
from typing import Protocol

VOICE = "pt_BR-cadu-medium"
MP3_KBPS = 64
_ROOT = Path(__file__).resolve().parents[3]  # graph_validator/

# Applied only to the text Piper reads, never to the lookup key (pronunciation tuning).
SPOKEN_FORMS = [
    (re.compile(r"(\d)\s*kΩ"), r"\1 quilo-ohms"),
    (re.compile(r"(\d)\s*Ω"), r"\1 ohms"),
    (re.compile(r"(\d)\s*µF"), r"\1 microfarads"),
    (re.compile(r"(\d)\s*mA\b"), r"\1 miliampères"),
    (re.compile(r"(\d)\s*V\b"), r"\1 volts"),
    (re.compile(r"\bLED\b"), "léd"),
]


def normalize(text: str) -> str:
    """Lookup key for a phrase. Mirrored by `normalize` in teacher_authoring_app/src/audio/tutorVoice.ts."""
    return " ".join(text.split())


def spoken(text: str) -> str:
    for pattern, repl in SPOKEN_FORMS:
        text = pattern.sub(repl, text)
    return text


def audio_file(text: str, voice: str = VOICE) -> str:
    """Deterministic file name: the same phrase in the same voice is synthesized once."""
    return hashlib.sha256(f"{voice}\n{normalize(text)}".encode()).hexdigest() + ".mp3"


def audio_dir() -> Path:
    return Path(os.getenv("TEDTRONICS_AUDIO_DIR") or _ROOT / "audio")


def voice_path() -> Path:
    return Path(os.getenv("TEDTRONICS_PIPER_VOICE") or _ROOT / "voices" / f"{VOICE}.onnx")


class Synthesizer(Protocol):
    voice: str

    def mp3(self, text: str) -> bytes: ...


class TtsUnavailable(RuntimeError):
    """Piper, lameenc or the voice model is missing: lessons still save, without audio."""


class PiperSynth:
    def __init__(self, model: Path | None = None):
        self.model = model or voice_path()
        self.voice = VOICE
        self._piper = None

    def _load(self):
        if self._piper is None:
            try:
                from piper import PiperVoice
            except ImportError as e:
                raise TtsUnavailable("piper-tts não está instalado (pip install -e '.[tts]').") from e
            if not self.model.exists():
                raise TtsUnavailable(f"Modelo de voz não encontrado: {self.model} (rode graph_validator/tools/fetch_voice.sh).")
            self._piper = PiperVoice.load(str(self.model))
        return self._piper

    def mp3(self, text: str) -> bytes:
        try:
            import lameenc
        except ImportError as e:
            raise TtsUnavailable("lameenc não está instalado (pip install -e '.[tts]').") from e
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wav:
            self._load().synthesize_wav(spoken(normalize(text)), wav)
        buf.seek(0)
        with wave.open(buf, "rb") as wav:
            rate, channels, pcm = wav.getframerate(), wav.getnchannels(), wav.readframes(wav.getnframes())
        enc = lameenc.Encoder()
        enc.set_bit_rate(MP3_KBPS)
        enc.set_in_sample_rate(rate)
        enc.set_channels(channels)
        enc.set_quality(2)
        return bytes(enc.encode(pcm) + enc.flush())


_default: PiperSynth | None = None


def default_synth() -> PiperSynth:
    """One Piper model per process: loading it takes about a second."""
    global _default
    if _default is None:
        _default = PiperSynth()
    return _default


def ensure_audio(texts: Iterable[str], synth: Synthesizer, out: Path | None = None) -> dict[str, str]:
    """{normalized text: mp3 file name}, synthesizing only phrases not cached in `out` yet."""
    out = out or audio_dir()
    out.mkdir(parents=True, exist_ok=True)
    phrases: dict[str, str] = {}
    for text in texts:
        key = normalize(text)
        if not key or key in phrases:
            continue
        name = audio_file(key, synth.voice)
        path = out / name
        if not path.exists():
            tmp = path.with_suffix(".part")
            tmp.write_bytes(synth.mp3(key))
            tmp.replace(path)  # never leave a half-written mp3 behind a valid name
        phrases[key] = name
    return phrases


def lesson_audio(texts: Iterable[str], synth: Synthesizer | None = None, out: Path | None = None) -> dict:
    """The `audio` block stored in a saved lesson document. Never raises: saving must not depend on TTS."""
    synth = synth or default_synth()
    try:
        return {"voice": synth.voice, "status": "ok", "phrases": ensure_audio(texts, synth, out)}
    except TtsUnavailable as e:
        return {"voice": synth.voice, "status": "unavailable", "detail": str(e), "phrases": {}}
    except Exception as e:  # noqa: BLE001 - any synthesis failure degrades to "no audio"
        return {"voice": synth.voice, "status": "error", "detail": str(e), "phrases": {}}
