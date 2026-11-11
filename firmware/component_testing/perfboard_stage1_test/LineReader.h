#pragma once

#include <stddef.h>

// Keep custom parameter types in a header so Arduino-generated function
// prototypes can see them before the sketch's function definitions.
struct LineReader {
  char data[96];
  size_t length = 0;
  bool discard = false;
};

#include <stdint.h>

struct Button {
  uint8_t pin;
  bool stable = false, raw = false, armed = false;
  uint32_t changedAt = 0, pressedAt = 0;
  explicit Button(uint8_t p) : pin(p) {}
};
