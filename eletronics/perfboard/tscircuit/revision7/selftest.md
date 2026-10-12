# Revision 7 firmware self-test contract

**Purpose:** one text interface per ESP32 so a board can be tested alone, with a multimeter and bench supply, and every result is a log line you can paste into the acceptance record. This is a **contract only**; the team writes the firmware (see `firmware.md` for ownership). Nothing here is implemented or measured.

Keep the revision 5/6 GPIO map and safety sequence unchanged. The self-test is an extra, USB-serial-only mode. It never replaces OFF → clear → configure → precheck → fresh acknowledgements → READY → explicit enable.

## Transport

- 115200 8N1 over the DevKit USB serial, line based, `\n` terminated. One command per line, upper case.
- Reply: one or more `PASS <name> <value> <expected>` or `FAIL <name> <value> <expected>` lines, then `DONE <command>`. Unknown command: `ERR unknown`.
- Boot banner: `BOOT <controller> <firmware-revision> <profile>`. `controller` is `ESP1` (router) or `ESP2` (smart). `profile` is `final` or `early` (standalone fixture).
- Every `FAIL` also lights nothing and changes nothing. The log is the evidence; the operator decides.

## Safety rules (hard)

1. At boot and after any reset every output is OFF or high-impedance. `EDU_PWR_EN` (ESP1 GPIO32), `RESET_RELEASE` (GPIO27), stimulus (GPIO25) and all strobes are LOW.
2. `GPIO`, `MT` and `RAIL ON` commands are refused until `ARM` has been sent in this session. `ARM` expires after 60 s without a command and on any reset or heartbeat fault.
3. `RAIL ON` additionally requires: `FAULT?` reports clear, heartbeat running, and a loaded-current limit argument. It never restores power after a fault, reset or reconnect.
4. A fourth active position, an invalid route or a stale session is rejected exactly as in normal mode.
5. Heartbeat edges every 50 ms only while the session is fresh. `HB OFF` stops them so the hardware watchdog (expiry 200–350 ms) can be observed on the scope.

## Commands

| Command | ESP | What it does | Output |
|---|---|---|---|
| `PING` | both | Liveness | `PASS ping ok ok` |
| `VER` | both | Firmware revision, profile, DevKit pinout version | `PASS ver <rev> <rev>` |
| `ARM` / `DISARM` | both | Enable or disable the active commands below | `PASS arm on on` |
| `RAILS` | ESP1 | Reads GPIO36 diagnostic ADC and GPIO34 current-sense ADC, GPIO35 fault pin | `PASS diag_adc <mV> <range>` … |
| `FAULT?` | ESP1 | Reads isolated fault (GPIO35) | `PASS fault clear clear` or `FAIL fault latched clear` |
| `FAULT CLEAR` | ESP1 | Pulses fault reset (GPIO17) once | `PASS fault_clear done done` |
| `HB ON` / `HB OFF` | both | Starts or stops the 50 ms heartbeat (ESP1 GPIO33, ESP2 GPIO13) | `PASS hb <state> <state>` |
| `GPIO <n> 0\|1\|Z` | both | Drives or releases one output pin from a fixed allow-list (below) | `PASS gpio <n>=<v> <v>` |
| `I2C SCAN` | both | Scans the bus the controller owns | `PASS i2c <addr list> <expected list>` |
| `SPI LOOP` | ESP1 | Clocks a known byte pattern through the 74HCT595 chain and reads back `QH_SER` if wired | `PASS spi <bytes> <bytes>` |
| `MT SET <x> <y> <0\|1>` | ESP1 | Writes one MT8816 crosspoint with strobe timing ≤50 ms | `PASS mt <x,y>=<v> <v>` |
| `MT CLEAR` | ESP1 | Pulses MT reset path, clears all crosspoints | `PASS mt_clear done done` |
| `MT SWEEP` | ESP1 | Sets each of the 128 crosspoints in turn with only the diagnostic tool connected and reads the diagnostic buffer | `PASS mt_sweep <n_ok>/128 128/128` |
| `RAIL ON <mA>` | ESP1 | Raises `EDU_PWR_EN` only if rules 2–3 hold; `<mA>` is the supervised load limit | `PASS rail on on` |
| `RAIL OFF` | ESP1 | Drops `EDU_PWR_EN` | `PASS rail off off` |
| `RESULT` | both | Prints a one-line summary of the session: counts of PASS and FAIL | `DONE result pass=<n> fail=<n>` |

`GPIO` allow-list: ESP1 17, 25, 27, 32 (32 only through `RAIL ON`); ESP2 25, 26, 27 (register clock, latch, data) and the mux selects 32, 33, 14, 23. No other pin can be driven.

Expected I2C addresses: ESP1 fixed fixture bus `0x48` (ADS1115) and `0x3C` (OLED); ESP2 per position `0x40` (INA226), `0x3C` (OLED), bank ADC `0x48` on positions 0 and 3. An INA226 or ADS1115 reply is **not** capsule presence.

## Bring-up sequences (pass tables)

Each sequence is run on the **board alone**, powered from the current-limited bench supply, with the test-point and LED states listed in `bringup-pass-tables.pdf`. Record the log filename in the acceptance record.

1. **Power board** (no ESP): rail LEDs, test-point voltages and unpowered resistances only (see `bringup-pass-tables.pdf`). The student rail stays OFF.
2. **Router controller (ESP1) alone:** `PING`, `VER`, `RAILS`, `FAULT?`, `HB ON`, `I2C SCAN` (fixture bus), then `HB OFF` and watch `ROUTER_ALIVE` fall in 200–350 ms on the scope.
3. **Router with matrix:** `ARM`, `MT CLEAR`, `SPI LOOP`, `MT SWEEP`.
4. **Power + router:** `RAIL ON 12` with the 1 kΩ and 470 Ω loads (stays on), then 330 Ω and 100 Ω (trips and latches); `FAULT?` must read latched until `FAULT CLEAR`.
5. **Smart controller (ESP2):** `PING`, `VER`, `HB ON`, `I2C SCAN` per position, register pattern through the three 74HCT595 with outputs disabled.
6. **Contacts and positions:** run the position pass table once per position.

## What to implement first

`PING`, `VER`, `RAILS`, `FAULT?`, `I2C SCAN` and `HB ON/OFF` cover most of the power and router bring-up. Add `MT` and `SPI` next, then the position tests.

## Not covered

Continuity classification, voltage and current calibration, pulse timing, gates and NFC keep their own acceptance tests in `acceptance-template.json`. This interface only proves the board is alive, wired as drawn, and fails safe.
