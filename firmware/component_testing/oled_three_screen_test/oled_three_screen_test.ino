#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// One ESP32 I2C controller switches among three SDA pins. SCL is shared.
constexpr int SDA_PINS[] = {21, 19, 18}; // ESP32 D21, D19, D18
constexpr int OLED_SCL = 22;             // ESP32 D22, shared by all screens
constexpr size_t SCREEN_COUNT = sizeof(SDA_PINS) / sizeof(SDA_PINS[0]);
constexpr uint32_t I2C_FREQUENCY = 100000;
constexpr uint8_t OLED_ADDRESS = 0x3C;
constexpr int SCREEN_WIDTH = 128;
constexpr int SCREEN_HEIGHT = 64;

Adafruit_SSD1306 screen1(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
Adafruit_SSD1306 screen2(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
Adafruit_SSD1306 screen3(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
Adafruit_SSD1306* const screens[] = {&screen1, &screen2, &screen3};

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

void showStatus(size_t index, uint32_t updateNumber) {
  if (!selectSda(SDA_PINS[index])) stopOnError("Could not select OLED SDA pin.");

  Adafruit_SSD1306& screen = *screens[index];
  screen.clearDisplay();
  screen.setTextColor(SSD1306_WHITE);
  screen.setTextSize(1);
  screen.setTextWrap(false);
  screen.setCursor(0, 20);
  screen.print("OLED ");
  screen.println(index + 1);
  screen.print("SDA D");
  screen.println(SDA_PINS[index]);
  screen.println("SCL D22 shared");
  screen.print("Update ");
  screen.println(updateNumber);
  screen.display();
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
    showStatus(i, 0);
  }

  Serial.println("Three OLED test running: separate SDA pins, shared SCL.");
}

void loop() {
  static uint32_t updateNumber = 1;
  for (size_t i = 0; i < SCREEN_COUNT; ++i) {
    showStatus(i, updateNumber);
    delay(700);
  }
  ++updateNumber;
}
