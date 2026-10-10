# CP06: Test tools (pre-energization checks)

## Goal
Use the five test tools on MT8816 A (X11–X15, soldered in CP05) to check the student's
circuit **with the rail off**, before every Energizar. **Firmware only, no soldering.**
Requirements: EFR18 (rail stays off unless the checks pass), EFR7 (configure before
power), ENFR6 (the predicted current stays within limits).

## How the tools work
A tool and a node meet on one of the shared buses (Y2–Y7):

```
3V3 ─►|─ 10 kΩ ─ X11 ─┐                          ┌─ X(node B) ─ Y0 (GND)
                      ├─ BUS ─ X(node A) ─[student's parts]─┘
          X13 SENSE ──┘   → divider → ESP1 IO36
```
- The reading is a voltage divider: the tool's resistor on top, and the student's circuit
  between node A and GND at the bottom.
  - **Open:** about 3 V.
  - **Short:** about 0 V.
  - **Resistor R:** proportional to R / (R + 10 kΩ).
  - **Forward diode or LED:** about 1.6–1.8 V. Swap the roles of A and B to see it block.
- **SOURCE_LO** (470 Ω) separates a dead short from a 220 Ω resistor, which SOURCE_HI can't.
  Its current is at most about 6.5 mA, so it stays within the switch limit.
- **DISCHARGE** (470 Ω to GND) empties the 1000 µF capacitors first. That takes about 2–3 s,
  at most about 10.6 mA.
- **CAL** (1 kΩ 1 %) measures the source voltage and the switch resistance, so the firmware
  can subtract them.

## Firmware additions (`firmware/esp32/router/`)
| Command | Does |
|---|---|
| `tool cal` | SOURCE_HI + SENSE + CAL on one bus → stores the source voltage and the switch resistance |
| `discharge <nodes…>` | Puts the nodes and DISCHARGE on a bus for 3 s |
| `ohm <nodeA> <nodeB> [hi\|lo]` | Node B to GND, node A + source + SENSE on a bus → estimated resistance |
| `precheck <battery+> <battery−>` | Discharge, then `ohm` hi; if it reads near 0, retry with lo. **Short → refuse `rail on`.** |
| `scan <groundNode>` | Grounds one node and probes every other node → list of what's connected (to locate a fault) |

`rail on` refuses to switch on until a `precheck` has passed for the current routing.

## Tests (known parts on module A1, rail off)
| # | Between NODE00 and NODE01 | `ohm` hi | `ohm` lo | Pass |
|---|---|---|---|---|
| 1 | Nothing | Open | Open | Reported as open |
| 2 | 1 kΩ | about 1 kΩ | about 1 kΩ | Within 10 % after `tool cal` |
| 3 | 220 Ω | "low" | about 220 Ω | lo separates it from a short |
| 4 | Jumper (short) | "low" | about 0 Ω | Reported as a **short**; `rail on` refused |
| 5 | LED, both directions | about 1.7 V one way, open the other | — | Polarity detected |
| 6 | 1000 µF charged to 5 V, then `discharge` | Reading rises slowly from 0 | — | Capacitor detected; discharged to < 0.1 V in ≤ 3 s |
| 7 | Full Energizar sequence on a good LED circuit | — | — | precheck passes → `rail on` → LED lights |
| 8 | Same sequence with a short added | — | — | precheck fails, the rail never turns on, the eFuse never trips |

## Done
- [ ] Calibration values stored
- [ ] Test log 1–8
- [ ] Firmware committed
