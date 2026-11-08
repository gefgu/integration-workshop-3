// TedTronics bench controls: KY-023 joystick + Energizar button -> Raspberry Pi over UART.
//
// The student never touches the screen. This ESP32 reads the joystick and the Energizar button and sends
// one line per action; the bench service turns each line into a key press on the bench screen (see README.md).
//
//   ESP32 -> Pi   HELLO controles 1             at boot, and in reply to HELLO?
//                 KEY <id> UP|DOWN|LEFT|RIGHT   joystick pushed past the dead zone (repeats while held)
//                 KEY <id> OK                   joystick clicked (released before LONG_PRESS_MS)
//                 KEY <id> MENU                 joystick click held for LONG_PRESS_MS (opens the game menu)
//                 KEY <id> ENERGIZAR            Energizar button pressed
//                 PONG <n>                      reply to PING <n>
//   Pi -> ESP32   ACK <id>                      the key was delivered
//                 PING <n>                      link check
//                 HELLO?                        who are you
//
// 115200 baud, 8N1, ASCII lines ending in "\n". Classic ESP32 DevKit (ESP32-WROOM), board "ESP32 Dev Module".
// The same lines go to the Pi's GPIO UART (UART2) and over the USB cable, so the bench service can use the
// Pi link (--controls /dev/serial0) or the ESP32 plugged into a PC (--controls COM4). Debug lines start with "#".
#include <Arduino.h>
#include <stdio.h>
#include <string.h>

// ---- pins (classic ESP32; GPIO numbers, not header positions) ----
constexpr uint8_t JOY_X = 34;      // VRx -> GPIO34 (ADC1, input-only: works with Wi-Fi on)
constexpr uint8_t JOY_Y = 35;      // VRy -> GPIO35 (ADC1, input-only)
constexpr uint8_t JOY_SW = 27;     // SW  -> GPIO27 (internal pull-up on; an external 10k to 3V3 is optional)
constexpr uint8_t ENERGIZE = 32;   // button between GPIO32 and GND (internal pull-up on; external 10k recommended)
constexpr int PI_RX = 16;          // RX2 <- Pi TXD (physical pin 8)
constexpr int PI_TX = 17;          // TX2 -> Pi RXD (physical pin 10)
constexpr uint32_t BAUD = 115200;

// ---- joystick orientation: fix here after mounting, not in the Pi ----
constexpr bool SWAP_XY = false;    // true if pushing up/down moves the X reading
constexpr bool INVERT_X = false;   // true if left/right come out swapped
constexpr bool INVERT_Y = true;    // true if up/down come out swapped (the bench's joystick: yes)

// ---- timing ----
constexpr int DEAD_ZONE = 1300;            // counts from center (0..4095) before a push counts (most of the travel)
constexpr int RELEASE_ZONE = 400;          // back within this = released (hysteresis)
constexpr uint32_t PUSH_STABLE_MS = 50;    // a push must hold its direction this long (no diagonal flicker)
constexpr uint32_t RELEASE_STABLE_MS = 120;  // and come back to center this long before the next push
                                             // (the spring bouncing past center is not a push the other way)
constexpr uint32_t REPEAT_DELAY_MS = 1000; // holding a direction repeats it after this...
constexpr uint32_t REPEAT_EVERY_MS = 450;  // ...every this many ms (scrolling through a long list)
constexpr uint32_t DEBOUNCE_MS = 20;
constexpr uint32_t LONG_PRESS_MS = 800;
constexpr uint32_t SAMPLE_MS = 5;

HardwareSerial pi(2);

struct Button {
  uint8_t pin;
  bool stable = false;  // true = pressed (after debounce)
  bool raw = false;
  bool armed = false;   // a button held at boot only counts after it is released once
  uint32_t changedAt = 0;
  uint32_t pressedAt = 0;
  explicit Button(uint8_t p) : pin(p) {}
};

// One receive buffer per link (the Pi's UART and the USB cable).
struct LineReader {
  Stream& port;
  char line[64];
  size_t length = 0;
  bool discarding = false;
  explicit LineReader(Stream& p) : port(p) {}
};

Button sw(JOY_SW);
Button energize(ENERGIZE);
LineReader piReader(pi);
LineReader usbReader(Serial);
int centerX = 2048, centerY = 2048;
bool joystickOk = false;  // false while the axes read like an unplugged joystick (center far from mid-scale)
uint32_t lastCalibration = 0;
const char* heldDirection = nullptr;   // the push being held (sent), nullptr when released
const char* candidate = nullptr;       // a push not yet stable
uint32_t candidateSince = 0, centeredSince = 0, directionSince = 0, lastRepeat = 0;
bool longSent = false;
unsigned long keyId = 0;
uint32_t lastSample = 0;

int readAxis(uint8_t pin) {
  uint32_t sum = 0;
  for (int i = 0; i < 4; ++i) sum += analogRead(pin);
  return sum / 4;
}

void sendKey(const char* name) {
  ++keyId;
  pi.printf("KEY %lu %s\n", keyId, name);
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
    Serial.printf("# joystick not found (X=%d Y=%d): check +5V->3V3, GND, VRx->GPIO34, VRy->GPIO35\n",
                  centerX, centerY);
  }
  joystickOk = ok;
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
  int dx = readAxis(JOY_X) - centerX;
  int dy = readAxis(JOY_Y) - centerY;
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
  bool centered = false;
  const char* dir = readDirection(centered);
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

void handleLine(Stream& port, const char* message) {
  unsigned long n;
  char extra;
  if (sscanf(message, "PING %lu %c", &n, &extra) == 1) {
    port.printf("PONG %lu\n", n);
  } else if (sscanf(message, "ACK %lu %c", &n, &extra) == 1) {
    // delivered
  } else if (strcmp(message, "HELLO?") == 0) {
    port.println("HELLO controles 1");
  } else {
    port.println("ERR UNKNOWN_COMMAND");
  }
}

void readLink(LineReader& r) {
  for (int count = 0; count < 128 && r.port.available(); ++count) {
    const char ch = static_cast<char>(r.port.read());
    if (ch == '\r') continue;
    if (ch == '\n') {
      if (!r.discarding && r.length) {
        r.line[r.length] = '\0';
        handleLine(r.port, r.line);
      }
      r.length = 0;
      r.discarding = false;
    } else if (r.discarding || r.length >= sizeof(r.line) - 1) {
      r.discarding = true;  // oversized line: drop it up to the next newline
    } else {
      r.line[r.length++] = ch;
    }
  }
}

void setup() {
  Serial.begin(BAUD);
  pi.begin(BAUD, SERIAL_8N1, PI_RX, PI_TX);
  pinMode(JOY_SW, INPUT_PULLUP);
  pinMode(ENERGIZE, INPUT_PULLUP);
  analogReadResolution(12);
  delay(200);
  calibrate();
  // A button already pressed at power-on only counts after it is released.
  sw.stable = sw.raw = digitalRead(JOY_SW) == LOW;
  sw.armed = !sw.stable;
  energize.stable = energize.raw = digitalRead(ENERGIZE) == LOW;
  energize.armed = !energize.stable;
  Serial.println("# TedTronics controls: UART2 RX=GPIO16 TX=GPIO17 and USB, 115200 8N1");
  pi.println("HELLO controles 1");
  Serial.println("HELLO controles 1");
}

void loop() {
  readLink(piReader);
  readLink(usbReader);
  const uint32_t now = millis();
  if (now - lastSample < SAMPLE_MS) return;
  lastSample = now;

  // No joystick yet (unplugged or no power): try the center again every 3 s instead of sending noise.
  if (!joystickOk && now - lastCalibration >= 3000) calibrate();

  // Joystick directions: one KEY per push, repeating slowly while held so long lists can be scrolled.
  if (joystickOk) updateJoystick(now);

  // Joystick click: short = OK (confirms a choice), held = MENU (sent once long enough).
  const int click = update(sw, now);
  if (click > 0) longSent = false;
  if (sw.stable && sw.armed && !longSent && now - sw.pressedAt >= LONG_PRESS_MS) {
    longSent = true;
    sendKey("MENU");
  }
  if (click < 0 && !longSent) sendKey("OK");

  // Energizar: on press, no repeat.
  if (update(energize, now) > 0) sendKey("ENERGIZAR");
}
