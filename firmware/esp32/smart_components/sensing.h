#pragma once
#include <Arduino.h>

#include "config.h"

// 2 x 74HCT4051 (U6 = P1, U7 = P2) with shared address lines, each followed by
// the 1M / 680k / 4.7M divider into IO34 / IO35.
namespace sensing {

struct Node {
  float mv1;  // IO34 (P1 path), mV at the ADC pin
  float mv2;  // IO35 (P2 path)
};

void begin();
void select(uint8_t channel);   // 0..7, same channel on both muxes
Node readNode(uint8_t samples);  // averages P1/P2 interleaved

inline float toVolts(float nodeMv, float zeroMv) { return (nodeMv - zeroMv) / (DIV_K * 1000.0f); }

void bench(Print& out, uint32_t settleUs);

}  // namespace sensing
