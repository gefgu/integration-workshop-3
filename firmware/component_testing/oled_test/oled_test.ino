#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ESP32 DevKit V1 shown in the setup photo:
// SDA = GPIO21 (D21), SCL = GPIO22 (D22).
constexpr int OLED_SDA = 21;
constexpr int OLED_SCL = 22;
constexpr uint8_t OLED_ADDRESS = 0x3C;
constexpr int SCREEN_WIDTH = 128;
constexpr int SCREEN_HEIGHT = 64;

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

void setup() {
  Serial.begin(115200);
  Wire.begin(OLED_SDA, OLED_SCL);

  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS)) {
    Serial.println("SSD1306 not found at 0x3C. Check wiring and OLED address.");
    while (true) {
      delay(1000);
    }
  }

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);

  // Split across two lines so the full phrase fits the 128-pixel display.
  display.setCursor(20, 24);
  display.println("Never gonna");
  display.setCursor(32, 38);
  display.println("give you up");
  display.display();

  Serial.println("OLED test displayed successfully.");
}

void loop() {
  delay(1000);
}
