# ESP32 OLED component test

This sketch tests a 0.96-inch 128×64 SSD1306 I²C OLED on the ESP32 DevKit V1.

## Wiring

Connect with USB power disconnected, following the labels on the OLED module:

| OLED | ESP32 DevKit V1 |
| --- | --- |
| VCC | 3V3 |
| GND | GND |
| SDA | D21 / GPIO21 |
| SCL | D22 / GPIO22 |

Reconnect USB after checking the wiring. The sketch uses I²C address `0x3C`.

## Arduino IDE

1. Select the ESP32 Dev Module board and the serial port for the ESP32.
2. Install **Adafruit SSD1306** and **Adafruit GFX Library** from Library Manager.
3. Open `oled_test.ino`, upload it, and open Serial Monitor at 115200 baud.
4. The OLED should show “Never gonna” and “give you up” on two lines.

If the display is blank, check the four module pin labels and wiring first. Some modules use a different I²C address; this sketch reports if it cannot initialize `0x3C`.
