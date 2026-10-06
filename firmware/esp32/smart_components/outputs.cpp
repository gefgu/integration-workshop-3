#include "outputs.h"

#include <soc/gpio_reg.h>

#include "config.h"
#include "stats.h"

namespace outputs {
namespace {

portMUX_TYPE lock = portMUX_INITIALIZER_UNLOCKED;
uint16_t img = SAFE_IMAGE;
uint32_t nCommits = 0;  // written inside the critical section

// All three shift pins are < 32, so they live in the first GPIO bank.
inline void pinHigh(uint8_t pin) { REG_WRITE(GPIO_OUT_W1TS_REG, 1UL << pin); }
inline void pinLow(uint8_t pin) { REG_WRITE(GPIO_OUT_W1TC_REG, 1UL << pin); }
// ~40 ns at 240 MHz: covers the 74HCT595 20 ns setup / pulse-width minimums
// with margin for the slow 3.3 V -> HCT edges.
inline void tick() { __asm__ __volatile__("nop\nnop\nnop\nnop\nnop\nnop\nnop\nnop\nnop\nnop"); }

// Bit 15 is shifted first so it ends up in U5 Q7.
void shiftFast(uint16_t v) {
  for (int b = 15; b >= 0; --b) {
    if (v & (1u << b)) pinHigh(PIN_SR_SER);
    else pinLow(PIN_SR_SER);
    tick();
    pinHigh(PIN_SR_SRCLK);
    tick();
    pinLow(PIN_SR_SRCLK);
  }
  tick();
  pinHigh(PIN_SR_RCLK);
  tick();
  pinLow(PIN_SR_RCLK);
}

// Plain Arduino version, only used by the benchmark for comparison.
void shiftSlow(uint16_t v) {
  shiftOut(PIN_SR_SER, PIN_SR_SRCLK, MSBFIRST, v >> 8);
  shiftOut(PIN_SR_SER, PIN_SR_SRCLK, MSBFIRST, v & 0xFF);
  digitalWrite(PIN_SR_RCLK, HIGH);
  digitalWrite(PIN_SR_RCLK, LOW);
}

}  // namespace

void begin() {
  // SR_OE_N is held high by its pull-up during reset. Drive it high before
  // making it an output so the 595s never show their random power-up content.
  REG_WRITE(GPIO_OUT_W1TS_REG, 1UL << PIN_SR_OE_N);
  pinMode(PIN_SR_OE_N, OUTPUT);
  digitalWrite(PIN_SR_OE_N, HIGH);

  pinMode(PIN_SR_SER, OUTPUT);
  pinMode(PIN_SR_SRCLK, OUTPUT);
  pinMode(PIN_SR_RCLK, OUTPUT);
  digitalWrite(PIN_SR_SER, LOW);
  digitalWrite(PIN_SR_SRCLK, LOW);
  digitalWrite(PIN_SR_RCLK, LOW);

  img = SAFE_IMAGE;
  shiftFast(img);
  // Now U4 = 0x00 (DRV low, AMM_EN off) and U5 = 0xFF (every 74HCT125 disabled).
  digitalWrite(PIN_SR_OE_N, LOW);
}

bool apply(uint16_t mask, uint16_t value) {
  bool changed = false;
  uint32_t t0 = 0;
  portENTER_CRITICAL(&lock);
  const uint16_t next = (img & ~mask) | (value & mask);
  if (next != img) {
    t0 = micros();
    img = next;
    shiftFast(img);
    nCommits++;
    changed = true;
  }
  const uint32_t dt = changed ? micros() - t0 : 0;
  portEXIT_CRITICAL(&lock);
  if (changed) g_stats.shiftCommit.add(dt);
  return changed;
}

uint16_t image() { return img; }
uint32_t commits() { return nCommits; }

void bench(Print& out) {
  constexpr int N_FAST = 2000, N_SLOW = 200;
  // Re-shifting the same image keeps the outputs unchanged (the latch shows the
  // same value again), so this is safe while pulses are running.
  uint32_t t = micros();
  for (int i = 0; i < N_FAST; ++i) {
    portENTER_CRITICAL(&lock);
    shiftFast(img);
    portEXIT_CRITICAL(&lock);
  }
  const float fast = (float)(micros() - t) / N_FAST;

  t = micros();
  for (int i = 0; i < N_SLOW; ++i) {
    portENTER_CRITICAL(&lock);
    shiftSlow(img);
    portEXIT_CRITICAL(&lock);
  }
  const float slow = (float)(micros() - t) / N_SLOW;

  out.printf("  595 chain, register writes   %7.2f us per 16-bit commit (used)\n", fast);
  out.printf("  595 chain, shiftOut()        %7.2f us per 16-bit commit (for comparison)\n", slow);
}

}  // namespace outputs
