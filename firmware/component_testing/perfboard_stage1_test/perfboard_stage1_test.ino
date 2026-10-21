#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <stdio.h>
#include <string.h>

// Standalone classic 30-pin ESP32 stage 1. No Wi-Fi, sensing, or output driver.
constexpr uint8_t SDA_PINS[] = {4, 21, 19, 18, 17, 16};
constexpr uint8_t SCL_PIN = 22, JOY_X = 36, JOY_Y = 39;
constexpr uint8_t PI_RX = 32, PI_TX = 33;
constexpr uint32_t BAUD = 115200, I2C_HZ = 100000;
constexpr int OLED_WIDTH = 128, OLED_HEIGHT = 64; // Change height to 32 if needed.
constexpr bool INVERT_X = false, INVERT_Y = false; // Verify after mounting.
constexpr int DEAD_ZONE = 500;
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
bool joystickOn = false, calibrated = false;
int centerX = 2048, centerY = 2048, rawX = 0, rawY = 0;
const char* direction = "CENTER";
const char* candidate = "CENTER";
uint32_t candidateAt = 0, lastSample = 0, lastJoyLog = 0, lastFrame = 0;
unsigned long joyId = 0, frameId = 0, loopId = 0;
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

int readAxis(uint8_t pin) {
  uint32_t sum = 0;
  for (int i = 0; i < 8; ++i) sum += analogRead(pin);
  return sum / 8;
}

void calibrate() {
  if (!joystickOn) { Serial.println("Connect joystick, then: joy on"); return; }
  Serial.println("Calibrating: release joystick to center.");
  uint32_t x = 0, y = 0;
  for (int i = 0; i < 64; ++i) { x += readAxis(JOY_X); y += readAxis(JOY_Y); delay(2); }
  centerX = x / 64; centerY = y / 64;
  calibrated = centerX >= 500 && centerX <= 3500 && centerY >= 500 && centerY <= 3500;
  direction = candidate = "CENTER"; candidateAt = millis();
  Serial.printf("Center X=%d Y=%d: %s\n", centerX, centerY, calibrated ? "accepted; verify directions" : "unusual; check wiring and retry c");
  Serial.println("A disconnected input can float: calibration does not prove connection.");
}

void updateJoystick(uint32_t now) {
  if (!joystickOn || now - lastSample < 10) return;
  lastSample = now;
  rawX = readAxis(JOY_X); rawY = readAxis(JOY_Y);
  if (calibrated) {
    const int dx = (rawX - centerX) * (INVERT_X ? -1 : 1);
    const int dy = (rawY - centerY) * (INVERT_Y ? -1 : 1);
    const char* next = "CENTER";
    if (abs(dx) > DEAD_ZONE || abs(dy) > DEAD_ZONE)
      next = abs(dx) >= abs(dy) ? (dx < 0 ? "LEFT" : "RIGHT") : (dy < 0 ? "UP" : "DOWN");
    if (strcmp(candidate, next)) { candidate = next; candidateAt = now; }
    if (strcmp(direction, candidate) && now - candidateAt >= 40) {
      direction = candidate;
      piLink.printf("JOY %lu %s\n", ++joyId, direction);
      Serial.printf("JOY %lu %s\n", joyId, direction);
    }
  }
  if (now - lastJoyLog >= 500) {
    lastJoyLog = now;
    Serial.printf("JOYSTICK X=%d Y=%d %s\n", rawX, rawY, calibrated ? direction : "UNCALIBRATED");
  }
}

// Fixed-size, newline-delimited command buffers; discard an entire malformed line.
struct LineReader { char data[96]; size_t length = 0; bool discard = false; } usbLine, piLine;

void handlePi(const char* line) {
  Serial.printf("Pi RX: %s\n", line);
  unsigned long id; char extra;
  if (sscanf(line, "PING %lu %c", &id, &extra) == 1) piLink.printf("PONG %lu\n", id);
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
  Serial.println("status | help  show mapping/state or this list");
}

void handleUsb(const char* line) {
  if (!strcmp(line, "help") || !strcmp(line, "?")) help();
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
    Serial.println("SCL22 SDA[0..5]=4,21,19,18,17,16; JOY X36 Y39; UART RX32 TX33");
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
  Serial.begin(BAUD);
  releaseBus();
  pinMode(JOY_X, INPUT); pinMode(JOY_Y, INPUT);
  analogReadResolution(12);
  analogSetPinAttenuation(JOY_X, ADC_11db); analogSetPinAttenuation(JOY_Y, ADC_11db);
  piLink.begin(BAUD, SERIAL_8N1, PI_RX, PI_TX);
  delay(500);
  Serial.println("Perfboard stage 1: OLED traffic and joystick sampling OFF at startup.");
  Serial.println("No ADC34/35 sensing, SW button, Wi-Fi, pulse or output-driver code.");
  help();
}

void loop() {
  receiveLines(Serial, usbLine, false);
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
  if (loopPending && millis() - loopSentAt >= 2000) {
    loopPending = false; Serial.println("UART LOOPBACK TIMEOUT: check TX33/RX32 jumper and connector wires.");
  }
  delay(1);
}
