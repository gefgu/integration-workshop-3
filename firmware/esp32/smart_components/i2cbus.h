#pragma once
#include <Arduino.h>

// One I2C controller, shared SCL, six SDA lines (one per position).
// A FreeRTOS task owns the bus: capsule detection, INA219 reads, OLED frames.
namespace i2cbus {

enum class SwitchMode : uint8_t {
  Matrix,  // re-route the I2C0 SDA signal in the GPIO matrix (fast, default)
  Restart  // Wire.end() + Wire.begin(newSda) (slow, plain Arduino)
};

void begin();

void setSim(bool on);  // treat every position as having an OLED (timing tests without hardware)
bool sim();
void setClock(uint32_t hz);
uint32_t clock();
void setSwitchMode(SwitchMode m);
SwitchMode switchMode();

void scan(Print& out);
void bench(Print& out);

}  // namespace i2cbus
