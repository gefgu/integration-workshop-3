#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <string.h>

// One I2C controller switches between separate SDA pins. Both OLEDs share SCL.
constexpr int OLED1_SDA = 21; // ESP32 D21
constexpr int OLED2_SDA = 19; // ESP32 D19
constexpr int OLED_SCL = 22;  // ESP32 D22, shared
constexpr uint32_t I2C_FREQUENCY = 100000;
constexpr uint8_t OLED_ADDRESS = 0x3C;
constexpr int SCREEN_WIDTH = 128;
constexpr int SCREEN_HEIGHT = 64;
constexpr uint32_t CHAR_INTERVAL_MS = 90;
constexpr uint32_t PHRASE_PAUSE_MS = 1300;
constexpr uint32_t PAIR_PAUSE_MS = 1200;

Adafruit_SSD1306 screen1(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
Adafruit_SSD1306 screen2(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// User-provided lines, written one at a time and alternating screens.
const char* const phrases[] = {
    "Never gonna give you up",
    "Never gonna let you down",
    "Never gonna run around and desert you",
    "Never gonna make you cry",
    "Never gonna say goodbye",
    "Never gonna tell a lie and hurt you",
};
constexpr size_t PHRASE_COUNT = sizeof(phrases) / sizeof(phrases[0]);
int activeSda = -1;

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

void showPrefix(Adafruit_SSD1306& screen, int sdaPin, const char* phrase, size_t visibleChars) {
  if (!selectSda(sdaPin)) stopOnError("Could not select OLED SDA pin.");

  screen.clearDisplay();
  screen.setTextColor(SSD1306_WHITE);
  screen.setTextSize(1);
  screen.setTextWrap(true);
  screen.setCursor(0, 20);
  const size_t phraseLength = strlen(phrase);
  if (visibleChars > phraseLength) visibleChars = phraseLength;
  for (size_t i = 0; i < visibleChars; ++i) screen.write((uint8_t)phrase[i]);
  screen.display();
}

void setup() {
  Serial.begin(115200);

  if (!selectSda(OLED1_SDA)) stopOnError("Could not start I2C for screen 1.");
  if (!screen1.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS, true, false)) {
    stopOnError("Screen 1 not found at 0x3C. Check wiring.");
  }

  if (!selectSda(OLED2_SDA)) stopOnError("Could not start I2C for screen 2.");
  if (!screen2.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS, true, false)) {
    stopOnError("Screen 2 not found at 0x3C. Check wiring.");
  }

  Serial.println("Typewriter test started: one phrase at a time, alternating OLEDs.");
}

void loop() {
  showPrefix(screen1, OLED1_SDA, "", 0);
  showPrefix(screen2, OLED2_SDA, "", 0);

  for (size_t index = 0; index < PHRASE_COUNT; ++index) {
    Adafruit_SSD1306& screen = (index % 2 == 0) ? screen1 : screen2;
    const int sdaPin = (index % 2 == 0) ? OLED1_SDA : OLED2_SDA;
    const char* phrase = phrases[index];
    const size_t phraseLength = strlen(phrase);

    for (size_t count = 1; count <= phraseLength; ++count) {
      showPrefix(screen, sdaPin, phrase, count);
      delay(CHAR_INTERVAL_MS);
    }

    delay(PHRASE_PAUSE_MS);
  }

  // Pause on the completed lines before the sequence starts again.
  delay(PAIR_PAUSE_MS);
}
