# CP05: Matrix board (ESP1 + MT8816 A)

## Goal
Build the matrix board **complete** for both banks. Plug in ESP1 and the bank-A MT8816,
remove the fixed-battery dongle, and let ESP1 power the battery capsule's nodes through
the matrix. Requirements: EFR1, EFR3, EFR4 (clear before configure), EFR5 (configured
from the netlist), EFR6 (open at startup/reset), EFR22 (≤ 50 ms update), ENFR6
(≤ 12 mA per switch).

## Before you start: MT8816 datasheet decisions
Read the MT8816 datasheet and fill in this table. It decides the supply voltage and the
control daughterboard version:

| Question | Answer | Consequence |
|---|---|---|
| Maximum VDD | ____ | Choose `MT_VDD` with margin. My suggestion is **9 V from a 78L09 regulator** fed by 12V_SYS, instead of the raw 12 V. |
| Logic-high threshold at that VDD | ____ | About 2–2.4 V (TTL-compatible) → **control v1** (5 V logic). About 0.7 × VDD → **control v2** (level shifters up to MT_VDD). |
| X address table | ____ | As I remember, it isn't in order (X6–X11 and X12–X13 are swapped around). The firmware needs the real table. |
| CS polarity | ____ | Tie CS to its "selected" level on both chips. |
| RESET polarity | ____ | Pull RESET to its "reset" level by default (EFR6). |
| Maximum current per switch / per chip | ____ | Must be at least 12 mA per switch (ENFR6). |

## Adds (all soldered now)
| Part | Qty | Notes |
|---|---|---|
| Perfboard 150 × 150 mm | 1 | |
| DIP-40 sockets | 2 | MT8816 A (bank A), B (bank B) |
| 2 × 19 female headers for ESP1 | 2 | 5 V pin unconnected (USB-powered) |
| 78L09 regulator + 0.33 µF / 0.1 µF | 1 | MT_VDD (if the datasheet allows 9 V) |
| Control daughterboard header (2 × 8) | 1 | The control circuit plugs in here (below) |
| IDC 2×5 headers | 6 + 1 | Node cables A1, A2, A3, B1, B2, B3 + power/control cable |
| Test-tool parts (used in CP06) | 2 × BAT85, 10 kΩ, 470 Ω, 470 Ω, 1 kΩ 1 %, 560 kΩ, 680 kΩ, 10 kΩ, 4.7 nF | Soldered now, so CP06 needs no soldering |
| Decoupling | 100 nF + 10 µF per MT8816; 100 nF on the daughterboard | |

## Matrix wiring
| MT8816 A | Connects to | MT8816 B | Connects to |
|---|---|---|---|
| X0–X3 | NODE00–03 (cable A1, pins 1/3/5/7) | X0–X3 | NODE11–14 (cable B1) |
| X4–X7 | NODE04–07 (cable A2) | X4–X7 | NODE15–18 (cable B2) |
| X8–X10 | NODE08–10 (cable A3, pins 1/3/5) | X8–X10 | NODE19–21 (cable B3) |
| X11 | SOURCE_HI: 3V3_SYS → BAT85 → 10 kΩ | X11–X15 | Not connected (reserved) |
| X12 | SOURCE_LO: 3V3_SYS → BAT85 → 470 Ω | | |
| X13 | SENSE: → 10 kΩ → 560 kΩ → XBAR_DIAG_ADC (IO36); 680 kΩ + 4.7 nF to GND | | |
| X14 | DISCHARGE: 470 Ω → GND | | |
| X15 | CAL: 1 kΩ 1 % → GND | | |
| Y0 | GND | Y0 | GND |
| Y1 | 5V_EDU (power/control cable pin 1) | Y1 | 5V_EDU |
| Y2–Y7 | BUS2–BUS7 | Y2–Y7 | **the same** BUS2–BUS7 (shared) |
| VDD / VSS / VEE | MT_VDD / GND / GND | | same |

## Control daughterboard v1 (if the MT8816 accepts 5 V logic)
```
ESP1 IO23 XBAR_DAT ──► 74HCT595 DS          Q0–Q3 → AX0–AX3   (both chips)
ESP1 IO18 XBAR_CLK ──► 74HCT595 SHCP        Q4–Q6 → AY0–AY2   (both chips)
ESP1 IO22 XBAR_LATCH ► 74HCT595 STCP        Q7    → DATA      (both chips)
ESP1 IO19 STB_A ─► 74HCT125 #1 ─► STROBE of MT8816 A (10 kΩ pull-down)
ESP1 IO21 STB_B ─► 74HCT125 #2 ─► STROBE of MT8816 B (10 kΩ pull-down)
ESP1 IO27 RST   ─► 74HCT125 #3 ─► RESET of both      (10 kΩ pull-up = reset by default)
74HCT125 OE# and 74HCT595 OE# = XBAR_BUF_OE_N (10 kΩ pull-up = disabled)
   pulled low by a BC547 whose base comes from ESP1 IO33 XBAR_ENABLE (100 kΩ pull-down)
```
This is the same safe-boot idea as PCBv2 sheet 06. Until ESP1 drives IO33 high, the
strobes are held low and RESET is held active, so **every switch is open** (EFR6). The
595 also does the level shifting, so the bus stays a 3-wire serial interface (EFR22).

**Control v2** (only if the MT8816 needs CMOS levels): the same pin header, but with
CD40109 level shifters up to MT_VDD and a CD4094 shift register powered from MT_VDD. It's
the same 2 × 8 header, so no change to the matrix board.

## ESP1 firmware (new)
A new sketch, `firmware/esp32/router/`, doesn't exist yet. It needs:
- MT8816 back-end: `connect(x, y)`, `disconnect(x, y)`, `clear()` (pulse RESET), with the
  real X address table.
- Serial commands: `route <node> gnd|5v|bus<n>`, `clear`, `rail on|off`, `status`, `fault`.
- Rail control: EDU_PWR_EN, EDU_FAULT, EDU_FAULT_RESET, EDU_CURRENT_ADC.
- Rules: always `clear()` before a new configuration (EFR4); configure everything before
  `rail on` (EFR7); drop the rail if the Pi stops sending a heartbeat (ENFR8).

## Build steps
1. Board: sockets, headers, regulator, IDC headers, tool parts, Y-line bus (one wire
   between the two sockets per Y line).
2. Power test with empty sockets.
3. Daughterboard: try it on a breadboard first, then solder it.
4. Remove the EN jumper from the power board (ESP1 now drives EDU_PWR_EN), unplug the
   dongle, and plug A1's node cable into the matrix board.
5. Plug in ESP1, the daughterboard, and MT8816 A. Leave socket B empty until CP08.

## Tests
| # | Test | Pass |
|---|---|---|
| 1 | Power off: MT_VDD, 5V_EDU, BUS lines to GND | No shorts |
| 2 | Empty sockets: VDD/VSS/VEE pins | MT_VDD / 0 / 0 V |
| 3 | Chips in, ESP1 **not** running (unplugged or held in reset) | NODE00–03 to GND and to 5V_EDU: all open (EFR6) |
| 4 | `route 0 5v`, `route 1 gnd` | NODE00 ↔ 5V_EDU and NODE01 ↔ GND, about Ron (tens of Ω); everything else open |
| 5 | `clear` | Everything open again (EFR4) |
| 6 | LED + 470 Ω circuit on A1, battery on columns 1–2: `route 0 5v`, `route 1 gnd`, `rail on` | LED lights (same as CP02, without the dongle) |
| 7 | Move the battery to columns 3–4: `clear`, `route 2 5v`, `route 3 gnd`, `rail on` | LED circuit moved to columns 3–4 lights |
| 8 | Reset ESP1 while the rail is on | Rail off and every switch open after the reset |
| 9 | Time a full `clear` + 22 `route` commands (ESP1 log) | ≤ 50 ms (EFR22) |
| 10 | Short across the battery columns while on | eFuse trips; `fault` reports it; `rail on` refused until the fault is reset |

## Done
- [ ] Datasheet table filled in
- [ ] Test log 1–10
- [ ] Power-board EN jumper removed and stored
- [ ] `fritzing/cp05-matrix-board.fzz` + netlist XML
