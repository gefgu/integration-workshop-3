"""The validator must accept every piece the editor and the bench screen offer (model/types.ts)."""
import re
from pathlib import Path

from graph_validator.catalog import CATALOG

TYPES_TS = Path(__file__).resolve().parents[2] / "teacher_authoring_app" / "src" / "model" / "types.ts"


def test_catalog_matches_the_editor_piece_types():
    union = re.search(r"export type PieceType =(.*?);", TYPES_TS.read_text(encoding="utf-8"), re.S).group(1)
    assert set(re.findall(r"'([a-z0-9_]+)'", union)) == set(CATALOG)
