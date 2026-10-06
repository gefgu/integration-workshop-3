#include "sensing.h"

namespace sensing {

void begin() {
  pinMode(PIN_MUX_A0, OUTPUT);
  pinMode(PIN_MUX_A1, OUTPUT);
  pinMode(PIN_MUX_A2, OUTPUT);
  analogReadResolution(12);
  // Node range is 0.26..2.22 V, inside the 11 dB range (~0.15..3.1 V).
  analogSetPinAttenuation(PIN_ADC_P1, ADC_11db);
  analogSetPinAttenuation(PIN_ADC_P2, ADC_11db);
  select(MUX_CH_GND);
}

void select(uint8_t channel) {
  digitalWrite(PIN_MUX_A0, channel & 1);
  digitalWrite(PIN_MUX_A1, (channel >> 1) & 1);
  digitalWrite(PIN_MUX_A2, (channel >> 2) & 1);
}

Node readNode(uint8_t samples) {
  uint32_t a = 0, b = 0;
  for (uint8_t i = 0; i < samples; ++i) {
    a += analogReadMilliVolts(PIN_ADC_P1);
    b += analogReadMilliVolts(PIN_ADC_P2);
  }
  return {(float)a / samples, (float)b / samples};
}

namespace {
template <typename F>
float perCallUs(int n, F fn) {
  const uint32_t t = micros();
  for (int i = 0; i < n; ++i) fn();
  return (float)(micros() - t) / n;
}
}  // namespace

void bench(Print& out, uint32_t settleUs) {
  volatile uint32_t sink = 0;
  out.printf("  mux select (3 GPIO writes)   %7.2f us\n", perCallUs(1000, [] { select(MUX_CH_GND); }));
  out.printf("  analogRead()                 %7.2f us\n",
             perCallUs(500, [&] { sink += analogRead(PIN_ADC_P1); }));
  out.printf("  analogReadMilliVolts()       %7.2f us (used)\n",
             perCallUs(500, [&] { sink += analogReadMilliVolts(PIN_ADC_P1); }));
  const float n4 = perCallUs(50, [] { readNode(SAMPLES_LOGIC); });
  const float n16 = perCallUs(50, [] { readNode(SAMPLES_VOLT); });
  const float n32 = perCallUs(50, [] { readNode(SAMPLES_ZERO); });
  out.printf("  readNode(%2u) P1+P2           %7.1f us (gate / memory)\n", SAMPLES_LOGIC, n4);
  out.printf("  readNode(%2u) P1+P2           %7.1f us (voltmeter)\n", SAMPLES_VOLT, n16);
  out.printf("  readNode(%2u) P1+P2           %7.1f us (auto-zero)\n", SAMPLES_ZERO, n32);

  const float posVolt = perCallUs(20, [&] {
    select(MUX_CH[1]);
    delayMicroseconds(settleUs);
    readNode(SAMPLES_VOLT);
  });
  const float posLogic = perCallUs(20, [&] {
    select(MUX_CH[1]);
    delayMicroseconds(settleUs);
    readNode(SAMPLES_LOGIC);
  });
  out.printf("  one position, voltmeter      %7.1f us (settle %lu us)\n", posVolt, (unsigned long)settleUs);
  out.printf("  one position, gate/memory    %7.1f us\n", posLogic);
  out.printf("  -> 3 voltmeters per round    %7.2f ms  (%.0f readings/s each, SFR10 needs 10)\n",
             3 * posVolt / 1000, 1e6f / (3 * posVolt));
  out.printf("  -> 3 gates: input->P3 delay <= %.2f ms per round\n", 3 * posLogic / 1000);
  select(MUX_CH_GND);
}

}  // namespace sensing
