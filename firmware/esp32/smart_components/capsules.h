#pragma once
#include <Arduino.h>

#include "config.h"

// What a position is doing. The capsules are passive; the behaviour lives here.
enum class Mode : uint8_t { Off, Pulse, Volt, Amm, Gate, Mem };
enum class GateOp : uint8_t { And, Or, Nand, Nor, Xor, Not };
enum class MemKind : uint8_t { D, SR };  // D: P1 = D, P2 = clock (rising). SR: P1 = S, P2 = R.

struct Config {
  Mode mode = Mode::Off;
  float hz = 1.0f;     // pulse
  uint8_t duty = 50;   // pulse, %
  GateOp op = GateOp::And;
  MemKind mem = MemKind::D;
};

struct Live {
  float v1 = NAN, v2 = NAN;  // last V(P1), V(P2) to GND, volts
  float vdiff = NAN;         // published V(P1) - V(P2), 100 ms average
  float ma = NAN;            // ammeter, mA
  bool in1 = false, in2 = false, out = false;  // logic levels
  bool fault = false;        // ammeter over-current, PhotoMOS opened
};

// Copy handed to the display and to the serial stream.
struct PosView {
  Config cfg;
  Live live;
  bool found;    // OLED answered at 0x3C
  bool rail;
  uint32_t version;  // bumps whenever the screen content may have changed
};

namespace capsules {

void begin();  // loads calibration, starts the pulse task

// Returns nullptr on success, or an error message.
const char* configure(uint8_t p, const Config& c);

void setRail(bool on);
bool rail();

// Called from loop(): one pass over every position that senses P1/P2.
// Returns false when no position needs sensing.
bool senseRound();

PosView view(uint8_t p);
uint8_t activeCount();
void setFound(uint8_t p, bool found);

// From the I2C task.
void ammeterSample(float ma, bool ok);
// From the I2C task after a frame with `version` reached the OLED. Returns the
// time since the `set` command in us, or -1 when no configuration was pending.
int32_t frameShown(uint8_t p, uint32_t version);

void setSettleUs(uint32_t us);
uint32_t settleUs();
void setGains(uint8_t p, float g1, float g2);

const char* modeName(Mode m);
void printStatus(Print& out);
void printStream(Print& out);

}  // namespace capsules
