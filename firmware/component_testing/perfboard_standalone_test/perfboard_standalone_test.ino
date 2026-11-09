#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <string.h>

// Current soldered board: OLED0..5 -> D4, RX2, D18, TX2, D19, D21.
constexpr uint8_t SDA_BY_SLOT[] = {4, 16, 18, 17, 19, 21};
// Find connected modules automatically; set false to use DEFAULT_SLOTS manually.
constexpr bool AUTO_FIND_SCREENS = true;
constexpr uint8_t DEFAULT_SLOTS[] = {0, 1, 2};
uint8_t activeSlots[] = {DEFAULT_SLOTS[0], DEFAULT_SLOTS[1], DEFAULT_SLOTS[2]};
constexpr uint8_t SCREEN_COUNT = 3;
constexpr uint8_t JOYSTICK_SCREEN = 1; // Second module in activeSlots.
constexpr uint8_t SCL_PIN = 22, JOY_X = 36, JOY_Y = 39;
constexpr uint32_t I2C_HZ = 100000, FRAME_INTERVAL_MS = 100;
constexpr int WIDTH = 128, HEIGHT = 64, DEAD_ZONE = 500;
constexpr bool INVERT_X = false, INVERT_Y = false;
static_assert(DEFAULT_SLOTS[0] < 6 && DEFAULT_SLOTS[1] < 6 && DEFAULT_SLOTS[2] < 6,
              "OLED slot numbers must be 0..5");
static_assert(DEFAULT_SLOTS[0] != DEFAULT_SLOTS[1] && DEFAULT_SLOTS[0] != DEFAULT_SLOTS[2]
              && DEFAULT_SLOTS[1] != DEFAULT_SLOTS[2], "Choose three different slots");

Adafruit_SSD1306 panels[] = {
  Adafruit_SSD1306(WIDTH, HEIGHT, &Wire, -1, I2C_HZ, I2C_HZ),
  Adafruit_SSD1306(WIDTH, HEIGHT, &Wire, -1, I2C_HZ, I2C_HZ),
  Adafruit_SSD1306(WIDTH, HEIGHT, &Wire, -1, I2C_HZ, I2C_HZ)
};
bool busStarted = false, initialized[SCREEN_COUNT] = {};
uint8_t addresses[SCREEN_COUNT] = {};
uint32_t frames[SCREEN_COUNT] = {}, retryAt[SCREEN_COUNT] = {};
int rawX = 0, rawY = 0, centerX = 2048, centerY = 2048;
bool calibrated = false;
const char* direction = "CENTER";
const char* candidate = "CENTER";
uint32_t candidateAt = 0, lastSample = 0, lastFrame = 0;

void releaseBus() {
  if (busStarted) Wire.end();
  busStarted = false;
  for (uint8_t pin : SDA_BY_SLOT) pinMode(pin, INPUT);
  pinMode(SCL_PIN, INPUT);
}

bool selectDisplay(uint8_t index) {
  releaseBus();
  if (!Wire.begin(SDA_BY_SLOT[activeSlots[index]], SCL_PIN, I2C_HZ)) return false;
  busStarted = true;
  Wire.setTimeOut(25);
  return true;
}

bool ack(uint8_t address) {
  Wire.beginTransmission(address);
  return Wire.endTransmission() == 0;
}

void discoverScreens() {
  uint8_t found[SCREEN_COUNT] = {};
  uint8_t count = 0;
  bool used[6] = {};
  for (uint8_t slot = 0; slot < 6 && count < SCREEN_COUNT; ++slot) {
    releaseBus();
    if (!Wire.begin(SDA_BY_SLOT[slot], SCL_PIN, I2C_HZ)) continue;
    busStarted = true;
    Wire.setTimeOut(25);
    if (ack(0x3C) || ack(0x3D)) { found[count++] = slot; used[slot] = true; }
    releaseBus();
  }
  for (uint8_t i = 0; i < count; ++i) activeSlots[i] = found[i];
  // Reserve distinct unused ports if fewer than three modules were detected.
  for (uint8_t i = count; i < SCREEN_COUNT; ++i) {
    for (uint8_t slot = 0; slot < 6; ++slot) if (!used[slot]) {
      activeSlots[i] = slot; used[slot] = true; break;
    }
  }
}

bool prepareDisplay(uint8_t index) {
  if (!selectDisplay(index)) { initialized[index] = false; addresses[index] = 0; return false; }
  const uint8_t address = ack(0x3C) ? 0x3C : ack(0x3D) ? 0x3D : 0;
  if (!address) {
    initialized[index] = false;
    addresses[index] = 0;
    releaseBus();
    return false;
  }
  if (!initialized[index] || addresses[index] != address) {
    // Keep the selected SDA; do not let begin() reinitialize Wire.
    if (!panels[index].begin(SSD1306_SWITCHCAPVCC, address, false, false)) {
      initialized[index] = false;
      addresses[index] = 0;
      releaseBus();
      return false;
    }
    addresses[index] = address;
    initialized[index] = true;
  }
  return true;
}

void startFrame(uint8_t index) {
  panels[index].clearDisplay();
  panels[index].setTextColor(SSD1306_WHITE);
  panels[index].setTextSize(1);
  panels[index].setTextWrap(false);
  panels[index].setCursor(0, 0);
  panels[index].printf("OLED%u SDA%u SCL%u\n", activeSlots[index],
                       SDA_BY_SLOT[activeSlots[index]], SCL_PIN);
  panels[index].drawFastHLine(0, 10, WIDTH, SSD1306_WHITE);
  panels[index].setCursor(0, 15);
}

void finishFrame(uint8_t index) {
  panels[index].display();
  if (!ack(addresses[index])) {
    initialized[index] = false;
    addresses[index] = 0;
  }
  releaseBus();
}

int readAxis(uint8_t pin) {
  uint32_t sum = 0;
  for (uint8_t i = 0; i < 8; ++i) sum += analogRead(pin);
  return sum / 8;
}

void sampleJoystick() {
  rawX = readAxis(JOY_X);
  rawY = readAxis(JOY_Y);
}

void updateJoystick() {
  const uint32_t now = millis();
  if (now - lastSample < 10) return;
  lastSample = now;
  sampleJoystick();
  if (!calibrated) return;
  const int dx = (rawX - centerX) * (INVERT_X ? -1 : 1);
  const int dy = (rawY - centerY) * (INVERT_Y ? -1 : 1);
  const char* next = "CENTER";
  if (abs(dx) > DEAD_ZONE || abs(dy) > DEAD_ZONE)
    next = abs(dx) >= abs(dy) ? (dx < 0 ? "LEFT" : "RIGHT")
                              : (dy < 0 ? "UP" : "DOWN");
  if (strcmp(candidate, next)) { candidate = next; candidateAt = now; }
  if (now - candidateAt >= 40) direction = candidate;
}

void drawScreen(uint8_t index) {
  // Missing modules do not stop the other two; retry approximately every 2 s.
  if (!initialized[index] && millis() - retryAt[index] < 2000) return;
  retryAt[index] = millis();
  if (!prepareDisplay(index)) return;
  Adafruit_SSD1306& oled = panels[index];
  startFrame(index);
  ++frames[index];
  if (index == JOYSTICK_SCREEN) {
    oled.printf("X:%4d  Y:%4d\n", rawX, rawY);
    oled.setCursor(0, 29);
    oled.setTextSize(2);
    oled.println(calibrated ? direction : "UNCAL");
    oled.setTextSize(1);
    oled.setCursor(0, 53);
    oled.print(calibrated ? "VP=X VN=Y" : "Check stick; reset EN");
  } else if (index == 0) {
    oled.println("PERFBOARD TEST");
    oled.printf("frame: %lu\n", static_cast<unsigned long>(frames[index]));
    oled.printf("time: %lu s\n", static_cast<unsigned long>(millis() / 1000));
    oled.print("ACK ");
    for (uint8_t i = 0; i < SCREEN_COUNT; ++i)
      oled.printf("%u:%c ", activeSlots[i], initialized[i] ? '+' : '-');
    oled.fillRect((frames[index] * 5) % 116, 55, 12, 7, SSD1306_WHITE);
  } else {
    oled.printf("frame: %lu\n", static_cast<unsigned long>(frames[index]));
    oled.printf("center: %d/%d\n", centerX, centerY);
    oled.setCursor(0, 35);
    oled.println(calibrated ? "CENTER CALIBRATED" : "CHECK JOYSTICK");
    oled.setCursor(0, 47);
    oled.println("Move L/R/U/D");
    oled.drawRect(0, 59, WIDTH, 5, SSD1306_WHITE);
    oled.fillRect(1, 60, (frames[index] * 7) % 126, 3, SSD1306_WHITE);
  }
  finishFrame(index);
}

void setup() {
  // No Serial connection or commands are needed for this sketch.
  releaseBus();
  pinMode(JOY_X, INPUT); pinMode(JOY_Y, INPUT);
  analogReadResolution(12);
  analogSetPinAttenuation(JOY_X, ADC_11db);
  analogSetPinAttenuation(JOY_Y, ADC_11db);
  delay(300); // Allow the OLED supplies to settle before discovery.
  if (AUTO_FIND_SCREENS) discoverScreens();
  for (uint8_t i = 0; i < SCREEN_COUNT; ++i) {
    if (!prepareDisplay(i)) continue;
    startFrame(i);
    panels[i].println("Leave joystick");
    panels[i].println("at CENTER...");
    panels[i].println("Auto calibration");
    finishFrame(i);
  }
  delay(2000);
  uint32_t x = 0, y = 0;
  for (uint8_t i = 0; i < 64; ++i) {
    sampleJoystick(); x += rawX; y += rawY;
    delay(5);
  }
  centerX = x / 64; centerY = y / 64;
  calibrated = centerX >= 500 && centerX <= 3500 && centerY >= 500 && centerY <= 3500;
  candidateAt = millis();
  // Immediately draw all three after calibration, including newly detected slots.
  for (uint8_t i = 0; i < SCREEN_COUNT; ++i) retryAt[i] = millis() - 2000;
  for (uint8_t i = 0; i < SCREEN_COUNT; ++i) drawScreen(i);
  lastFrame = millis();
}

void loop() {
  updateJoystick();
  if (millis() - lastFrame >= FRAME_INTERVAL_MS) {
    lastFrame = millis();
    // One refresh pass visits every screen. Each gets a fresh frame on every
    // pass; a missing module is skipped and retried by drawScreen().
    for (uint8_t i = 0; i < SCREEN_COUNT; ++i) drawScreen(i);
  }
  delay(1);
}
