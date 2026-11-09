#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// Diagnostic for the current soldered board. No joystick, NFC, UART or outputs.
constexpr uint8_t SDA_PINS[] = {4, 16, 18, 17, 19, 21};
constexpr uint8_t SCL_PIN = 22, SLOT_COUNT = 6;
constexpr int WIDTH = 128, HEIGHT = 64;
constexpr uint32_t SLOT_INTERVAL_MS = 750; // Visit one port at a time, continuously.
constexpr uint32_t I2C_HZ = 50000; // Slow diagnostic clock for probing and drawing.
uint32_t cycle = 0, lastStep = 0;
uint8_t nextSlot = 0, foundThisCycle = 0;
bool cycleRunning = false;
bool busStarted = false, initialized[SLOT_COUNT] = {};
uint8_t addresses[SLOT_COUNT] = {};
int focusSlot = -1;

Adafruit_SSD1306 panels[] = {
  Adafruit_SSD1306(WIDTH, HEIGHT, &Wire, -1, I2C_HZ, I2C_HZ),
  Adafruit_SSD1306(WIDTH, HEIGHT, &Wire, -1, I2C_HZ, I2C_HZ),
  Adafruit_SSD1306(WIDTH, HEIGHT, &Wire, -1, I2C_HZ, I2C_HZ),
  Adafruit_SSD1306(WIDTH, HEIGHT, &Wire, -1, I2C_HZ, I2C_HZ),
  Adafruit_SSD1306(WIDTH, HEIGHT, &Wire, -1, I2C_HZ, I2C_HZ),
  Adafruit_SSD1306(WIDTH, HEIGHT, &Wire, -1, I2C_HZ, I2C_HZ)
};

void releaseBus() {
  if (busStarted) Wire.end();
  busStarted = false;
  for (uint8_t pin : SDA_PINS) pinMode(pin, INPUT);
  pinMode(SCL_PIN, INPUT);
}

bool selectSlot(uint8_t slot) {
  releaseBus();
  if (!Wire.begin(SDA_PINS[slot], SCL_PIN, I2C_HZ)) return false;
  busStarted = true;
  Wire.setTimeOut(25);
  delay(2);
  return true;
}

uint8_t probe(uint8_t address) {
  Wire.beginTransmission(address);
  return Wire.endTransmission();
}

const char* resultName(uint8_t error) {
  if (error == 0) return "ACK";
  if (error == 2) return "NO ACK";
  if (error == 5) return "TIMEOUT";
  return "BUS ERROR";
}

void drawDiagnostic(uint8_t slot, uint8_t address) {
  Adafruit_SSD1306& oled = panels[slot];
  if (!initialized[slot] || addresses[slot] != address) {
    // Allocation success is not hardware verification; address was probed above.
    if (!oled.begin(SSD1306_SWITCHCAPVCC, address, false, false)) {
      initialized[slot] = false;
      Serial.println("  FRAMEBUFFER FAILED: display RAM allocation failed.");
      return;
    }
    initialized[slot] = true;
    addresses[slot] = address;
    oled.ssd1306_command(SSD1306_SETCONTRAST);
    oled.ssd1306_command(0xCF);
    oled.setTextColor(SSD1306_WHITE);
    oled.clearDisplay();
    oled.fillRect(0, 0, WIDTH, HEIGHT, SSD1306_WHITE);
    oled.display();
    delay(350); // A new screen should briefly light up white.
    oled.clearDisplay();
    oled.display();
    delay(100);
  }
  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);
  oled.setTextWrap(false);
  oled.setTextSize(2);
  oled.setCursor(0, 0);
  oled.printf("OLED %u", slot);
  oled.setTextSize(1);
  oled.setCursor(0, 21);
  oled.printf("SDA%u SCL%u 0x%02X\n", SDA_PINS[slot], SCL_PIN, address);
  oled.printf("USB TEST cycle %lu\n", static_cast<unsigned long>(cycle));
  oled.println("I2C ACK - CHECK IMAGE");
  oled.drawRect(0, 52, WIDTH, 12, SSD1306_WHITE);
  oled.fillRect((cycle * 9) % 114 + 1, 54, 12, 8, SSD1306_WHITE);
  oled.display();
  const uint8_t after = probe(address);
  Serial.printf("  Pattern sent. Post-frame probe: %s (%u).\n", resultName(after), after);
  Serial.println("  Confirm WHITE flash, OLED number and moving block by eye.");
  if (after != 0) initialized[slot] = false;
}

bool debugSlot(uint8_t slot, bool fullScan) {
  Serial.printf("OLED%u SDA=GPIO%u SCL=GPIO%u: ", slot, SDA_PINS[slot], SCL_PIN);
  if (!selectSlot(slot)) {
    Serial.println("Wire.begin FAILED");
    initialized[slot] = false;
    return false;
  }
  const int sda = digitalRead(SDA_PINS[slot]), scl = digitalRead(SCL_PIN);
  Serial.printf("idle SDA=%d SCL=%d\n", sda, scl);
  if (!sda || !scl) {
    Serial.println("  LINE LOW (empty SDA can float). If a module is connected, check wiring/power.");
    Serial.println("  SCL is shared: one faulty connection can affect all screens.");
    initialized[slot] = false;
    releaseBus();
    return false;
  }
  const uint8_t a = probe(0x3C), b = probe(0x3D);
  Serial.printf("  0x3C: %s (%u); 0x3D: %s (%u)\n", resultName(a), a, resultName(b), b);
  if (fullScan && a != 5 && b != 5) {
    for (uint8_t address = 0x08; address <= 0x77; ++address) {
      if (address == 0x3C || address == 0x3D) continue;
      const uint8_t error = probe(address);
      if (!error) Serial.printf("  OTHER ADDRESS ACK: 0x%02X (not initialized as SSD1306)\n", address);
      if (error == 5) { Serial.println("  Full scan aborted on timeout."); break; }
    }
  }
  const uint8_t address = a == 0 ? 0x3C : b == 0 ? 0x3D : 0;
  if (a == 0 && b == 0) Serial.println("  WARNING: both OLED addresses ACK on this SDA.");
  if (address) drawDiagnostic(slot, address);
  else {
    initialized[slot] = false;
    addresses[slot] = 0;
    Serial.println("  No OLED found. Check 3.3 V AT THE MODULE, GND and its pin order.");
  }
  releaseBus();
  return address != 0;
}

void startCycle() {
  ++cycle;
  foundThisCycle = 0;
  cycleRunning = true;
  Serial.printf("\n=== OLED DEBUG cycle %lu, uptime %lu s, scan %lu Hz ===\n",
                static_cast<unsigned long>(cycle), static_cast<unsigned long>(millis() / 1000),
                static_cast<unsigned long>(I2C_HZ));
}

void finishCycle() {
  Serial.printf("SUMMARY: %u OLED ports ACK in this cycle.\n", foundThisCycle);
  Serial.println("ACK/idle HIGH do NOT prove display pixels, 3.3 V supply or correct soldering.");
  if (focusSlot < 0) Serial.println("Cycling OLED0 -> OLED1 -> OLED2 -> OLED3 -> OLED4 -> OLED5 automatically.");
  else Serial.printf("Focused on OLED%d; send a to cycle all six ports.\n", focusSlot);
  Serial.println("Commands: s=scan, f=full scan, 0..5=focus slot, a=all.");
  cycleRunning = false;
}

void report(bool fullScan) {
  startCycle();
  for (uint8_t slot = 0; slot < SLOT_COUNT; ++slot)
    if (focusSlot < 0 || slot == focusSlot) foundThisCycle += debugSlot(slot, fullScan);
  finishCycle();
  nextSlot = 0;
  lastStep = millis();
}

void setup() {
  Serial.begin(115200);
  releaseBus();
  delay(2000);
  Serial.println("\nPERFBOARD OLED DEBUG - USB only, external supply disconnected, JP_EXT open.");
  Serial.println("Map OLED0..5 = GPIO4,16,18,17,19,21; shared SCL=GPIO22.");
  Serial.println("Auto cycle: OLED0..5, pause 750 ms between ports; no Serial command needed.");
  lastStep = millis() - SLOT_INTERVAL_MS;
}

void loop() {
  while (Serial.available()) {
    const char ch = Serial.read();
    if (ch >= '0' && ch <= '5') { focusSlot = ch - '0'; report(false); }
    else if (ch == 'a') { focusSlot = -1; report(false); }
    else if (ch == 's') report(false);
    else if (ch == 'f') report(true);
  }
  if (millis() - lastStep >= SLOT_INTERVAL_MS) {
    if (!cycleRunning) startCycle();
    if (focusSlot >= 0) {
      foundThisCycle += debugSlot(static_cast<uint8_t>(focusSlot), false);
      finishCycle();
    } else {
      foundThisCycle += debugSlot(nextSlot, false);
      if (++nextSlot >= SLOT_COUNT) { nextSlot = 0; finishCycle(); }
    }
    lastStep = millis();
  }
  delay(5);
}
