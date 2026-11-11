#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <stdio.h>
#include <string.h>
#include "LineReader.h"
#include "DemoVoltage.h"

// Standalone classic 30-pin ESP32 stage 1. No Wi-Fi, sensing, or output driver.
// Indexed by the OLED number on the soldered board, not ESP32 header order.
// OLED0=D4, OLED1=RX2, OLED2=D18, OLED3=TX2, OLED4=D19, OLED5=D21.
constexpr uint8_t SDA_PINS[] = {4, 16, 18, 17, 19, 21};
constexpr uint8_t SCL_PIN = 22, JOY_X = 36, JOY_Y = 39;
constexpr uint8_t PI_RX = 32, PI_TX = 33;
constexpr uint8_t TEST_ENABLE = 14, JOY_BUTTON = 26;
// USB host must renew the temporary test output. This is not a hardware interlock.
constexpr uint32_t ENABLE_TIMEOUT_MS = 1500, BUTTON_DEBOUNCE_MS = 40;
bool testEnabled = false;
uint32_t enableAt = 0;
bool voltTest = false;
uint32_t voltTestAt = 0;
constexpr uint32_t BAUD = 115200, I2C_HZ = 100000;
constexpr int OLED_WIDTH = 128, OLED_HEIGHT = 64; // Change height to 32 if needed.
constexpr int DEAD_ZONE = 1300;
// Separate driver state retains each panel's detected address across SDA changes.
Adafruit_SSD1306 panels[] = {
  Adafruit_SSD1306(OLED_WIDTH, OLED_HEIGHT, &Wire, -1, I2C_HZ, I2C_HZ),
  Adafruit_SSD1306(OLED_WIDTH, OLED_HEIGHT, &Wire, -1, I2C_HZ, I2C_HZ),
  Adafruit_SSD1306(OLED_WIDTH, OLED_HEIGHT, &Wire, -1, I2C_HZ, I2C_HZ),
  Adafruit_SSD1306(OLED_WIDTH, OLED_HEIGHT, &Wire, -1, I2C_HZ, I2C_HZ),
  Adafruit_SSD1306(OLED_WIDTH, OLED_HEIGHT, &Wire, -1, I2C_HZ, I2C_HZ),
  Adafruit_SSD1306(OLED_WIDTH, OLED_HEIGHT, &Wire, -1, I2C_HZ, I2C_HZ)
};
HardwareSerial piLink(2);
bool busStarted = false, enabled[6] = {}, initialized[6] = {};
uint8_t addresses[6] = {};
bool joystickOn = true, calibrated = false;
int centerX = 2048, centerY = 2048, rawX = 0, rawY = 0;
const char* direction = "CENTER";
uint32_t lastFrame = 0;
uint32_t lastSmartStatus = 0;
unsigned long frameId = 0, loopId = 0;
bool loopPending = false;
uint32_t loopSentAt = 0;

void releaseBus() {
  if (busStarted) Wire.end();
  busStarted = false;
  for (uint8_t pin : SDA_PINS) pinMode(pin, INPUT); // Released; module supplies pull-up.
  pinMode(SCL_PIN, INPUT);
}

bool selectSlot(uint8_t slot) {
  releaseBus();
  if (!Wire.begin(SDA_PINS[slot], SCL_PIN, I2C_HZ)) return false;
  busStarted = true;
  Wire.setTimeOut(25);
  return true;
}

bool ack(uint8_t address) {
  Wire.beginTransmission(address);
  return Wire.endTransmission() == 0;
}

uint8_t detectAddress() {
  if (ack(0x3C)) return 0x3C;
  if (ack(0x3D)) return 0x3D;
  return 0;
}

void disableScreens() {
  for (int i = 0; i < 6; ++i) { enabled[i] = false; initialized[i] = false; }
  releaseBus();
}

void scanScreens() {
  for (uint8_t i = 0; i < 6; ++i) {
    const bool started = selectSlot(i);
    const uint8_t address = started ? detectAddress() : 0;
    Serial.printf("SLOT %u SDA=%u: %s", i, SDA_PINS[i], address ? "ACK" : "NO ACK");
    if (address) Serial.printf(" at 0x%02X", address);
    Serial.println();
    releaseBus();
  }
  Serial.println("ACK is not visual proof: check that only the intended screen updates.");
}

void drawSlot(uint8_t slot) {
  Adafruit_SSD1306& oled = panels[slot];
  if (!selectSlot(slot)) { initialized[slot] = false; Serial.println("I2C begin failed"); return; }
  const uint8_t address = detectAddress();
  if (!address) {
    initialized[slot] = false;
    Serial.printf("SLOT %u: NO ACK; check cable/power/pull-ups\n", slot);
    releaseBus();
    return;
  }
  if (!initialized[slot] || addresses[slot] != address) {
    // periphBegin=false prevents the library from undoing our SDA selection.
    if (!oled.begin(SSD1306_SWITCHCAPVCC, address, false, false)) {
      Serial.println("OLED framebuffer allocation failed"); releaseBus(); return;
    }
    addresses[slot] = address;
    initialized[slot] = true;
  }
  // Each selected display gets a complete frame on its own SDA line.
  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);
  oled.setTextSize(1);
  oled.setTextWrap(false);
  oled.setCursor(0, 0);
  if (voltTest) {
    oled.setTextSize(2);
    oled.setCursor(24, 22);
    oled.printf(testEnabled ? "%.2fV" : "%.1fV", demoResistorVoltage(testEnabled));
    oled.display();
    releaseBus();
    return;
  }
  oled.printf("STAGE 1 - SLOT %u\n", slot);
  oled.printf("SDA %u SCL %u\n", SDA_PINS[slot], SCL_PIN);
  oled.printf("frame %lu\n", ++frameId);
  oled.printf("JOY %s\n", joystickOn && calibrated ? direction : "OFF/UNCAL");
  if (OLED_HEIGHT >= 64) {
    oled.printf("X %d Y %d\n", rawX, rawY);
    oled.printf("UART RX32 TX33\n");
    oled.drawRect((frameId * 5) % 110, 54, 12, 8, SSD1306_WHITE);
  }
  oled.display(); // Adafruit display() does not return a transfer-success result.
  if (!ack(address)) { initialized[slot] = false; Serial.printf("SLOT %u: ACK lost\n", slot); }
  releaseBus();
}

constexpr bool SWAP_XY = false, INVERT_X = false, INVERT_Y = true;
constexpr int RELEASE_ZONE = 400;
constexpr uint32_t PUSH_STABLE_MS = 50, RELEASE_STABLE_MS = 120, REPEAT_DELAY_MS = 1000, REPEAT_EVERY_MS = 450, DEBOUNCE_MS = 20, LONG_PRESS_MS = 800;
Button sw(JOY_BUTTON);
uint32_t lastCalibration = 0;
const char* heldDirection = nullptr;
const char* candidate = nullptr;
uint32_t candidateSince = 0, centeredSince = 0, directionSince = 0, lastRepeat = 0;
bool longSent = false;
unsigned long keyId = 0;
int readAxis(uint8_t pin) {
  uint32_t sum = 0;
  for (int i = 0; i < 4; ++i) sum += analogRead(pin);
  return sum / 4;
}

void sendKey(const char* name) {
  ++keyId;
  piLink.printf("KEY %lu %s\n", keyId, name);
  Serial.printf("KEY %lu %s\n", keyId, name);
}

void calibrate() {
  uint32_t sx = 0, sy = 0;
  for (int i = 0; i < 32; ++i) {
    sx += readAxis(JOY_X);
    sy += readAxis(JOY_Y);
    delay(2);
  }
  centerX = sx / 32;
  centerY = sy / 32;
  lastCalibration = millis();
  const bool ok = centerX > 800 && centerX < 3300 && centerY > 800 && centerY < 3300;
  if (ok) {
    Serial.printf("# joystick center X=%d Y=%d\n", centerX, centerY);
  } else {
    Serial.printf("# joystick not found (X=%d Y=%d): check +5V->3V3, GND, VRx->GPIO36, VRy->GPIO39\n",
                  centerX, centerY);
  }
  calibrated = ok;
}

// Debounce; returns +1 on a press, -1 on a release, 0 otherwise.
int update(Button& b, uint32_t now) {
  const bool raw = digitalRead(b.pin) == LOW;  // active low
  if (raw != b.raw) {
    b.raw = raw;
    b.changedAt = now;
  }
  if (raw == b.stable || now - b.changedAt < DEBOUNCE_MS) return 0;
  b.stable = raw;
  if (!raw) {
    const bool wasArmed = b.armed;
    b.armed = true;
    return wasArmed ? -1 : 0;
  }
  if (!b.armed) return 0;
  b.pressedAt = now;
  return +1;
}

// Reads the stick: `centered` when it is near the middle; returns the pushed direction, or nullptr when the push
// is too small or too diagonal to tell (one axis must clearly win).
const char* readDirection(bool& centered) {
  rawX = readAxis(JOY_X); rawY = readAxis(JOY_Y);
  int dx = rawX - centerX;
  int dy = rawY - centerY;
  if (SWAP_XY) {
    const int t = dx;
    dx = dy;
    dy = t;
  }
  if (INVERT_X) dx = -dx;
  if (INVERT_Y) dy = -dy;
  centered = abs(dx) < RELEASE_ZONE && abs(dy) < RELEASE_ZONE;
  const int ax = abs(dx), ay = abs(dy);
  if (ax < DEAD_ZONE && ay < DEAD_ZONE) return nullptr;
  if (ax * 2 < ay * 3 && ay * 2 < ax * 3) return nullptr;  // diagonal: neither axis 1.5x the other
  if (ax > ay) return dx > 0 ? "RIGHT" : "LEFT";
  return dy > 0 ? "DOWN" : "UP";
}

// One KEY per push: the push must be steady, and the stick must rest at the center before the next one.
void updateJoystick(uint32_t now) {
  if (!joystickOn || !calibrated) return;
  bool centered = false;
  const char* dir = readDirection(centered);
  direction = dir ? dir : "CENTER";
  if (heldDirection) {
    if (!centered) {
      centeredSince = now;
      if (dir == heldDirection && now - directionSince >= REPEAT_DELAY_MS && now - lastRepeat >= REPEAT_EVERY_MS) {
        lastRepeat = now;
        sendKey(heldDirection);
      }
    } else if (now - centeredSince >= RELEASE_STABLE_MS) {
      heldDirection = nullptr;  // released: the next push may go
    }
    return;
  }
  if (dir != candidate) {
    candidate = dir;
    candidateSince = now;
  } else if (dir && now - candidateSince >= PUSH_STABLE_MS) {
    heldDirection = dir;
    candidate = nullptr;
    directionSince = lastRepeat = centeredSince = now;
    sendKey(dir);
  }
}

// Fixed-size, newline-delimited command buffers; discard an entire malformed line.
LineReader usbLine, piLine;

void handlePi(const char* line) {
  Serial.printf("Pi RX: %s\n", line);
  unsigned long id; char extra;
  if (!strcmp(line, "HELLO?")) piLink.println("HELLO controles 1");
  else if (sscanf(line, "PING %lu %c", &id, &extra) == 1) piLink.printf("PONG %lu\n", id);
  else if (sscanf(line, "ACK %lu %c", &id, &extra) == 1) Serial.printf("Pi ACK event %lu (compare sent JOY id)\n", id);
  else if (sscanf(line, "LOOP %lu %c", &id, &extra) == 1 && loopPending && id == loopId) {
    Serial.printf("UART LOOPBACK PASS: %lu ms\n", static_cast<unsigned long>(millis() - loopSentAt));
    loopPending = false;
  } else piLink.println("ERR UNKNOWN_COMMAND");
}

void help() {
  Serial.println("Commands (115200 baud, newline):");
  Serial.println("scan           probe slots 0..5 at 0x3C/0x3D");
  Serial.println("screens 0      update only slot 0 (or any slot 0..5)");
  Serial.println("screens 0 1 2  update up to THREE slots sequentially");
  Serial.println("off            stop OLED traffic (does not remove screen power)");
  Serial.println("joy on | joy off; c = calibrate released joystick");
  Serial.println("loop           UART TX/RX jumper test; disconnect Pi first");
  Serial.println("POWER 1 | POWER 0  USB test GPIO14 (lease expires after 1.5 seconds)");
  Serial.println("Joystick click: OK; hold: MENU (KEY events over USB and UART)");
  Serial.println("status | help  show mapping/state or this list");
}

void printPinMap() {
  Serial.printf("SCL=GPIO%u; SDA:", SCL_PIN);
  for (unsigned i = 0; i < sizeof(SDA_PINS) / sizeof(SDA_PINS[0]); ++i)
    Serial.printf(" OLED%u=GPIO%u", i, SDA_PINS[i]);
  Serial.println();
  Serial.printf("JOY X=GPIO%u Y=GPIO%u; UART RX=GPIO%u TX=GPIO%u\n",
                JOY_X, JOY_Y, PI_RX, PI_TX);
}

void handleUsb(const char* line) {
  unsigned long id; char extra;
  if (!strcmp(line, "HELLO?")) Serial.println("HELLO controles 2");
  else if (sscanf(line, "PING %lu %c", &id, &extra) == 1) Serial.printf("PONG %lu\n", id);
  else if (sscanf(line, "ACK %lu %c", &id, &extra) == 1) {}
  else if (!strcmp(line, "VOLTTEST 1")) {
    if (!voltTest) {
      disableScreens();
      uint8_t found = 0;
      for (uint8_t i = 0; i < 6; ++i) {
        const bool started = selectSlot(i);
        const uint8_t address = started ? detectAddress() : 0;
        releaseBus();
        if (address && found < 3) { enabled[i] = true; ++found; }
      }
      Serial.printf("Voltmeter demo: %u screens selected, verify visually.\n", found);
      lastFrame = millis() - 1000;
    }
    voltTest = true; voltTestAt = millis();
  } else if (!strcmp(line, "VOLTTEST 0")) {
    voltTest = false;
  }
  else if (!strcmp(line, "POWER 1")) {
    enableAt = millis(); testEnabled = true; digitalWrite(TEST_ENABLE, HIGH);
    Serial.println("POWER 1");
  } else if (!strcmp(line, "POWER 0")) {
    testEnabled = false; digitalWrite(TEST_ENABLE, LOW); Serial.println("POWER 0");
  } else if (!strcmp(line, "help") || !strcmp(line, "?")) help();
  else if (!strcmp(line, "scan")) scanScreens();
  else if (!strcmp(line, "off")) { disableScreens(); Serial.println("OLED traffic stopped; panels may retain image."); }
  else if (!strcmp(line, "joy on")) {
    joystickOn = true; calibrated = false;
    Serial.println("Joystick enabled; release stick then send c.");
  } else if (!strcmp(line, "joy off")) {
    joystickOn = calibrated = false; Serial.println("Joystick disabled.");
  } else if (!strcmp(line, "c")) calibrate();
  else if (!strcmp(line, "loop")) {
    loopPending = true; loopSentAt = millis(); ++loopId;
    piLink.printf("LOOP %lu\n", loopId);
    Serial.println("Waiting up to 2 s for TX33 -> RX32 jumper echo; Pi must be disconnected.");
  } else if (!strcmp(line, "status")) {
    printPinMap();
    Serial.printf("JOY=%s calibrated=%s; enabled slots:", joystickOn ? "ON" : "OFF", calibrated ? "YES" : "NO");
    for (int i = 0; i < 6; ++i) if (enabled[i]) Serial.printf(" %d", i);
    Serial.println();
  } else if (!strncmp(line, "screens ", 8)) {
    bool selection[6] = {}; int count = 0; bool valid = true;
    const char* p = line + 8;
    while (*p) {
      while (*p == ' ') ++p;
      if (!*p) break;
      if (*p < '0' || *p > '5' || (p[1] && p[1] != ' ')) { valid = false; break; }
      const int slot = *p++ - '0';
      if (!selection[slot]) { selection[slot] = true; ++count; }
    }
    if (!valid || count < 1 || count > 3) { Serial.println("Use screens with 1..3 distinct slots, e.g. screens 0 2 5"); return; }
    disableScreens();
    for (int i = 0; i < 6; ++i) enabled[i] = selection[i];
    Serial.println("Selection applied. Verify slot numbers visually; first frame may take a moment.");
  } else Serial.println("Unknown command; send help.");
}

void receiveLines(Stream& stream, LineReader& reader, bool fromPi) {
  for (int i = 0; i < 128 && stream.available(); ++i) {
    const char ch = stream.read();
    if (ch == '\r') continue;
    if (ch == '\n') {
      if (!reader.discard && reader.length) {
        reader.data[reader.length] = '\0';
        if (fromPi) handlePi(reader.data); else handleUsb(reader.data);
      }
      reader.length = 0; reader.discard = false;
    } else if (!reader.discard) {
      if (ch < 32 || ch > 126 || reader.length >= sizeof(reader.data) - 1) {
        reader.length = 0; reader.discard = true;
        Serial.println("Discarding malformed/overlong line until newline.");
      } else reader.data[reader.length++] = ch;
    }
  }
}

void setup() {
  digitalWrite(TEST_ENABLE, LOW);
  pinMode(TEST_ENABLE, OUTPUT);
  pinMode(JOY_BUTTON, INPUT_PULLUP);
  Serial.begin(BAUD);
  releaseBus();
  pinMode(JOY_X, INPUT); pinMode(JOY_Y, INPUT);
  analogReadResolution(12);
  analogSetPinAttenuation(JOY_X, ADC_11db); analogSetPinAttenuation(JOY_Y, ADC_11db);
  piLink.begin(BAUD, SERIAL_8N1, PI_RX, PI_TX);
  delay(500);
  calibrate();
  // Detect each independent OLED bus; animate up to three detected displays.
  uint8_t found = 0;
  for (uint8_t i = 0; i < 6; ++i) {
    const bool started = selectSlot(i);
    const uint8_t address = started ? detectAddress() : 0;
    releaseBus();
    if (address && found < 3) { enabled[i] = true; ++found; }
    Serial.printf("SLOT %u: %s%s\n", i, address ? "ACK" : "NO ACK",
                  address && !enabled[i] ? " (animation limit reached)" : "");
  }
  Serial.printf("Detected %u OLED(s) for animation; verify screens visually.\n", found);
  sw.stable = sw.raw = digitalRead(JOY_BUTTON) == LOW;
  sw.armed = !sw.stable;
  Serial.println("HELLO controles 2");
  piLink.println("HELLO controles 1");
  Serial.println("Perfboard stage 1: joystick enabled.");
  Serial.println("GPIO14 test enable OFF; joystick button GPIO26. No voltage sensing or power safety interlock.");
  printPinMap();
  help();
}

void loop() {
  receiveLines(Serial, usbLine, false);
  const uint32_t now = millis();
  if (testEnabled && now - enableAt >= ENABLE_TIMEOUT_MS) {
    digitalWrite(TEST_ENABLE, LOW); testEnabled = false; Serial.println("EVENT power timeout");
  }
  if (voltTest && now - voltTestAt >= 2000) voltTest = false;
  if (!calibrated && joystickOn && now - lastCalibration >= 3000) calibrate();
  const int click = update(sw, now);
  if (click > 0) longSent = false;
  if (sw.stable && sw.armed && !longSent && now - sw.pressedAt >= LONG_PRESS_MS) {
    longSent = true; sendKey("MENU");
  }
  if (click < 0 && !longSent) sendKey("OK");
  receiveLines(piLink, piLine, true);
  updateJoystick(millis());
  if (millis() - lastFrame >= 1000) {
    lastFrame = millis();
    for (uint8_t i = 0; i < 6; ++i) if (enabled[i]) {
      drawSlot(i);
      receiveLines(piLink, piLine, true);
      updateJoystick(millis());
    }
  }
  if (millis() - lastSmartStatus >= 1000) {
    lastSmartStatus = millis();
    unsigned mask = 0;
    for (unsigned i = 0; i < 6; ++i) if (enabled[i] && initialized[i]) mask |= 1U << i;
    Serial.printf("SMART %u\n", mask);
  }
  if (loopPending && millis() - loopSentAt >= 2000) {
    loopPending = false; Serial.println("UART LOOPBACK TIMEOUT: check TX33/RX32 jumper and connector wires.");
  }
  delay(1);
}
