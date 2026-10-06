#include "capsules.h"

#include <Preferences.h>
#include <esp_task_wdt.h>
#include <esp_timer.h>

#include "outputs.h"
#include "sensing.h"
#include "stats.h"

namespace capsules {
namespace {

struct Slot {
  Config cfg;
  Live live;
  bool found = false;
  uint32_t version = 0;
  // pulse
  int64_t t0 = 0;
  uint32_t periodUs = 1000000, highUs = 500000;
  bool pulseHi = false;
  // memory
  bool lastClk = true;  // no edge on the first read
  // voltmeter average
  float acc = 0;
  uint32_t accN = 0;
  // calibration (gain per input)
  float g1 = 1.0f, g2 = 1.0f;
  // `set` -> first frame latency
  bool cfgPending = false;
  int64_t cfgT0 = 0;
  uint32_t cfgVersion = 0;
};

Slot slots[NUM_POS];
portMUX_TYPE lock = portMUX_INITIALIZER_UNLOCKED;
volatile bool railOn = true;
uint32_t settle = MUX_SETTLE_US_DEFAULT;
float zero1 = DIV_Z_MV, zero2 = DIV_Z_MV;
int64_t lastZeroUs = 0, lastPublishUs = 0;
Preferences prefs;

bool drivesP3(Mode m) { return m == Mode::Pulse || m == Mode::Gate || m == Mode::Mem; }
bool sensesInputs(Mode m) { return m == Mode::Volt || m == Mode::Gate || m == Mode::Mem; }

bool logicLevel(bool prev, float v) {
  if (v >= LOGIC_HIGH_V) return true;
  if (v <= LOGIC_LOW_V) return false;
  return prev;  // in the hysteresis band (or NaN)
}

bool evalGate(GateOp op, bool a, bool b) {
  switch (op) {
    case GateOp::And: return a && b;
    case GateOp::Or: return a || b;
    case GateOp::Nand: return !(a && b);
    case GateOp::Nor: return !(a || b);
    case GateOp::Xor: return a != b;
    case GateOp::Not: return !a;
  }
  return false;
}

// Pushes OE / DRV / AMM_EN for one position according to its mode and the rail.
void applyOutputs(uint8_t p) {
  portENTER_CRITICAL(&lock);
  const Mode m = slots[p].cfg.mode;
  const bool fault = slots[p].live.fault;
  portEXIT_CRITICAL(&lock);

  uint16_t mask = outputs::drvBit(p) | outputs::oenBit(p);
  uint16_t val = outputs::oenBit(p);  // P3 high-Z, DRV low (EFR28)
  if (p == AMMETER_POS) mask |= outputs::AMM_BIT;
  if (railOn) {
    if (drivesP3(m)) val &= ~outputs::oenBit(p);
    if (m == Mode::Amm && !fault) val |= outputs::AMM_BIT;
  }
  outputs::apply(mask, val);
}

// 1 ms tick: recompute every pulse output and shift once if any changed.
void pulseTask(void*) {
  esp_task_wdt_add(nullptr);
  TickType_t last = xTaskGetTickCount();
  uint32_t ticks = 0;
  for (;;) {
    vTaskDelayUntil(&last, 1);
    if ((++ticks & 0x3F) == 0) esp_task_wdt_reset();

    const int64_t now = esp_timer_get_time();
    uint16_t mask = 0, val = 0;
    uint32_t err[NUM_POS];
    uint8_t nErr = 0;
    portENTER_CRITICAL(&lock);
    if (railOn) {
      for (uint8_t p = 0; p < NUM_POS; ++p) {
        Slot& s = slots[p];
        if (s.cfg.mode != Mode::Pulse) continue;
        const uint32_t phase = (uint32_t)((now - s.t0) % s.periodUs);
        const bool hi = phase < s.highUs;
        if (hi != s.pulseHi) {
          // How late we are relative to the ideal edge.
          err[nErr++] = hi ? phase : phase - s.highUs;
          s.pulseHi = hi;
        }
        mask |= outputs::drvBit(p);
        if (hi) val |= outputs::drvBit(p);
      }
    }
    portEXIT_CRITICAL(&lock);

    if (mask) outputs::apply(mask, val);
    const uint32_t shiftDone = (uint32_t)(esp_timer_get_time() - now);
    for (uint8_t i = 0; i < nErr; ++i) g_stats.pulseEdgeErr.add(err[i] + shiftDone);
  }
}

}  // namespace

void begin() {
  prefs.begin("tt-cal", false);
  char key[8];
  for (uint8_t p = 0; p < NUM_POS; ++p) {
    snprintf(key, sizeof key, "g%ua", p);
    slots[p].g1 = prefs.getFloat(key, 1.0f);
    snprintf(key, sizeof key, "g%ub", p);
    slots[p].g2 = prefs.getFloat(key, 1.0f);
  }
  xTaskCreatePinnedToCore(pulseTask, "pulse", 3072, nullptr, 10, nullptr, 0);
}

const char* configure(uint8_t p, const Config& c) {
  if (p >= NUM_POS) return "position must be 0..5";
  if (c.mode == Mode::Amm && p != AMMETER_POS) return "the ammeter only exists at position 2";
  if (c.mode == Mode::Pulse) {
    if (c.hz < PULSE_HZ_MIN || c.hz > PULSE_HZ_MAX) return "frequency must be 0.5..10 Hz";
    if (c.duty < PULSE_DUTY_MIN || c.duty > PULSE_DUTY_MAX) return "duty must be 25..75 %";
  }

  const int64_t now = esp_timer_get_time();
  portENTER_CRITICAL(&lock);
  uint8_t others = 0;
  for (uint8_t q = 0; q < NUM_POS; ++q)
    if (q != p && slots[q].cfg.mode != Mode::Off) others++;
  if (c.mode != Mode::Off && others >= MAX_ACTIVE) {
    portEXIT_CRITICAL(&lock);
    return "3 positions are already active";
  }
  Slot& s = slots[p];
  s.cfg = c;
  s.live = Live();
  s.pulseHi = false;
  s.lastClk = true;
  s.acc = 0;
  s.accN = 0;
  if (c.mode == Mode::Pulse) {
    s.periodUs = (uint32_t)(1e6f / c.hz);
    s.highUs = s.periodUs * c.duty / 100;
    s.t0 = now;
  }
  s.version++;
  s.cfgPending = true;
  s.cfgT0 = now;
  s.cfgVersion = s.version;
  portEXIT_CRITICAL(&lock);

  applyOutputs(p);
  return nullptr;
}

void setRail(bool on) {
  railOn = on;
  for (uint8_t p = 0; p < NUM_POS; ++p) {
    applyOutputs(p);
    portENTER_CRITICAL(&lock);
    slots[p].version++;
    portEXIT_CRITICAL(&lock);
  }
}

bool rail() { return railOn; }

bool senseRound() {
  uint8_t list[NUM_POS];
  Mode modes[NUM_POS];
  uint8_t n = 0;
  portENTER_CRITICAL(&lock);
  for (uint8_t p = 0; p < NUM_POS; ++p) {
    if (sensesInputs(slots[p].cfg.mode)) {
      list[n] = p;
      modes[n] = slots[p].cfg.mode;
      n++;
    }
  }
  portEXIT_CRITICAL(&lock);
  if (n == 0) return false;

  const uint32_t tRound = micros();
  int64_t now = esp_timer_get_time();

  // Auto-zero: Y6 is GND, so the node shows exactly the divider offset.
  if (now - lastZeroUs >= (int64_t)ZERO_PERIOD_MS * 1000) {
    const uint32_t t = micros();
    sensing::select(MUX_CH_GND);
    delayMicroseconds(settle);
    const sensing::Node z = sensing::readNode(SAMPLES_ZERO);
    if (lastZeroUs == 0) {
      zero1 = z.mv1;
      zero2 = z.mv2;
    } else {
      zero1 += 0.5f * (z.mv1 - zero1);
      zero2 += 0.5f * (z.mv2 - zero2);
    }
    lastZeroUs = now;
    g_stats.zeroRead.add(micros() - t);
  }

  for (uint8_t i = 0; i < n; ++i) {
    const uint8_t p = list[i];
    const Mode m = modes[i];
    const uint32_t t = micros();
    sensing::select(MUX_CH[p]);
    delayMicroseconds(settle);
    const sensing::Node nd = sensing::readNode(m == Mode::Volt ? SAMPLES_VOLT : SAMPLES_LOGIC);
    g_stats.posRead.add(micros() - t);

    bool drive = false, out = false;
    portENTER_CRITICAL(&lock);
    Slot& s = slots[p];
    if (s.cfg.mode == m) {  // not reconfigured meanwhile
      const float v1 = sensing::toVolts(nd.mv1, zero1) * s.g1;
      const float v2 = sensing::toVolts(nd.mv2, zero2) * s.g2;
      s.live.v1 = v1;
      s.live.v2 = v2;
      if (m == Mode::Volt) {
        s.acc += v1 - v2;
        s.accN++;
      } else {
        const bool a = logicLevel(s.live.in1, v1);
        const bool b = logicLevel(s.live.in2, v2);
        bool q = s.live.out;
        if (m == Mode::Gate) {
          q = evalGate(s.cfg.op, a, b);
        } else if (s.cfg.mem == MemKind::D) {
          if (b && !s.lastClk) q = a;  // rising edge of P2 captures P1
          s.lastClk = b;
        } else {
          if (b) q = false;  // reset wins
          else if (a) q = true;
        }
        if (a != s.live.in1 || b != s.live.in2 || q != s.live.out) s.version++;
        s.live.in1 = a;
        s.live.in2 = b;
        s.live.out = q;
        drive = true;
        out = q;
      }
    }
    portEXIT_CRITICAL(&lock);
    if (drive && railOn) outputs::apply(outputs::drvBit(p), out ? outputs::drvBit(p) : 0);
  }

  now = esp_timer_get_time();
  if (now - lastPublishUs >= (int64_t)VOLT_PUBLISH_MS * 1000) {
    lastPublishUs = now;
    portENTER_CRITICAL(&lock);
    for (uint8_t p = 0; p < NUM_POS; ++p) {
      Slot& s = slots[p];
      if (s.cfg.mode != Mode::Volt || s.accN == 0) continue;
      s.live.vdiff = s.acc / s.accN;
      s.acc = 0;
      s.accN = 0;
      s.version++;
    }
    portEXIT_CRITICAL(&lock);
  }

  g_stats.senseRound.add(micros() - tRound);
  return true;
}

PosView view(uint8_t p) {
  PosView v;
  portENTER_CRITICAL(&lock);
  v.cfg = slots[p].cfg;
  v.live = slots[p].live;
  v.found = slots[p].found;
  v.version = slots[p].version;
  portEXIT_CRITICAL(&lock);
  v.rail = railOn;
  return v;
}

uint8_t activeCount() {
  uint8_t n = 0;
  for (uint8_t p = 0; p < NUM_POS; ++p)
    if (slots[p].cfg.mode != Mode::Off) n++;
  return n;
}

void setFound(uint8_t p, bool found) {
  portENTER_CRITICAL(&lock);
  if (slots[p].found != found) {
    slots[p].found = found;
    slots[p].version++;
  }
  portEXIT_CRITICAL(&lock);
}

void ammeterSample(float ma, bool ok) {
  bool trip = false;
  portENTER_CRITICAL(&lock);
  Slot& s = slots[AMMETER_POS];
  if (s.cfg.mode == Mode::Amm && !s.live.fault) {
    s.live.ma = ok ? ma : NAN;
    if (ok && fabsf(ma) > AMM_TRIP_MA) {
      s.live.fault = true;
      trip = true;
    }
    s.version++;
  }
  portEXIT_CRITICAL(&lock);
  if (trip) applyOutputs(AMMETER_POS);
}

int32_t frameShown(uint8_t p, uint32_t version) {
  int32_t us = -1;
  portENTER_CRITICAL(&lock);
  Slot& s = slots[p];
  if (s.cfgPending && version >= s.cfgVersion) {
    s.cfgPending = false;
    us = (int32_t)(esp_timer_get_time() - s.cfgT0);
  }
  portEXIT_CRITICAL(&lock);
  return us;
}

void setSettleUs(uint32_t us) { settle = us; }
uint32_t settleUs() { return settle; }

void setGains(uint8_t p, float g1, float g2) {
  portENTER_CRITICAL(&lock);
  slots[p].g1 = g1;
  slots[p].g2 = g2;
  portEXIT_CRITICAL(&lock);
  char key[8];
  snprintf(key, sizeof key, "g%ua", p);
  prefs.putFloat(key, g1);
  snprintf(key, sizeof key, "g%ub", p);
  prefs.putFloat(key, g2);
}

const char* modeName(Mode m) {
  switch (m) {
    case Mode::Off: return "off";
    case Mode::Pulse: return "pulse";
    case Mode::Volt: return "volt";
    case Mode::Amm: return "amm";
    case Mode::Gate: return "gate";
    case Mode::Mem: return "mem";
  }
  return "?";
}

namespace {
const char* gateName(GateOp op) {
  static const char* names[] = {"and", "or", "nand", "nor", "xor", "not"};
  return names[(uint8_t)op];
}

void printOne(Print& out, uint8_t p, const PosView& v) {
  out.printf("%u:%s", p, modeName(v.cfg.mode));
  switch (v.cfg.mode) {
    case Mode::Off: break;
    case Mode::Pulse: out.printf(" %.1fHz %u%%", v.cfg.hz, v.cfg.duty); break;
    case Mode::Volt: out.printf(" %+.3fV (P1=%.3f P2=%.3f)", v.live.vdiff, v.live.v1, v.live.v2); break;
    case Mode::Amm:
      if (v.live.fault) out.print(" OVERCURRENT-open");
      else out.printf(" %+.3fmA", v.live.ma);
      break;
    case Mode::Gate:
      out.printf(" %s in=%d%d out=%d", gateName(v.cfg.op), v.live.in1, v.live.in2, v.live.out);
      break;
    case Mode::Mem:
      out.printf(" %s in=%d%d Q=%d", v.cfg.mem == MemKind::D ? "D" : "SR", v.live.in1, v.live.in2,
                 v.live.out);
      break;
  }
}
}  // namespace

void printStatus(Print& out) {
  out.printf("rail=%s  active=%u/%u  595=0x%04X (%lu commits)  settle=%lu us  zero=%.1f/%.1f mV\n",
             railOn ? "on" : "off", activeCount(), MAX_ACTIVE, outputs::image(),
             (unsigned long)outputs::commits(), (unsigned long)settle, zero1, zero2);
  for (uint8_t p = 0; p < NUM_POS; ++p) {
    const PosView v = view(p);
    out.print("  ");
    printOne(out, p, v);
    out.printf("   oled=%s gain=%.4f/%.4f\n", v.found ? "yes" : "no", slots[p].g1, slots[p].g2);
  }
}

void printStream(Print& out) {
  out.printf("t=%.1f", millis() / 1000.0f);
  for (uint8_t p = 0; p < NUM_POS; ++p) {
    const PosView v = view(p);
    if (v.cfg.mode == Mode::Off) continue;
    out.print(" | ");
    printOne(out, p, v);
  }
  out.println();
}

}  // namespace capsules
