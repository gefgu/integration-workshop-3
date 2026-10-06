"""SFR8 (translation invariance) and SNFR6 (200 ms) checks."""
import random
import time

from hypothesis import given, settings, strategies as st

from graph_validator.catalog import BANK_ROWS, CATALOG, COLS, ROWS
from graph_validator.match import is_match
from graph_validator.models import MatchOptions, Piece, board_problems

from helpers import G


@st.composite
def boards(draw, max_pieces=21):
    types = list(CATALOG)
    n = draw(st.integers(1, max_pieces))
    pieces: list[Piece] = []
    for i in range(n):
        t = draw(st.sampled_from(types))
        ln = CATALOG[t].length
        a = draw(st.integers(1, COLS - ln))
        flip = draw(st.booleans())
        row = draw(st.integers(0, ROWS - 1))
        pa, pb = (a + ln, a) if flip else (a, a + ln)
        pieces.append(Piece(id=f"p{i}", type=t, a=pa, b=pb, row=row))
        if board_problems(pieces):
            pieces.pop()
    return pieces


def shift(pieces, dc, dr):
    return [p.model_copy(update={"a": p.a + dc, "b": p.b + dc, "row": p.row + dr}) for p in pieces]


@given(boards(), st.data())
@settings(max_examples=150, deadline=None)
def test_sfr8_shift_keeps_graph_isomorphic(pieces, data):
    if not pieces:
        return
    lo_c = min(min(p.a, p.b) for p in pieces); hi_c = max(max(p.a, p.b) for p in pieces)
    lo_r = min(p.row for p in pieces); hi_r = max(p.row for p in pieces)
    dc = data.draw(st.integers(1 - lo_c, COLS - hi_c))
    # the banks are separate nodes, so rows may only move inside their bank
    if hi_r < BANK_ROWS:
        dr = data.draw(st.integers(-lo_r, BANK_ROWS - 1 - hi_r))
    elif lo_r >= BANK_ROWS:
        dr = data.draw(st.integers(BANK_ROWS - lo_r, ROWS - 1 - hi_r))
    else:
        dr = 0
    moved = shift(pieces, dc, dr)
    assert not board_problems(moved)
    for opts in (MatchOptions(), MatchOptions(strict_positions=True), MatchOptions(match_values=True)):
        assert is_match(G(moved), G(pieces), opts)


def test_sfr6_removing_a_piece_breaks_match():
    rnd = random.Random(1)
    for _ in range(50):
        pieces = [Piece(id=f"p{i}", type="jumper_curto", a=1 + i % 9, b=2 + i % 9, row=i % ROWS) for i in range(5)]
        drop = rnd.randrange(len(pieces))
        assert not is_match(G(pieces[:drop] + pieces[drop + 1:]), G(pieces))


def _max_kit_board(seed):
    """Every kit piece on the board, packed into few columns so the column cliques are dense."""
    rnd = random.Random(seed)
    pieces, n = [], 0
    for t, d in CATALOG.items():
        for _ in range(d.kit_limit):
            a = rnd.randint(1, COLS - d.length)
            pieces.append(Piece(id=f"p{n}", type=t, a=a, b=a + d.length, row=n % ROWS))
            n += 1
    return pieces


def test_snfr6_compare_within_200ms_on_max_kit_boards():
    worst = 0.0
    for seed in range(40):
        pieces = _max_kit_board(seed)
        assert len(pieces) == 21
        target = G(pieces)
        # student has the same circuit, built in a different order/orientation
        student = G(list(reversed([p.model_copy(update={"a": p.b, "b": p.a}) if p.type not in ("bateria", "led") else p for p in pieces])))
        for other in (student, G(pieces[:-1])):
            t0 = time.perf_counter()
            is_match(other, target)
            worst = max(worst, time.perf_counter() - t0)
    assert worst < 0.2, f"worst comparison took {worst * 1000:.0f} ms"
