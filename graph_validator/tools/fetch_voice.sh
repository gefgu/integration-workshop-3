#!/usr/bin/env bash
# Downloads the tutor voice (Piper pt_BR-cadu-medium, ~63 MB) into graph_validator/voices/ (git-ignored)
# and builds the shared system audio pack (graph_validator/audio/system.json).
set -euo pipefail
cd "$(dirname -- "${BASH_SOURCE[0]}")/.."
.venv/bin/python -m piper.download_voices pt_BR-cadu-medium --data-dir voices
.venv/bin/python -m graph_validator.tts system
