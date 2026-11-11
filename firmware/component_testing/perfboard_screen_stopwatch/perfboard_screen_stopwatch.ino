#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// OLED0..5: D4, RX2, D18, TX2, D19, D21. All screens share D22 as SCL.
constexpr uint8_t SDA_PINS[] = {4, 16, 18, 17, 19, 21};
constexpr uint8_t SCL_PIN = 22;
constexpr uint32_t I2C_HZ = 100000;
constexpr uint8_t WIDTH = 128, HEIGHT = 64; // Change to 32 for 128x32 screens.
Adafruit_SSD1306 oled(WIDTH, HEIGHT, &Wire, -1, I2C_HZ, I2C_HZ);
uint8_t slot = 0;
uint32_t lastUpdate = 0;
bool busStarted = false;

void releaseBus() {
  if (busStarted) Wire.end();
  busStarted = false;
  for (uint8_t pin : SDA_PINS) pinMode(pin, INPUT);
  pinMode(SCL_PIN, INPUT);
}

bool ack(uint8_t address) {
  Wire.beginTransmission(address);
  return Wire.endTransmission() == 0;
}

void updateScreen(uint8_t index) {
  releaseBus();
  if (!Wire.begin(SDA_PINS[index], SCL_PIN, I2C_HZ)) {
    Serial.printf("OLED%u: I2C start failed\n", index);
    return;
  }
  busStarted = true;
  Wire.setTimeOut(25);
  const uint8_t address = ack(0x3C) ? 0x3C : (ack(0x3D) ? 0x3D : 0);
  if (!address) {
    Serial.printf("OLED%u GPIO%u: no response\n", index, SDA_PINS[index]);
    releaseBus();
    return;
  }
  // Initialise on the selected bus, including when a screen has a different address.
  if (!oled.begin(SSD1306_SWITCHCAPVCC, address, false, false)) {
    Serial.printf("OLED%u: display init failed\n", index);
    releaseBus();
    return;
  }
  const uint32_t seconds = millis() / 1000;
  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);
  oled.setTextSize(1);
  oled.setCursor(0, 0);
  oled.printf("OLED%u  SDA GPIO%u", index, SDA_PINS[index]);
  oled.setTextSize(2);
  oled.setCursor(0, 18);
  oled.printf("%02lu:%02lu:%02lu", (unsigned long)(seconds / 3600),
              (unsigned long)((seconds / 60) % 60), (unsigned long)(seconds % 60));
  oled.display();
  Serial.printf("OLED%u updated: %lu seconds\n", index, (unsigned long)seconds);
  releaseBus();
}

void setup() {
  Serial.begin(115200);
  releaseBus();
  Serial.println("OLED stopwatch: updating one screen per second.");
  lastUpdate = millis() - 1000;
}

void loop() {
  if (millis() - lastUpdate >= 1000) {
    lastUpdate = millis();
    updateScreen(slot);
    slot = (slot + 1) % 6;
  }
}
