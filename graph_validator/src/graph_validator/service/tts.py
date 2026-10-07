"""Tutor audio: serve the cached MP3s and the shared system pack."""
from __future__ import annotations

import io
import json
import os
import re
import zipfile
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, Response

from ..tts import PLAYER_PHRASES, SYSTEM_MANIFEST, Synthesizer, audio_dir, default_synth, system_manifest

router = APIRouter(prefix="/tts")
AUDIO_NAME = re.compile(r"^[0-9a-f]{64}\.mp3$")


def synthesizer() -> Synthesizer | None:
    """The voice used on save; None when TTS is switched off (TEDTRONICS_TTS=off, e.g. in tests)."""
    return None if os.getenv("TEDTRONICS_TTS", "").lower() == "off" else default_synth()


def audio_path(name: str) -> Path:
    if not AUDIO_NAME.match(name):  # also rules out ../ and other paths outside the cache
        raise HTTPException(404, "Áudio não encontrado.")
    path = audio_dir() / name
    if not path.is_file():
        raise HTTPException(404, "Áudio não encontrado.")
    return path


def zip_response(filename: str, json_name: str, manifest: dict[str, Any], files: dict[str, str]) -> Response:
    """`files` maps the name inside the zip to a cached mp3. Missing files are listed, not fatal."""
    buf = io.BytesIO()
    missing = []
    with zipfile.ZipFile(buf, "w") as z:
        for arcname, name in sorted(files.items()):
            try:
                z.write(audio_path(name), f"audio/{arcname}", compress_type=zipfile.ZIP_STORED)
            except HTTPException:
                missing.append(name)
        if missing:
            manifest = {**manifest, "missing": missing}
        z.writestr(json_name, json.dumps(manifest, ensure_ascii=False, indent=1),
                   compress_type=zipfile.ZIP_DEFLATED)
    return Response(buf.getvalue(), media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="{filename}.zip"'})


@router.get("/audio/{name}")
def get_audio(name: str) -> FileResponse:
    return FileResponse(audio_path(name), media_type="audio/mpeg",
                        headers={"Cache-Control": "public, max-age=31536000, immutable"})


@router.get("/system")
def get_system() -> dict[str, Any]:
    """Shared phrases (default feedback, player lines). Built with `python -m graph_validator.tts system`."""
    manifest = system_manifest()
    if manifest is None:
        return {"status": "missing", "phrases": {}, "player": PLAYER_PHRASES,
                "detail": f"Rode python -m graph_validator.tts system para gerar {SYSTEM_MANIFEST}."}
    return manifest


@router.get("/system.zip")
def get_system_zip() -> Response:
    manifest = system_manifest()
    if manifest is None:
        raise HTTPException(404, "Pacote de áudio do sistema ainda não foi gerado.")
    return zip_response("tutor-system", SYSTEM_MANIFEST, manifest, {name: name for name in manifest["phrases"].values()})
