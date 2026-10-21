# KY-023 joystick quick test — classic ESP32

## Test result and current requirement — 2026-10-21

Gustavo reported that the **HW-504 joystick worked with the ESP32 test sketch**. This is a user-reported functional result; no serial log, ADC range measurements, or independent verification was captured.

The interface only needs **left, right, up, and down**. Use the two analog axes to detect those four directions, with a neutral dead zone. Joystick click/press is not required. Physical direction-to-axis polarity remains dependent on the final mounting orientation.

The existing sketch also supports button diagnostics, but the reported result is recorded for directional navigation only. It does not qualify the click button, Wi-Fi coexistence, or integrated controller timing. The sketch's GPIO35 wiring and pull-up instructions below still apply while its button diagnostics are enabled.

## Test setup

Standalone Arduino sketch for the joystick interface agreed in `eletronics/perfboard/tscircuit/pi-controls/`. No external libraries or ADC module are needed. Uploading replaces the board's current firmware; use a standalone component-test setup, disconnected from the integrated controller's other hardware. The sketch reads these three inputs only and does not initialize Wi-Fi or the other peripherals.

## Wiring

Disconnect USB while wiring. Use the module's printed labels, not assumed header order.

| KY-023 | ESP32 |
| --- | --- |
| VCC (sometimes labeled +5V) | **3V3**, not 5 V |
| GND | GND |
| VRx | GPIO36 / VP |
| VRy | GPIO39 / VN |
| SW | GPIO35 |

Connect an **external 10 kΩ resistor between SW/GPIO35 and 3V3**. GPIO35 has no internal pull-up; `INPUT_PULLUP` cannot replace this resistor. GPIO numbers are not DevKit header positions. This mapping targets the classic ESP32, not ESP32-C3/S3 variants.

## Run in Arduino IDE

1. Install **esp32 by Espressif Systems** in Boards Manager if needed.
2. Open `joystick_test.ino`, select **ESP32 Dev Module** and your board's port, then upload.
3. Open Serial Monitor at **115200 baud**. Leave the stick centered during startup; press the board's reset button if you missed the startup messages.
4. Move the stick through both axes and press/release it. Both readings should change, return near their calibrated centers, and show `CENTER` inside the dead zone. Each click should increment `presses` once; holding it should not repeat.

Output arrives about ten times per second:

```text
X=2050 (CENTER)  Y=2010 (CENTER)  SW=released  presses=0  range X=2040..2060 Y=2000..2020
BUTTON PRESS #1
```

- Send **c** with the stick released to recalibrate its center.
- Send **r** to reset observed minimum/maximum readings, then sweep the full travel.
- `+` and `-` mean increasing/decreasing voltage. Physical left/right/up/down depend on mounting orientation.
- Raw ADC values are 0–4095. Full travel need not reach both endpoints, and readings can clip near the ends. Center need not be exactly 2048. This is a navigation check, not a calibrated voltage or position measurement.
- Change `DEAD_ZONE` (default 350 counts) if resting noise causes unwanted directions.
- The button uses a 20 ms debounce and ignores a button held at startup until released. A missing pull-up can cause unstable readings; a disconnected analog input can also produce plausible noise.

The startup center measurement blocks briefly; it is intended for this standalone test. This sketch does not demonstrate Wi-Fi coexistence, integrated timing, or any hardware safety release.

## Optional command-line build

From `firmware/esp32`, using the existing local toolchain:

```sh
.toolchain/arduino-cli --config-file .toolchain/cli.yaml compile -b esp32:esp32:esp32 ../component_testing/joystick_test
```

Upload through Arduino IDE, or use the CLI with the actual serial port. Compilation is a software check; moving the real stick and checking the serial output is still required.
