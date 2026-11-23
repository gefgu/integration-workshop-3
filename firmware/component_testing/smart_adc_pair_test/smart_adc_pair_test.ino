// Upload to the smart-components ESP32. Open Serial Monitor at 115200 baud.
// Connect P1 and P2 to opposite ends of the powered resistor through their
// separate 4.7 kΩ / 4.7 kΩ dividers. Use a common GND and 0–3.3 V probe inputs.
// Both probes on GND should read near zero. Swapping them reverses the sign.
constexpr uint8_t probe1Pin = 34;
constexpr uint8_t probe2Pin = 35;
constexpr unsigned sampleCount = 32;
constexpr float dividerGain = 2.0f;

float averageMillivolts(uint8_t pin) {
  analogReadMilliVolts(pin);  // Discard the first conversion after switching pins.
  uint32_t total = 0;
  for (unsigned sample = 0; sample < sampleCount; ++sample) {
    total += analogReadMilliVolts(pin);
    delayMicroseconds(200);
  }
  return static_cast<float>(total) / sampleCount;
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  analogSetPinAttenuation(probe1Pin, ADC_11db);
  analogSetPinAttenuation(probe2Pin, ADC_11db);
  Serial.println("ADC test ready: P1 on GPIO34, P2 on GPIO35");
}

void loop() {
  const float adc1Mv = averageMillivolts(probe1Pin);
  const float adc2Mv = averageMillivolts(probe2Pin);
  const float probe1V = adc1Mv * dividerGain / 1000.0f;
  const float probe2V = adc2Mv * dividerGain / 1000.0f;

  Serial.printf("GPIO34: %.0f mV | GPIO35: %.0f mV | P1: %.3f V | P2: %.3f V | P1-P2: %+.3f V\n",
                adc1Mv, adc2Mv, probe1V, probe2V, probe1V - probe2V);
  delay(500);
}
