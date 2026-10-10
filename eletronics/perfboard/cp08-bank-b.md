# CP08: Bank B (MT8816 B + modules B1, B2, B3)

## Goal
Complete the bench: all 22 nodes and all 6 smart positions. Plug in MT8816 B, and add the
three mirrored bank-B modules. Requirements: EFR31.2 (6 positions, max 3 active),
EFR1/EFR3 over the full board.

## Adds
| Module | Columns | Nodes | Smart position | Size |
|---|---|---|---|---|
| B1 | 1–4 | 11–14 | 3 → 11/12/13 (SDA_3) | 28 holes wide |
| B2 | 5–8 | 15–18 | 4 → 15/16/17 (SDA_4) | 28 holes wide |
| B3 | 9–11 | 19–21 | 5 → 19/20/21 (SDA_5) | 21 holes wide |

**Bank B modules are mirror images.** The service contacts sit **below** row 12, and the
IDC headers go on the edge toward the centre channel. Make a mirrored copy of the CP01
Fritzing layout and check it against the printed bench before soldering.

Plug **MT8816 B** into its socket (power off).

## Tests
| # | Test | Pass |
|---|---|---|
| 1 | CP01 tests on each module | Pass |
| 2 | Route every node 11–21 to 5V_EDU and GND in turn | Correct, one at a time |
| 3 | Positions 3, 4, 5: `scan`, voltmeter, gate | Same as positions 0–2 |
| 4 | Any 3 positions active, e.g. 0, 3, 5 | Works; a fourth is refused |
| 5 | Cross-bank check: NODE00 and NODE11 on the same bus, rail off, `ohm 0 11` | Reads the switch resistance only (the bus link works) |
| 6 | Full-board `precheck` on a circuit in bank B | Pass |
| 7 | Run all CP07 tests again | Nothing in bank A changed |

## Done
- [ ] All 22 nodes and 6 positions logged
- [ ] Photo of the whole underside
