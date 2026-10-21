#include <Arduino.h>

// Classic ESP32 DevKit: ADC1 inputs remain usable with Wi-Fi.
constexpr uint8_t JOY_X = 36;  // VP
constexpr uint8_t JOY_Y = 39;  // VN
constexpr uint8_t JOY_SW = 35; // Requires an EXTERNAL 10k pull-up to 3V3.
constexpr int DEAD_ZONE = 350; // Raw 12-bit ADC counts; tune for your joystick.
constexpr uint32_t SAMPLE_MS = 5;
constexpr uint32_t PRINT_MS = 100;
constexpr uint32_t DEBOUNCE_MS = 20;

int centerX = 2048;
int centerY = 2048;
int x = 0;
int y = 0;
int minX = 4095;
int maxX = 0;
int minY = 4095;
int maxY = 0;
bool rawPressed = false;
bool pressed = false;
bool buttonArmed = false;
uint32_t pressCount = 0;
uint32_t rawChangedAt = 0;
uint32_t lastSample = 0;
uint32_t lastPrint = 0;

int readAxis(uint8_t pin) {
  uint32_t sum = 0;
  for (int i = 0; i < 8; ++i) {
    sum += analogRead(pin);
  }
  return sum / 8;
}

void resetRange() {
  minX = maxX = x;
  minY = maxY = y;
}

void calibrateCenter() {
  // Keep the stick released. This short blocking step is for this standalone
  // component test only, not the integrated controller's control loop.
  Serial.println("Calibrating center: leave the stick centered...");
  uint32_t sumX = 0;
  uint32_t sumY = 0;
  for (int i = 0; i < 64; ++i) {
    sumX += readAxis(JOY_X);
    sumY += readAxis(JOY_Y);
    delay(2);
  }
  x = centerX = sumX / 64;
  y = centerY = sumY / 64;
  resetRange();
  Serial.printf("Center: X=%d Y=%d; dead zone=+/-%d counts\n",
                centerX, centerY, DEAD_ZONE);
  if (centerX < 500 || centerX > 3500 || centerY < 500 || centerY > 3500) {
    Serial.println("Unusual center: release the stick, check wiring, then send c.");
  }
}

const char* axisState(int reading, int center) {
  if (reading < center - DEAD_ZONE) return "-";
  if (reading > center + DEAD_ZONE) return "+";
  return "CENTER";
}

void updateButton(uint32_t now) {
  const bool current = digitalRead(JOY_SW) == LOW;
  if (current != rawPressed) {
    rawPressed = current;
    rawChangedAt = now;
  }
  if (now - rawChangedAt < DEBOUNCE_MS) return;
  // A button held at boot must be released before it can count as a press.
  if (!rawPressed) buttonArmed = true;
  if (pressed == rawPressed) return;
  pressed = rawPressed;
  if (pressed && buttonArmed) {
    ++pressCount;
    buttonArmed = false;
    Serial.printf("BUTTON PRESS #%lu\n", static_cast<unsigned long>(pressCount));
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(JOY_X, INPUT);
  pinMode(JOY_Y, INPUT);
  pinMode(JOY_SW, INPUT); // GPIO35 has no internal pull-up.
  analogReadResolution(12);
  analogSetPinAttenuation(JOY_X, ADC_11db);
  analogSetPinAttenuation(JOY_Y, ADC_11db);

  delay(1000);
  Serial.println("KY-023 joystick test: X=GPIO36, Y=GPIO39, SW=GPIO35");
  Serial.println("Power: 3V3 only. SW needs an external 10k pull-up to 3V3.");
  Serial.println("Commands: c = recenter (release first), r = reset observed ranges");
  calibrateCenter();
  rawPressed = pressed = digitalRead(JOY_SW) == LOW;
  rawChangedAt = lastSample = lastPrint = millis();
}

void loop() {
  while (Serial.available()) {
    const char command = Serial.read();
    if (command == 'c' || command == 'C') calibrateCenter();
    if (command == 'r' || command == 'R') {
      resetRange();
      Serial.println("Observed ranges reset.");
    }
  }

  const uint32_t now = millis();
  if (now - lastSample >= SAMPLE_MS) {
    lastSample = now;
    x = readAxis(JOY_X);
    y = readAxis(JOY_Y);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    updateButton(now);
  }

  if (now - lastPrint >= PRINT_MS) {
    lastPrint = now;
    Serial.printf("X=%4d (%s)  Y=%4d (%s)  SW=%s  presses=%lu  range X=%d..%d Y=%d..%d\n",
                  x, axisState(x, centerX), y, axisState(y, centerY),
                  pressed ? "PRESSED" : "released",
                  static_cast<unsigned long>(pressCount), minX, maxX, minY, maxY);
  }
  delay(1);
}
