# Two-screen phrase swap test

This test independently updates two SSD1306 OLEDs that both use I²C address `0x3C`. It uses one ESP32 I²C controller, separate SDA wires, and a shared SCL wire. It types one full line onto screen 1, then the next line onto screen 2, alternating through the six supplied lines. The other screen keeps its previous line while the active screen is being written.

## Wiring (USB disconnected)

| OLED pin | Screen 1 | Screen 2 |
| --- | --- | --- |
| VCC | ESP32 3V3 | ESP32 3V3 |
| GND | ESP32 GND | ESP32 GND |
| SDA | D21 / GPIO21 | D19 / GPIO19 |
| SCL | D22 / GPIO22 | D22 / GPIO22 |

Keep the SDA wires separate and connect both SCL pins to the same D22 point. Check the labels printed on the OLED modules before powering them.

## Run

In Arduino IDE select **ESP32 Dev Module**, install **Adafruit SSD1306** and **Adafruit GFX Library**, open `oled_phrase_swap_test.ino`, and upload it. Open Serial Monitor at 115200 baud. The display wraps longer phrases onto a second line.
