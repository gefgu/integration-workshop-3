# Three OLED shared-SCL test

This test drives three SSD1306 OLEDs, which may all have address `0x3C`, using one ESP32 I²C controller. Each screen has its own SDA connection; all three share the SCL connection. The sketch switches the controller's SDA pin before addressing each screen and updates them in sequence.

## Wiring (USB disconnected)

| OLED pin | Screen 1 | Screen 2 | Screen 3 |
| --- | --- | --- | --- |
| VCC | ESP32 3V3 | ESP32 3V3 | ESP32 3V3 |
| GND | ESP32 GND | ESP32 GND | ESP32 GND |
| SDA | D21 / GPIO21 | D19 / GPIO19 | D18 / GPIO18 |
| SCL | D22 / GPIO22 | D22 / GPIO22 | D22 / GPIO22 |

Connect all VCC pins to 3V3, all grounds to GND, and all SCL pins to the same D22 point. Keep the three SDA wires separate. Follow the labels printed on the OLED boards.

Use only the ESP32's 3V3 output for the OLEDs; do not connect OLED VCC to 5V. Start with USB disconnected, inspect for shorts, then power the ESP32 from one USB source. If the ESP32 resets, the 3V3 rail drops, or a module or regulator becomes warm, unplug USB and disconnect the displays. Do not connect another power supply at the same time.

## Run

In Arduino IDE select **ESP32 Dev Module**, install **Adafruit SSD1306** and **Adafruit GFX Library**, open `oled_three_screen_test.ino`, and upload. Each OLED identifies itself and its SDA pin, then its update counter advances in sequence. Open Serial Monitor at 115200 baud.
