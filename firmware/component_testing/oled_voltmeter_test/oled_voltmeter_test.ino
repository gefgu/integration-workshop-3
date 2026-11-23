#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

constexpr int oledSda = 21;
constexpr int oledScl = 22;
constexpr uint8_t oledAddress = 0x3C;
constexpr int p1Adc = 34;
constexpr int p2Adc = 35;
constexpr float dividerGain = 2.5f;  // 15 kΩ em série e 10 kΩ para GND.
constexpr int samples = 16;

Adafruit_SSD1306 display(128, 64, &Wire, -1);

float readNodeVolts(int pin) {
  uint32_t sum = 0;
  for (int i = 0; i < samples; ++i) {
    sum += analogReadMilliVolts(pin);
    delayMicroseconds(200);
  }
  return sum * dividerGain / (samples * 1000.0f);
}

void setup() {
  Serial.begin(115200);
  Wire.begin(oledSda, oledScl);
  if (!display.begin(SSD1306_SWITCHCAPVCC, oledAddress)) {
    Serial.println("OLED 0x3C nao encontrada. Confira SDA e SCL.");
    while (true) delay(1000);
  }
  analogReadResolution(12);
  // 5 V no nó correspondem a 2 V na entrada do ADC.
  analogSetPinAttenuation(p1Adc, ADC_11db);
  analogSetPinAttenuation(p2Adc, ADC_11db);
  display.setTextColor(SSD1306_WHITE);
}

void loop() {
  const float p1 = readNodeVolts(p1Adc);
  const float p2 = readNodeVolts(p2Adc);

  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print("P1 - P2");
  display.setTextSize(2);
  display.setCursor(0, 17);
  display.print(p1 - p2, 2);
  display.print(" V");
  display.setTextSize(1);
  display.setCursor(0, 48);
  display.print("P1 ");
  display.print(p1, 2);
  display.print("  P2 ");
  display.print(p2, 2);
  display.display();
  delay(200);
}
