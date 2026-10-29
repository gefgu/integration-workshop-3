# Three-screen animation test

The sketch uses one ESP32 I²C controller, three independent SDA lines, and a shared SCL. All three OLEDs can have the same I²C address (`0x3C`) because the sketch selects one SDA line at a time.

## Wiring (USB disconnected)

| OLED pin | Screen 1: lyrics | Screen 2: dancer | Screen 3: TEDTronics |
| --- | --- | --- | --- |
| VCC | ESP32 3V3 | ESP32 3V3 | ESP32 3V3 |
| GND | ESP32 GND | ESP32 GND | ESP32 GND |
| SDA | D21 / GPIO21 | D19 / GPIO19 | D18 / GPIO18 |
| SCL | D22 / GPIO22 | D22 / GPIO22 | D22 / GPIO22 |

Join all three VCC pins to 3V3, all grounds to GND, and all SCL pins to the same D22 point. Keep the SDA wires separate. Check the module labels before applying power. Power the ESP32 from one USB source only; never connect OLED VCC to 5V. If the ESP32 resets, the 3V3 rail drops, or a module/regulator warms up, unplug USB and disconnect the screens.

## Behavior

- Screen 1 types through the six lyric lines supplied for this test.
- Screen 2 animates a simple dancing figure and music notes.
- Screen 3 types “TEDTronics is awesome!” and “TEDTronics is amazing!” in turn.

These OLED modules are monochrome blue displays, so the dancer is animated in one color. The emoji-like picture is drawn from simple shapes rather than a color emoji font.

## Upload

In Arduino IDE select **ESP32 Dev Module**, install **Adafruit SSD1306** and **Adafruit GFX Library**, open `oled_three_animation_test.ino`, and upload. Open Serial Monitor at 115200 baud. If the display bus is unreliable at 400 kHz, change `I2C_FREQUENCY` to `100000` and upload again.
