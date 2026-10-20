#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ESP32 DevKit V1: use one I2C controller and switch its SDA pin between
// displays. The screens share GPIO22 (SCL), but keep separate SDA wires.
constexpr int OLED1_SDA = 21; // D21
constexpr int OLED2_SDA = 19; // D19
constexpr int OLED_SCL = 22;  // D22, shared by both screens
constexpr uint32_t I2C_FREQUENCY = 100000;
constexpr uint8_t OLED_ADDRESS = 0x3C;
constexpr int SCREEN_WIDTH = 128;
constexpr int SCREEN_HEIGHT = 64;

Adafruit_SSD1306 screen1(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
Adafruit_SSD1306 screen2(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

bool selectSda(int sdaPin) {
  Wire.end();
  return Wire.begin(sdaPin, OLED_SCL, I2C_FREQUENCY);
}

void setup() {
  Serial.begin(115200);

  if (!selectSda(OLED1_SDA)) {
    Serial.println("Could not start I2C for screen 1.");
    while (true) delay(1000);
  }
  if (!screen1.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS, true, false)) {
    Serial.println("Could not initialize screen 1 at 0x3C. Check wiring and power.");
    while (true) delay(1000);
  }

  if (!selectSda(OLED2_SDA)) {
    Serial.println("Could not start I2C for screen 2.");
    while (true) delay(1000);
  }
  if (!screen2.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS, true, false)) {
    Serial.println("Could not initialize screen 2 at 0x3C. Check wiring and power.");
    while (true) delay(1000);
  }

  // Send each frame only while its own SDA line is selected. Both panels
  // share the clock, but only the selected panel sees an I2C start condition.
  selectSda(OLED1_SDA);
  screen1.clearDisplay();
  screen1.setTextColor(SSD1306_WHITE);
  screen1.setTextSize(1);
  screen1.setCursor(0, 20);
  screen1.println("Screen 1 works");
  screen1.println("SDA = D21");
  screen1.println("SCL = D22 shared");
  screen1.display();

  selectSda(OLED2_SDA);
  screen2.clearDisplay();
  screen2.setTextColor(SSD1306_WHITE);
  screen2.setTextSize(1);
  screen2.setCursor(0, 20);
  screen2.println("Screen 2 works");
  screen2.println("SDA = D19");
  screen2.println("SCL = D22 shared");
  screen2.display();

  Serial.println("Both OLEDs initialized: one I2C controller, switched SDA, shared SCL.");
}

void loop() {
  delay(1000);
}
