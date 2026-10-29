# Two OLEDs with shared SCL test

This test gives each SSD1306 its own SDA line while both screens share GPIO22 (SCL). Both modules may use address `0x3C`: the ESP32 uses one I²C controller and switches its SDA pin before sending data to each screen.

## Wire with ESP32 USB disconnected

| OLED pin | Screen 1 | Screen 2 |
| --- | --- | --- |
| VCC | ESP32 3V3 | ESP32 3V3 |
| GND | ESP32 GND | ESP32 GND |
| SDA | D21 / GPIO21 | D19 / GPIO19 |
| SCL | D22 / GPIO22 | D22 / GPIO22 |

Join both VCC pins to 3V3, both GND pins to GND, and both SCL pins to the same D22 connection. Keep the two SDA connections separate. Follow the pin labels printed on the OLED boards; do not rely on header order. Reconnect USB only after checking the wiring.

## Run

In Arduino IDE select **ESP32 Dev Module**, install **Adafruit SSD1306** and **Adafruit GFX Library**, then open and upload `oled_shared_scl_test.ino`. Both screens should display their own SDA pin and confirm the shared clock. Open Serial Monitor at 115200 baud.

If both displays work independently, the shared-SCL arrangement works on this setup. The SDA wires must stay separate. Do not use two I²C controllers on the same SCL pin for this test; the sketch switches one controller between the two SDA pins.
