# CP02: Power board + fixed-battery dongle

## Goal
Power everything from 12 V and provide the protected student rail (5V_EDU). Then light a
real LED circuit on module A1 through a temporary "fixed battery" connection.
Requirements: EFR9 (hardware cutoff < 1 ms), EFR10 (reverse polarity), EFR19 (5 V ± 5 %),
EFR23 (MF-R050 PTC backup), EFR24 (12 V barrel jack), EFR25 (buck converters),
ENFR8 (student rail starts OFF), EFR11 (the battery capsule is only visual).

## Adds
**Power board** (100 × 150 mm), built complete:

| Block | Parts | Notes |
|---|---|---|
| Input | DC jack 5.5 × 2.1 mm, 2.5 A resettable fuse, on/off switch rated ≥ 3 A, **1N5822** Schottky (reverse polarity), 470 µF/25 V + 100 nF | The PCB uses a P-MOSFET; a Schottky is simpler by hand and loses about 0.4 V |
| 5V_SYS | Buck module (LM2596 or MP1584), set to **5.05 V** | ESP2, logic chips, eFuse input |
| 3V3_SYS | AMS1117-3.3 module, fed from 5V_SYS | OLEDs, pull-ups, test source |
| Pi supply (reserved) | Screw terminal for a separate XL4015 5 V / 5 A module | Used in CP09; the terminal is soldered now |
| Student rail | **Discrete eFuse daughterboard** on a 2 × 8 pin header (below) | Plug-in, so it can be rebuilt without touching the power board |
| Manual controls | 2-pin **EN jumper** (EDU_PWR_EN → 3V3 through 1 kΩ), **FAULT RESET** push-button (to 3V3 through 1 kΩ), red LED on EDU_FAULT, green LED on 5V_EDU | Used until ESP1 arrives in CP05; they stay afterwards as manual overrides |
| Outputs | IDC 2×5: power/control cable (to the matrix board), power cable (to the smart board); 2-pin terminal with 5V_EDU + GND for the dongle | Pinouts in `00-standards.md` §4 |

**Fixed-battery dongle** (scrap perfboard): an IDC 2×5 header that plugs onto A1's node
cable. Node cable pin 1 (NODE00) → 5V_EDU, pin 3 (NODE01) → GND, using a 2-wire lead to
the power board terminal. The battery capsule then sits on columns 1–2, with + on column 1.
It is removed in CP05, when the matrix takes over.

## The discrete eFuse (daughterboard)
These are **starting values**. Simulate the circuit in Falstad (falstad.com/circuit, free,
runs in the browser) and try it on a solderless breadboard before soldering the
daughterboard.

```
5V_SYS ─ PTC MF-R050 ─┬─ S [P-MOSFET] D ─ R_SH 10 Ω ─┬─ 5V_EDU ──► dongle / matrix Y1
                       │       G                       │
                       └─10k─┤ (gate pulled up = OFF)  │
                             │                         │
             two BC547 in series pull the gate LOW = ON:
             Q_a base ◄─10k─ EDU_PWR_EN (100k pull-down, OFF at boot)
             Q_b base ◄─10k─ NOT_FAULT (CD4013 /Q)

Current sense: LM358 (12V_SYS) difference amplifier across R_SH, gain 10
   (10k / 100k pairs, 0.1 % or matched) → V_I = 0.1 V per mA
   V_I ──┬────────► LM393 (12V_SYS) IN+ ; IN− = threshold 1.20 V (27k + 10k trimmer from 5V_SYS)
         │          LM393 output (10k pull-up to 3V3) = TRIP, high on overcurrent
         └─10k─► EDU_CURRENT_ADC (BAT85 clamp to 3V3, 100 nF to GND)
   (the comparator takes V_I directly: the 10k/100 nF filter would add about 1 ms of delay)
CD4013 (3V3): SET = TRIP OR power-on pulse (diode OR, 100k pull-down)
              RESET = EDU_FAULT_RESET (100k pull-down)
              Q = EDU_FAULT (to ESP1 and the red LED), /Q = NOT_FAULT
EDU_ON = 5V_EDU through 10k (to the smart board; high only when the rail is really on)
```

How it meets the requirements:
- **EFR9.** Trip at 12 mA (threshold 1.20 V). The chain is op-amp → comparator → latch →
  transistors → MOSFET, with no software involved. I'd estimate it reacts in well under
  100 µs. The 10 Ω shunt also caps a dead short at about 0.5 A while that happens.
- **ENFR8.** The power-on pulse sets the latch, so the rail starts OFF until a reset and an
  enable arrive.
- **The latch holds.** After a trip the rail stays off until FAULT RESET, so it doesn't
  cycle on and off.
- **EFR19.** 5.05 V minus at most 0.12 V across the shunt (at 12 mA) minus the MOSFET drop
  stays above 4.75 V.

**P-MOSFET choice.** It must be logic-level: |Vgs(th)| ≤ 2 V, and Rds(on) ≤ 1 Ω at
Vgs = −4.5 V. Candidates: NDP6020P (TO-220), or AO3401A / IRLML6402 on a SOT-23 adapter.
Check what's available before ordering.

## Fritzing steps
1. Power board perfboard 100 × 150 mm. Place the input block, the bucks (as modules with
   pin headers), the daughterboard header, the IDC headers and the manual controls.
2. Draw the eFuse daughterboard as its **own sketch section** (or a separate small
   perfboard in the same file), connected only through the 2 × 8 header.
3. Draw the dongle as a third small board.
4. Export the XML netlist → diff with Claude.

## Build order
1. Input block only → first power-on test (below).
2. Bucks → set 5V_SYS to 5.05 V **before** connecting anything else.
3. The rest of the power board: header, IDC headers, manual controls.
4. The eFuse on a breadboard → tests 5–8 → then solder the daughterboard.
5. The dongle.

## Tests
| # | Condition | Test | Pass |
|---|---|---|---|
| 1 | Power off | 12V_SYS, 5V_SYS, 3V3_SYS each to GND | Not near 0 Ω |
| 2 | 12 V from a bench supply, limit 200 mA, no daughterboard | 12V_SYS, then 5V_SYS, then 3V3_SYS | 11.4–12.2 V, 5.00–5.10 V, 3.25–3.35 V |
| 3 | Same, reversed plug | Nothing powers up, no heat | Pass |
| 4 | Daughterboard on a breadboard, rail loaded with 1 kΩ, EN on, after a FAULT RESET | V_I and 5V_EDU | V_I ≈ 0.5 V (5 mA); 5V_EDU ≥ 4.75 V |
| 5 | Load 470 Ω (≈ 10.6 mA) | Does not trip | Rail stays on |
| 6 | Load 330 Ω (≈ 15 mA) | Trips and stays off | Red LED on, rail ≈ 0 V |
| 7 | Power-cycle the board | The rail is off at boot | 5V_EDU ≈ 0 V until RESET + EN |
| 8 | Oscilloscope (if available) on 5V_EDU, switch in a 100 Ω load | Time to cut off | < 1 ms (EFR9) |
| 9 | A1 + dongle, battery on columns 1–2, LED + 470 Ω circuit | The LED lights only when EN is on | Pass |
| 10 | Same with LED + 220 Ω (red LED ≈ 13.6 mA) | Trips | Expected: this circuit is above the 12 mA limit (ENFR6) |
| 11 | Jumper wire directly across columns 1 and 2 | Trips, nothing gets hot | Pass |

## Reality check
EFR24 says a **12 V / 2 A** adapter. The Pi 4/5 plus a screen can draw 3 A or more at 5 V,
which is about 1.5 A at 12 V on its own. Plan for a **12 V / 3 A or larger** adapter, or a
separate Pi supply, before CP09.

## Firmware/software
None. The manual EN jumper and RESET button replace ESP1 until CP05.

## Done
- [ ] Test log 1–11 (scope capture for test 8 if available)
- [ ] Threshold trimmer setting noted (V at IN−)
- [ ] `fritzing/cp02-power-board.fzz` + netlist XML
- [ ] Photos of the power board, the daughterboard and the dongle
