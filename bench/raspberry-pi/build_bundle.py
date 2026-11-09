"""Builds the Raspberry Pi bench bundle: bench/raspberry-pi/dist/tedtronics-bancada-pi.tar.gz

    python bench/raspberry-pi/build_bundle.py [--skip-ui]

The bundle holds the source of graph_validator, bench_service and visao, the built bench screen
(teacher_authoring_app/dist: bench.html + assets) and the installer. On the Pi:
    tar xzf tedtronics-bancada-pi.tar.gz && cd tedtronics-bancada && sudo ./install.sh
Runs on Windows too: shell scripts get LF line endings and mode 755 inside the archive.
"""
from __future__ import annotations

import argparse
import io
import shutil
import subprocess
import sys
import tarfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
UI = REPO / "teacher_authoring_app"
OUT = HERE / "dist" / "tedtronics-bancada-pi.tar.gz"
TOP = "tedtronics-bancada"
SCRIPTS = {"install.sh", "uninstall.sh", "tedtronics-tela"}
TEXT = {".sh", ".txt", ".py", ".toml", ".md", ".html", ".js", ".css", ".json", ""}
SKIP_DIRS = {"__pycache__", "tests", ".pytest_cache", "images", "fixtures"}
SKIP_SUFFIXES = {".pyc", ".sqlite3"}
# Test photos are left out, except the reference photo that visao/calibracao.py matches features against
# (calibra_por_referencia) when the grid edges are not all visible.
KEEP_FILES = {"visao/fixtures/current/frame-00.jpg"}


def build_ui() -> None:
    npm = shutil.which("npm") or shutil.which("npm.cmd")
    if not npm:
        sys.exit("npm não encontrado; rode `npm run build` em teacher_authoring_app ou use --skip-ui")
    subprocess.run([npm, "run", "build"], cwd=UI, check=True)


def wanted(path: Path) -> bool:
    if path.as_posix() in KEEP_FILES:
        return True
    return not any(part in SKIP_DIRS or part.endswith(".egg-info") for part in path.parts) and path.suffix not in SKIP_SUFFIXES


def add_file(tar: tarfile.TarFile, src: Path, arc: str, script: bool = False) -> None:
    data = src.read_bytes()
    if script or (src.suffix in TEXT and src.suffix != ".js"):
        data = data.replace(b"\r\n", b"\n")
    info = tarfile.TarInfo(f"{TOP}/{arc}")
    info.size = len(data)
    info.mode = 0o755 if script else 0o644
    info.mtime = int(src.stat().st_mtime)
    tar.addfile(info, io.BytesIO(data))


def add_tree(tar: tarfile.TarFile, root: Path, arc: str, only: list[str]) -> None:
    for name in only:
        item = root / name
        files = [item] if item.is_file() else sorted(p for p in item.rglob("*") if p.is_file())
        for path in files:
            rel = path.relative_to(root)
            if wanted(rel):
                add_file(tar, path, f"{arc}/{rel.as_posix()}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-ui", action="store_true", help="use the existing teacher_authoring_app/dist")
    args = parser.parse_args()
    if not args.skip_ui:
        build_ui()
    dist = UI / "dist"
    if not (dist / "bench.html").is_file():
        sys.exit("teacher_authoring_app/dist/bench.html não existe; rode o build do site")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(OUT, "w:gz") as tar:
        add_tree(tar, REPO / "graph_validator", "app/graph_validator", ["pyproject.toml", "README.md", "src"])
        add_tree(tar, REPO / "bench" / "service", "app/bench_service", ["pyproject.toml", "bench_service"])
        add_tree(tar, REPO, "app", ["visao"])
        add_tree(tar, dist, "ui", ["bench.html", "assets"])
        for path in sorted((HERE / "files").iterdir()):
            add_file(tar, path, path.name, script=path.name in SCRIPTS)
    print(f"{OUT}  ({OUT.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
