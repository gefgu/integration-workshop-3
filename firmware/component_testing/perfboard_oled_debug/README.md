# Perfboard — OLED diagnostic over USB

Independent diagnostic sketch for blank screens on the current soldered ESP32 board. Uses the confirmed OLED0…5 SDA map: GPIO4,16,18,17,19,21; shared SCL22. Does not run joystick, NFC, UART or pulse outputs.

## Run

1. Disconnect power before changing wiring. For initial fault isolation, connect one OLED on OLED0; for the cycling test, use the connected modules across the six ports, checking the names on the module against the board's 3V3/GND/SCL/SDA connector order. Module pin order may differ.
2. Keep the external supply disconnected and JP_EXT open; no external 5V on VIN. Power/program through computer USB.
3. Upload `perfboard_oled_debug.ino` as **ESP32 Dev Module**. Requires Adafruit SSD1306 and Adafruit GFX Library, as in the previous tests.
4. Open Serial Monitor at **115200 baud**. It continuously visits OLED0 → OLED1 → OLED2 → OLED3 → OLED4 → OLED5, pausing 750 ms after each port. A complete cycle prints a summary, so it is fine to open the monitor after startup. Press EN/reset if necessary.
5. Copy one complete block from `=== OLED DEBUG` through `SUMMARY`, including the messages below each slot.

All six paths are visited automatically, including empty ports. On every connected OLED it finds at 0x3C/0x3D, it attempts a brief white flash, then displays its OLED number, GPIOs, address, cycle number and moving block. No Serial commands are required. Empty ports are skipped after their diagnostic probe. Each detected screen retains its last image while the other ports are visited; its cycle counter and moving block change on the next pass. The full cycle takes at least 4.5 s, plus probing/drawing and the first white-flash initialization. Both probing and drawing use 50 kHz for this diagnostic; the previous standalone test uses 100 kHz.

## Interpret

| Output | Meaning / next check |
|---|---|
| `Wire.begin FAILED` | ESP32 I2C initialization failed for that port. |
| `idle SDA=1 SCL=1` | Lines currently read high; does not measure voltage or prove adequate pull-ups. |
| `LINE LOW` | A line reads low. On an empty/unpowered port SDA may float; on the connected port check power, pin order and shorts. Shared SCL low can affect all screens. |
| `NO ACK (2)` at both addresses | No responding OLED found there. Check actual 3.3 V at OLED VCC/GND, SDA, SCL and correct module pin order. |
| `TIMEOUT (5)` | Bus did not complete the probe within 25 ms; check stuck lines/wiring. |
| `ACK (0)` but blank | I2C responds, but pixel operation is unconfirmed. Check OLED type (SSD1306 vs SH1106), 128×64 vs128×32 and module supply. |
| `FRAMEBUFFER FAILED` | Library RAM allocation failed; unrelated to proof of physical connection. |
| `Post-frame probe: ACK` | Address still responds after attempted drawing; does not verify each image transfer or the pixels. |

A reading on an unused SDA is not a fault diagnosis. Firmware cannot measure the 3.3 V supply or verify solder joints. Use a multimeter to measure VCC/GND **at the OLED module**, not just at the ESP32, if every port reports no ACK. Expected supply for this board is approximately 3.3 V. Do not use resistance/continuity mode on a powered board.

## Optional single-character commands

- `s`: repeat the quick OLED-address scan.
- `f`: scan addresses 0x08…0x77 on the selected ports; prints other ACK addresses but does not initialize them as OLEDs. Aborts a port's full scan on timeout.
- `0`…`5`: focus on that one physical OLED port and repeat only its test.
- `a`: return to automatic cycling through all six ports.

Newline/CR from Serial Monitor is ignored. Power down before moving cables.

## Verification

Compiled successfully for `esp32:esp32:esp32` with ESP32 core 3.3.12 and the Arduino IDE bundled CLI 1.5.1. Compile result and hardware qualification are recorded separately. Upload and physical testing remain to be performed by the user. Successful compilation does not qualify supply, wiring, shared SCL loading or display compatibility.
