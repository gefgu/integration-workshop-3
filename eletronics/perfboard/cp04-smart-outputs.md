# CP04: Smart outputs (gate, pulse, memory) on position 0

## Goal
Plug in the shift registers and the tri-state buffers, so position 0 can drive its P3.
**Nothing is soldered in this checkpoint.** Requirements: EFR32.1 (logic gates),
EFR32.2 (pulse source), EFR32.5 (1-bit memory), EFR28 (P3 high-Z when off),
EFR30 (≤ 12 mA into a short), EFR32 (output levels).

## Plugs in
| Chip | Socket | Role |
|---|---|---|
| 74HCT595N | U1 | DRV1–6: the level each P3 drives |
| 74HCT595N | U15 | OE_N1–6: whether each P3 drives at all |
| 74HCT125N | U18 | P3 buffers, positions 0–3 |
| 74HCT125N | U19 | P3 buffers, positions 4–5 |

**Power off while plugging.** Check the notch direction of every chip.

## Test setup (no fixed battery)
Position 0 uses nodes 00/01/02, which are the same nodes the fixed-battery dongle powers.
So for these tests **unplug the dongle** and use test leads:
- P1 (column 1) and P2 (column 2): each fed from 5V_SYS or GND through a **1 kΩ** resistor.
- P3 (column 3): LED + 1 kΩ to GND to watch the output, or the multimeter.
- **Bridge EDU_ON high for the test**: put a jumper from the smart board's power-cable pin 7
  to 5V through 10 kΩ, because the student rail is off without the dongle. **Remove the
  bridge afterwards.**

## Tests
| # | Test | Pass |
|---|---|---|
| 1 | Power on with no configuration: P3 (column 3) to GND and to 5 V, measured with the meter's resistance or diode range | High-Z: no drive, leakage ≤ 10 µA (EFR28) |
| 2 | `set 0 gate and`: all four P1/P2 combinations | P3 follows AND, within one sensing round |
| 3 | Repeat for or, nand, nor, xor, not | Correct truth tables (EFR32.1) |
| 4 | `set 0 mem sr`: S = 1 → Q = 1; R = 1 → Q = 0; both low → Q held; both high → Q = 0 (reset wins) | Matches EFR32.5 |
| 5 | `set 0 pulse 1 50`, then `set 0 pulse 10 25` | LED blinks at 1 Hz / 10 Hz; `stats` edge error ≤ 5 % of the period (EFR32.2) |
| 6 | P3 driven high, short column 3 to GND through the meter on the mA range | ≤ 12 mA (about 10.6 mA expected) (EFR30) |
| 7 | P3 driven low, short column 3 to 5 V through the meter | ≤ 12 mA |
| 8 | Output levels with a 1 mA load (5 kΩ to GND for high, 5 kΩ to 5 V for low) | High ≥ 3.5 V; low ≤ 0.5 V |
| 9 | Same with a 2 mA load (EFR32 as written today) | Expect low ≈ 0.94 V: **fails at 2 mA**. Record it; see the requirement note in the README. |
| 10 | Remove the EDU_ON bridge while P3 is driving | P3 goes high-Z immediately (hardware EFR28) |
| 11 | `set 0 off` | P3 high-Z again |

## Firmware/software
`firmware/esp32/smart_components` with the CP03 config changes. `tools/run_tests.py` can
run the command sequence and log it.

## Done
- [ ] Test log 1–11 (with the results of 8 and 9)
- [ ] EDU_ON bridge removed
- [ ] `fritzing/cp04-smart-outputs.fzz` (CP03 copy with the chips marked as fitted)
