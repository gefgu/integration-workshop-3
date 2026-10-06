#pragma once
#include <Arduino.h>

// 74HCT595 chain: SER -> U4 -> U4 Q7S -> U5.
//   bit 0..5  = U4 Q0..Q5 = DRV1..DRV6 -> 74HCT125 input of POS0..POS5
//   bit 6     = U4 Q6     = AMM_EN (AQW212 LED, POS2 shunt in series)
//   bit 8..13 = U5 Q0..Q5 = OE_N1..OE_N6 -> 74HCT125 OE# of POS0..POS5 (1 = P3 high-Z)
namespace outputs {

constexpr uint16_t SAFE_IMAGE = 0xFF00;  // U5 = 0xFF (all P3 high-Z), U4 = 0x00
constexpr uint16_t AMM_BIT = 1u << 6;
constexpr uint16_t drvBit(uint8_t p) { return (uint16_t)(1u << p); }
constexpr uint16_t oenBit(uint8_t p) { return (uint16_t)(1u << (8 + p)); }

// Loads SAFE_IMAGE while SR_OE_N is still high, then enables the 595 outputs.
void begin();

// image = (image & ~mask) | (value & mask); shifts and latches only if it changed.
// Safe to call from any task / core.
bool apply(uint16_t mask, uint16_t value);

uint16_t image();
uint32_t commits();

void bench(Print& out);

}  // namespace outputs
