"""The validator must accept every piece the editor and the bench screen offer (model/types.ts)."""
import re
from pathlib import Path

from graph_validator.catalog import CATALOG

TYPES_TS = Path(__file__).resolve().parents[2] / "teacher_authoring_app" / "src" / "model" / "types.ts"


def test_catalog_matches_the_editor_piece_types():
    union = re.search(r"export type PieceType =(.*?);", TYPES_TS.read_text(encoding="utf-8"), re.S).group(1)
    assert set(re.findall(r"'([a-z0-9_]+)'", union)) == set(CATALOG)


def test_potentiometer_spans_two_columns_like_the_app():
    """The app places the potentiometer two columns apart; the validator used to demand one (invalid_board)."""
    from graph_validator.models import Piece, board_problems
    ok = Piece(id="pot", type="potenciometro", a=3, b=5, row=2, value=1000)
    assert board_problems([ok]) == []
    short = Piece(id="pot", type="potenciometro", a=3, b=4, row=2)
    assert any("must span 2" in p for p in board_problems([short]))
