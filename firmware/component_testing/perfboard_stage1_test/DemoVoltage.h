#pragma once

// Demonstration model: 5 V supply, 1 kΩ resistor, 250 Ω buzzer and
// ideal LED (2 V forward drop), all in series. This is not a reading.
inline float demoResistorVoltage(bool enabled) {
  if (!enabled) return 0.0f;
  constexpr float supply = 5.0f;
  constexpr float resistor = 1000.0f;
  constexpr float buzzer = 250.0f;
  constexpr float ledForward = 2.0f;
  const float current = supply > ledForward ? (supply - ledForward) / (resistor + buzzer) : 0.0f;
  return current * resistor;
}
