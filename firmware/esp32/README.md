# ESP32 firmware — smart components

`smart_components/` is an Arduino sketch for the base-side ESP32 that runs the
passive smart capsules on the 6 positions of schematic
`SCH_TedTronics_2026-10-04(6)`, including the review fixes (SR_OE_N on IO13,
SDA_0 on IO4, INA219 on SDA_2).

| Capsule | Requirement | How it works |
|---|---|---|
| Pulse source | EFR32.2 | 1 ms FreeRTOS tick toggles the DRV bit of the position in the 595 chain; the 74HCT125 drives P3 |
| Voltmeter | EFR32.3, SFR10 | mux → divider → ADC for P1 and P2; V(P1) − V(P2) averaged and published every 100 ms |
| Ammeter | EFR32.4 | position 2 only: AMM_EN closes the AQW212, the INA219 reads the 10 Ω shunt; opens above 15 mA |
| Logic gate | EFR32.1 | P1/P2 read as logic (hysteresis 1.0 / 2.0 V), result on P3 |
| 1-bit memory | EFR32.5 | D flip-flop (P1 = D, P2 = clock) or SR latch (P1 = S, P2 = R), Q on P3 |
| OLED (pt-BR) | EFR31.x | one SSD1306 per capsule, detected at 0x3C on its own SDA line |

At most 3 positions can be active (`set` refuses a 4th), and P3 is high-Z
whenever a position is not driving (EFR28).

## Install (Arduino IDE 2)

1. **File → Preferences → Additional boards manager URLs:**
   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
2. **Boards Manager:** install **esp32 by Espressif** 3.x (compiled with 3.3.12).
3. **Library Manager:** install **U8g2** (by olikraus).
4. Open `firmware/esp32/smart_components/smart_components.ino`.
5. **Board:** `ESP32 Dev Module`. Keep the defaults (240 MHz, 921600 upload).
6. Upload, then open the **Serial Monitor at 115200 baud** with **Newline** line ending.

## Testing with a bare ESP32 (no PCB)

Nothing needs to be wired. The firmware drives the real pins, and the I2C
devices simply don't answer.

```
sim on          # every position renders its screen (CPU only; nothing is sent to missing OLEDs)
demo mix        # pulse 10 Hz at 0, voltmeter at 1, ammeter at 2  (worst realistic load)
stream on       # live values every 100 ms (ADC pins float, so the numbers are noise)
stats           # after ~10 s: timings measured while everything runs
bench           # micro-benchmarks + estimates for the real I2C devices
demo gate       # AND at 0, XOR at 3, D memory at 5 -> check `stats` again
```

What each number means and what to compare it against:

| Measurement | Where | Limit to check |
|---|---|---|
| `pulse edge delay` max | `stats` | ≤ 5 % of the period (EFR32.2) → ≤ 5 ms at 10 Hz. Expect ~1 ms (1 ms tick) |
| `595 commit` | `stats`, `bench` | a few µs; it runs inside a critical section |
| `position read` / `sensing round` | `stats`, `bench` | voltmeter: ≥ 10 readings/s per position (SFR10); gate/memory: the round is the input → P3 delay |
| `set -> first frame` | printed after each `set` | ≤ 1 s (EFR31.x). With `sim on` and no OLED it excludes the ~15–29 ms transfer |
| `I2C bus switch` | `bench` | compare **GPIO matrix** (default) and **Wire.end/begin** |
| `OLED full frame` | `bench` | timed on the first position with a real OLED. **Without one, the transfer aborts on NACK and looks far too fast**; use the printed estimate (~29 ms at 400 kHz) |
| `bus busy` | `bench` | must stay well below 100 %, or the OLEDs fall behind |

### Adding real parts on a breadboard

| Part | Connect to | Then check |
|---|---|---|
| 1 OLED (VCC 3V3, GND, SCL → IO22, SDA → IO21) | position 1 | `scan` shows FOUND; `set 1 volt`; `bench` now measures real frame times |
| INA219 module (SCL IO22, SDA IO19) | position 2 | `set 2 amm`; `INA219 read` in `stats` |
| Pot between 3V3 and GND, wiper → IO34 | mux bypass | without the 4051 and divider, `stream` readings are only relative (wrong scale) |
| LED + 1k on IO25 / IO26 / IO27 | shift pins | blink when outputs change; with `demo mix` they flicker at the pulse rate |

## Pins (DevKitC 38-pin)

| Signal | GPIO | Signal | GPIO |
|---|---|---|---|
| ADC P1 / P2 | 34 / 35 | SR SRCLK / RCLK / SER | 25 / 26 / 27 |
| 4051 S0 / S1 / S2 (chip pins 11 / 10 / 9) | 14 / 33 / 32 | SR_OE_N | 13 |
| SCL | 22 | SDA_0 … SDA_5 | 4, 21, 19, 18, 17, 16 |

Mapping tables (all in `config.h`):

- 4051 channel per position: POS0 = Y5, POS1–POS5 = Y0–Y4, Y6 = GND (auto-zero).
- 595 bits: U4 Q0–Q5 = DRV of POS0–POS5, U4 Q6 = AMM_EN; U5 Q0–Q5 = OE_N of POS0–POS5.
- Boot: SR_OE_N high → shift U4 = 0x00, U5 = 0xFF → latch → SR_OE_N low.

## Commands

```
set <p> off | pulse <hz> <duty> | volt | amm | gate <and|or|nand|nor|xor|not> | mem <d|sr>
demo <mix|volt|gate|off>
rail <on|off>         firmware-only rail state (no rail gating hardware yet)
status | stream <on|off> | scan | stats [reset] | bench
sim <on|off> | settle <us> | i2c <hz> | i2cswitch <matrix|restart>
cal <p> <gain_p1> <gain_p2>
```

## Design notes

- **One I2C bus, six SDA lines.** By default the I2C0 SDA signal is moved to
  another pin through the GPIO matrix (µs). The other SDA pins are detached,
  so an OLED never sees frames meant for another position. `i2cswitch restart`
  uses `Wire.end()/begin()` instead, for comparison.
- **OLED traffic is the bottleneck.** A full SSD1306 frame takes about 29 ms at
  400 kHz. The firmware redraws only when the text changes, at most 5 frames/s
  per display, and sends only pages 2–5 (the value) when the title and footer
  are unchanged.
- **Calibration.** The GND channel (Y6) re-measures the divider offset every
  250 ms. `cal` stores a per-position gain in flash: measure a known voltage,
  then gain = real / shown.
- **Watchdog.** The loop, pulse and I2C tasks feed a 3 s task watchdog. After a
  reset, SR_OE_N floats high through its pull-up, so every P3 goes high-Z and
  the ammeter opens.
- **No rail gating hardware yet.** `rail off` only makes the firmware drop the
  outputs. The real rail switch must trigger the same call.

## Command-line build (optional)

`.toolchain/` (git-ignored, ~6.6 GB) holds arduino-cli with the esp32 core and U8g2:

```
.toolchain/arduino-cli --config-file .toolchain/cli.yaml compile -b esp32:esp32:esp32 smart_components
.toolchain/arduino-cli --config-file .toolchain/cli.yaml upload  -b esp32:esp32:esp32 -p /dev/ttyUSB0 smart_components
.toolchain/arduino-cli --config-file .toolchain/cli.yaml monitor -p /dev/ttyUSB0 -c baudrate=115200
```
