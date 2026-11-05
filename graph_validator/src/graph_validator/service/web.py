"""Production entry point: the teacher website and the API in one service.

    uvicorn graph_validator.service.web:app

- /api/...  the API (the same app as graph_validator.service.app:app, which the website calls under /api)
- /...      the built website (teacher_authoring_app/dist); client routes such as /home or /turmas/3 get index.html,
            /bench.html is the bench screen.

TEDTRONICS_SITE_DIR points to the built site (default: teacher_authoring_app/dist next to this repository).
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .app import app as api

REPO = Path(__file__).resolve().parents[4]
SITE = Path(os.getenv("TEDTRONICS_SITE_DIR", REPO / "teacher_authoring_app" / "dist")).resolve()

app = FastAPI(title="TedTronics", docs_url=None, redoc_url=None, openapi_url=None)
app.mount("/api", api)


@app.get("/healthz", include_in_schema=False)
def healthz() -> dict[str, str]:
    return {"status": "ok", "site": "ok" if (SITE / "index.html").is_file() else "missing"}


if (SITE / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=SITE / "assets"), name="assets")


@app.get("/{path:path}", include_in_schema=False)
def site(path: str) -> FileResponse:
    """Files of the built site, else index.html so the website's own routes (/home, /turmas/3…) load."""
    index = SITE / "index.html"
    if not index.is_file():
        raise HTTPException(503, "Site não compilado: rode `npm run build` em teacher_authoring_app.")
    target = (SITE / path).resolve()
    if path and target.is_file() and SITE in target.parents:
        return FileResponse(target)
    return FileResponse(index, headers={"Cache-Control": "no-cache"})
