#include <Arduino.h>

// Standalone 3.3 V breadboard test on the photographed classic ESP32.
// GPIO4 (D4) is ADC2: do not initialize Wi-Fi or the full smart-controller bus.
constexpr uint8_t ADC_PIN = 4;
constexpr uint32_t R_TOP_OHMS = 10000;
constexpr uint32_t R_BOTTOM_OHMS = 10000;
constexpr uint8_t SAMPLES = 32;
constexpr uint32_t REPORT_MS = 250;
uint32_t lastReport = 0;

void setup() {
  Serial.begin(115200);
  pinMode(ADC_PIN, INPUT);
  analogReadResolution(12);
  analogSetPinAttenuation(ADC_PIN, ADC_11db);
  delay(500);
  Serial.println("3.3 V LED/pogo voltage test. GPIO4/D4 input; Wi-Fi OFF.");
  Serial.println("A -> 10k -> S -> 10k -> GND; S -> D4.");
  Serial.println("3V3 -> fixed 1k -> A -> pogo -> test 1k -> pogo -> LED -> GND.");
  Serial.println("Node A is estimated from the divider; verify against a multimeter.");
}

void loop() {
  const uint32_t now = millis();
  if (now - lastReport < REPORT_MS) {
    delay(1);
    return;
  }
  lastReport = now;
  uint32_t rawSum = 0;
  uint32_t mvSum = 0;
  for (uint8_t i = 0; i < SAMPLES; ++i) {
    // These are separate conversions; raw and millivolt averages are diagnostic.
    rawSum += analogRead(ADC_PIN);
    mvSum += analogReadMilliVolts(ADC_PIN);
    delayMicroseconds(200);
  }
  const float adcMv = static_cast<float>(mvSum) / SAMPLES;
  const float nodeMv = adcMv * (R_TOP_OHMS + R_BOTTOM_OHMS) / R_BOTTOM_OHMS;
  Serial.printf("raw=%4lu  ADC=%.3f V  node_A=%.3f V\n",
                static_cast<unsigned long>(rawSum / SAMPLES),
                adcMv / 1000.0f, nodeMv / 1000.0f);
  if (adcMv > 1800) {
    Serial.println("Unexpected reading for this 3.3 V / 1:2-divider setup: unplug USB and check wiring.");
  }
}
