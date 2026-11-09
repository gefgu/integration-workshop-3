#pragma once

#include <stddef.h>

// Keep custom parameter types in a header so Arduino-generated function
// prototypes can see them before the sketch's function definitions.
struct LineReader {
  char data[96];
  size_t length = 0;
  bool discard = false;
};
