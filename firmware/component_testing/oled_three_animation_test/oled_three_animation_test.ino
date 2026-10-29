#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <string.h>

// One I2C controller switches between three SDA pins. SCL is shared.
constexpr int SDA_PINS[] = {21, 19, 18}; // ESP32 D21, D19, D18
constexpr int OLED_SCL = 22;             // ESP32 D22
constexpr size_t SCREEN_COUNT = 3;
constexpr uint32_t I2C_FREQUENCY = 400000;
constexpr uint8_t OLED_ADDRESS = 0x3C;
constexpr int SCREEN_WIDTH = 128;
constexpr int SCREEN_HEIGHT = 64;

constexpr uint32_t LYRIC_CHAR_MS = 140;
constexpr uint32_t LYRIC_HOLD_MS = 1300;
constexpr uint32_t TED_CHAR_MS = 180;
constexpr uint32_t TED_HOLD_MS = 1200;
constexpr uint32_t DANCE_FRAME_MS = 450;

Adafruit_SSD1306 screen1(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
Adafruit_SSD1306 screen2(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
Adafruit_SSD1306 screen3(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
Adafruit_SSD1306* const screens[] = {&screen1, &screen2, &screen3};

const char* const lyrics[] = {
    "Never gonna give you up",
    "Never gonna let you down",
    "Never gonna run around and desert you",
    "Never gonna make you cry",
    "Never gonna say goodbye",
    "Never gonna tell a lie and hurt you",
};
constexpr size_t LYRIC_COUNT = sizeof(lyrics) / sizeof(lyrics[0]);

const char* const tedMessages[] = {
    "TEDTronics is awesome!",
    "TEDTronics is amazing!",
};

int activeSda = -1;
size_t lyricIndex = 0;
size_t lyricVisible = 0;
uint32_t lyricLastStep = 0;
uint32_t lyricHoldStart = 0;
bool lyricHolding = false;

size_t tedIndex = 0;
size_t tedVisible = 0;
uint32_t tedLastStep = 0;
uint32_t tedHoldStart = 0;
bool tedHolding = false;

uint8_t danceFrame = 0;
uint32_t danceLastFrame = 0;

bool selectSda(int sdaPin) {
  if (activeSda == sdaPin) return true;
  if (activeSda >= 0) Wire.end();
  if (!Wire.begin(sdaPin, OLED_SCL, I2C_FREQUENCY)) return false;
  activeSda = sdaPin;
  return true;
}

void stopOnError(const char* message) {
  Serial.println(message);
  while (true) delay(1000);
}

void showTyping(Adafruit_SSD1306& screen, int sdaPin, const char* text, size_t visible) {
  if (!selectSda(sdaPin)) stopOnError("Could not select OLED SDA pin.");
  screen.clearDisplay();
  screen.setTextColor(SSD1306_WHITE);
  screen.setTextSize(1);
  screen.setTextWrap(true);
  screen.setCursor(0, 22);
  const size_t length = strlen(text);
  if (visible > length) visible = length;
  for (size_t i = 0; i < visible; ++i) screen.write((uint8_t)text[i]);
  screen.display();
}

void drawNote(Adafruit_SSD1306& screen, int x, int y, bool raised) {
  screen.fillCircle(x, y, 2, SSD1306_WHITE);
  screen.drawLine(x + 2, y, x + 2, y - (raised ? 12 : 9), SSD1306_WHITE);
  screen.drawLine(x + 2, y - (raised ? 12 : 9), x + 7, y - (raised ? 10 : 7), SSD1306_WHITE);
}

void drawDancer(uint8_t frame) {
  if (!selectSda(SDA_PINS[1])) stopOnError("Could not select dancer screen SDA.");
  Adafruit_SSD1306& screen = screen2;
  screen.clearDisplay();
  screen.setTextColor(SSD1306_WHITE);
  screen.setTextSize(1);
  screen.setTextWrap(false);
  screen.setCursor(38, 4);
  screen.print("RICKROLL");
  screen.drawFastHLine(25, 14, 78, SSD1306_WHITE);

  const uint8_t pose = frame % 4;
  const int8_t leftArmX[] = {46, 45, 50, 43};
  const int8_t leftArmY[] = {28, 40, 24, 34};
  const int8_t rightArmX[] = {82, 84, 78, 86};
  const int8_t rightArmY[] = {39, 25, 34, 23};
  const int8_t leftLegX[] = {49, 57, 45, 55};
  const int8_t rightLegX[] = {79, 72, 84, 74};

  // Simple dancing stick figure: the limbs change pose on each frame.
  screen.drawCircle(64, 23, 6, SSD1306_WHITE);
  screen.drawPixel(62, 22, SSD1306_WHITE);
  screen.drawPixel(66, 22, SSD1306_WHITE);
  screen.drawLine(62, 26, 66, 26, SSD1306_WHITE);
  screen.drawLine(64, 29, 64, 45, SSD1306_WHITE);
  screen.drawLine(64, 32, leftArmX[pose], leftArmY[pose], SSD1306_WHITE);
  screen.drawLine(64, 32, rightArmX[pose], rightArmY[pose], SSD1306_WHITE);
  screen.drawLine(64, 45, leftLegX[pose], 59, SSD1306_WHITE);
  screen.drawLine(64, 45, rightLegX[pose], 59, SSD1306_WHITE);
  screen.drawLine(leftLegX[pose], 59, leftLegX[pose] - 4, 59, SSD1306_WHITE);
  screen.drawLine(rightLegX[pose], 59, rightLegX[pose] + 4, 59, SSD1306_WHITE);
  drawNote(screen, 27, 35, pose & 1);
  drawNote(screen, 99, 43, !(pose & 1));
  screen.display();
}

void updateLyrics(uint32_t now) {
  if (lyricHolding) {
    if (now - lyricHoldStart < LYRIC_HOLD_MS) return;
    lyricIndex = (lyricIndex + 1) % LYRIC_COUNT;
    lyricVisible = 0;
    lyricHolding = false;
    lyricLastStep = now;
  }
  if (now - lyricLastStep < LYRIC_CHAR_MS) return;
  lyricLastStep = now;
  const size_t length = strlen(lyrics[lyricIndex]);
  if (lyricVisible < length) {
    ++lyricVisible;
    showTyping(screen1, SDA_PINS[0], lyrics[lyricIndex], lyricVisible);
  } else {
    lyricHolding = true;
    lyricHoldStart = now;
  }
}

void updateTedMessage(uint32_t now) {
  if (tedHolding) {
    if (now - tedHoldStart < TED_HOLD_MS) return;
    tedIndex = (tedIndex + 1) % 2;
    tedVisible = 0;
    tedHolding = false;
    tedLastStep = now;
  }
  if (now - tedLastStep < TED_CHAR_MS) return;
  tedLastStep = now;
  const char* message = tedMessages[tedIndex];
  const size_t length = strlen(message);
  if (tedVisible < length) {
    ++tedVisible;
    showTyping(screen3, SDA_PINS[2], message, tedVisible);
  } else {
    tedHolding = true;
    tedHoldStart = now;
  }
}

void setup() {
  Serial.begin(115200);
  for (size_t i = 0; i < SCREEN_COUNT; ++i) {
    if (!selectSda(SDA_PINS[i])) stopOnError("Could not start I2C on an SDA pin.");
    if (!screens[i]->begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS, true, false)) {
      Serial.print("OLED ");
      Serial.print(i + 1);
      stopOnError(" not found at 0x3C. Check wiring.");
    }
  }

  Serial.println("Three-screen animation started.");
}

void loop() {
  const uint32_t now = millis();
  updateLyrics(now);
  updateTedMessage(now);
  if (now - danceLastFrame >= DANCE_FRAME_MS) {
    danceLastFrame = now;
    drawDancer(danceFrame++);
  }
}
