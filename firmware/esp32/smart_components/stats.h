#pragma once
#include <Arduino.h>

// Min / avg / max of a duration in microseconds.
struct Timing {
  uint32_t n = 0;
  uint32_t mn = UINT32_MAX;
  uint32_t mx = 0;
  uint64_t sum = 0;

  void add(uint32_t v) {
    n++;
    sum += v;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  float avg() const { return n ? (float)sum / n : 0.0f; }
  void print(Print& out, const char* name) const {
    if (!n) {
      out.printf("  %-26s (no samples)\n", name);
      return;
    }
    out.printf("  %-26s n=%-7lu min=%-8lu avg=%-10.1f max=%lu us\n", name, (unsigned long)n,
               (unsigned long)mn, avg(), (unsigned long)mx);
  }
};

struct Stats {
  Timing shiftCommit;   // 16-bit shift + latch of the 595 chain
  Timing pulseEdgeErr;  // real P3 edge time - ideal edge time
  Timing senseRound;    // one pass over every sensing position (= gate latency bound)
  Timing posRead;       // mux select + settle + ADC averaging, one position
  Timing zeroRead;      // GND channel auto-zero
  Timing busSwitch;     // move the I2C bus to another SDA line
  Timing probe;         // switch + address probe of one position
  Timing inaRead;       // INA219 shunt register read
  Timing oledRender;    // draw into the RAM buffer (CPU only)
  Timing oledFull;      // full frame transfer
  Timing oledPartial;   // value-only transfer (4 of 8 pages)
  Timing configToFrame; // `set` command -> first OLED frame of the new mode
};

extern Stats g_stats;
