#include <Arduino.h>
#include <stdio.h>
#include <string.h>

// Standalone classic ESP32 test. GPIO16/17 are SDA lines in the full project:
// disconnect that hardware before running this temporary UART pin mapping.
constexpr int PI_RX = 16; // RX2: receives from Pi TX (physical pin 8).
constexpr int PI_TX = 17; // TX2: sends to Pi RX (physical pin 10).
constexpr uint32_t BAUD = 115200;
HardwareSerial piLink(2);

char line[96];
size_t lineLength = 0;
bool discardLine = false;
uint32_t lastEventAt = 0;
unsigned long eventId = 0;
const char* directions[] = {"LEFT", "RIGHT", "UP", "DOWN"};

void handleLine(const char* message) {
  Serial.printf("Pi -> ESP32: %s\n", message);
  unsigned long id;
  char extra;
  if (sscanf(message, "PING %lu %c", &id, &extra) == 1) {
    piLink.printf("PONG %lu\n", id);
    Serial.printf("ESP32 -> Pi: PONG %lu\n", id);
  } else if (sscanf(message, "ACK %lu %c", &id, &extra) == 1) {
    Serial.printf("Pi acknowledged simulated joystick event %lu\n", id);
  } else {
    piLink.println("ERR UNKNOWN_COMMAND");
  }
}

void setup() {
  Serial.begin(115200); // USB debug monitor; separate from the Pi UART.
  piLink.begin(BAUD, SERIAL_8N1, PI_RX, PI_TX);
  delay(500);
  Serial.println("UART-only demo: RX2=GPIO16, TX2=GPIO17, 115200 8N1.");
  Serial.println("No joystick, Wi-Fi, or smart-component outputs are initialized.");
  Serial.println("Waiting for Pi PING; also sending one simulated direction/second.");
  lastEventAt = millis();
}

void loop() {
  // Limit receive work so a stream without newlines cannot stall the demo.
  for (int count = 0; count < 128 && piLink.available(); ++count) {
    const char ch = static_cast<char>(piLink.read());
    if (ch == '\r') continue;
    if (ch == '\n') {
      if (!discardLine && lineLength) {
        line[lineLength] = '\0';
        handleLine(line);
      }
      lineLength = 0;
      discardLine = false;
    } else if (!discardLine) {
      if (ch < 32 || ch > 126 || lineLength >= sizeof(line) - 1) {
        discardLine = true;
        lineLength = 0;
        Serial.println("Discarding invalid/overlong UART line until newline.");
      } else {
        line[lineLength++] = ch;
      }
    }
  }

  const uint32_t now = millis();
  if (now - lastEventAt >= 1000) {
    lastEventAt = now;
    const char* direction = directions[eventId % 4];
    ++eventId;
    piLink.printf("JOY %lu %s\n", eventId, direction);
    Serial.printf("ESP32 -> Pi: JOY %lu %s\n", eventId, direction);
  }
  delay(1);
}
