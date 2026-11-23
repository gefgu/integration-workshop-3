#include <Arduino.h>
#include <driver/gpio.h>
#include <string.h>

// Classic ESP32, both HC4051s powered from the same 3.3 V rail.
constexpr gpio_num_t sourceSelect[] = {GPIO_NUM_18, GPIO_NUM_19, GPIO_NUM_25};
constexpr gpio_num_t groundSelect[] = {GPIO_NUM_21, GPIO_NUM_22, GPIO_NUM_26};
// Active-low bank enables. Each EN has its own external 10 kΩ pull-up.
constexpr gpio_num_t bankEnable[] = {GPIO_NUM_23, GPIO_NUM_32};
constexpr unsigned nodeCount = 8;

// Set false to start in serial command mode with both muxes disabled.
constexpr bool sweepOnBoot = true;
constexpr unsigned long sweepIntervalMs = 125;
bool sweeping = sweepOnBoot;
unsigned sweepBank = 0;
unsigned sweepSource = 0;
unsigned long lastSweepStep = 0;

void allOff() {
  for (gpio_num_t pin : bankEnable) gpio_set_level(pin, 1);
  delayMicroseconds(10);      // Let EN rise before touching the address lines.
}

void selectNode(const gpio_num_t (&pins)[3], unsigned node) {
  gpio_set_level(pins[0], node & 1);
  gpio_set_level(pins[1], (node >> 1) & 1);
  gpio_set_level(pins[2], (node >> 2) & 1);
}

void applyRoute(unsigned bank, unsigned source, unsigned ground) {
  allOff();
  selectNode(sourceSelect, source);
  selectNode(groundSelect, ground);
  delayMicroseconds(10);
  gpio_set_level(bankEnable[bank], 0);
  Serial.printf("OK POWER %u %u - 3.3V source on node %u, GND on node %u - bank %c\n",
                source, ground, source, ground, 'A' + bank);
}

void advanceSweep() {
  const unsigned ground = (sweepSource + 1) % nodeCount;
  applyRoute(sweepBank, sweepSource, ground);
  sweepSource = ground;
  if (sweepSource == 0) sweepBank = 1 - sweepBank;
  lastSweepStep = millis();
}

bool isNode(const char *token) {
  return token && token[0] >= '0' && token[0] <= '7' && token[1] == '\0';
}

void handleCommand(char *line) {
  char *rest;
  const char *command = strtok_r(line, " \t\r", &rest);
  if (!command) return;  // Ignore empty serial lines.
  const char *first = strtok_r(nullptr, " \t\r", &rest);
  const char *second = strtok_r(nullptr, " \t\r", &rest);
  const char *third = strtok_r(nullptr, " \t\r", &rest);
  const char *extra = strtok_r(nullptr, " \t\r", &rest);

  if (strcmp(command, "PING") == 0 && !first) {
    Serial.println("OK PONG");
    return;
  }

  sweeping = false;
  if (strcmp(command, "OFF") == 0 && !first) {
    allOff();
    Serial.println("OK OFF");
    return;
  }
  unsigned bank = 0;
  if (first && (strcmp(first, "A") == 0 || strcmp(first, "B") == 0)) {
    bank = first[0] - 'A';
    first = second;
    second = third;
  } else if (third) {
    extra = third;
  }
  if (strcmp(command, "POWER") != 0 || !isNode(first) || !isNode(second)
      || first[0] == second[0] || extra) {
    allOff();
    Serial.println("ERR OFF. Use PING, OFF, or POWER [A|B] <source 0-7> <GND 0-7> with different nodes.");
    return;
  }

  applyRoute(bank, first[0] - '0', second[0] - '0');
}

void setup() {
  for (gpio_num_t pin : bankEnable) {
    gpio_set_level(pin, 1);
    gpio_set_direction(pin, GPIO_MODE_OUTPUT);
  }
  allOff();

  for (gpio_num_t pin : {sourceSelect[0], sourceSelect[1], sourceSelect[2],
                         groundSelect[0], groundSelect[1], groundSelect[2]}) {
    gpio_set_level(pin, 0);
    gpio_set_direction(pin, GPIO_MODE_OUTPUT);
  }

  Serial.begin(115200);
  Serial.println("READY HC4051 router - two banks, 8 nodes each - 115200 baud");
  Serial.println("OK OFF");
  Serial.println("Commands: PING, OFF, POWER [A|B] <source node> <GND node>");
  if (sweeping) advanceSweep();
}

void loop() {
  static char line[32];
  static size_t length = 0;
  static bool invalid = false;
  while (Serial.available()) {
    const int byte = Serial.read();
    if (byte == '\n') {
      if (invalid) {
        sweeping = false;
        allOff();
        Serial.println("ERR OFF. Invalid input line.");
      } else {
        line[length] = '\0';
        handleCommand(line);
      }
      length = 0;
      invalid = false;
    } else if (byte <= 0 || length == sizeof(line) - 1) {
      invalid = true;
    } else if (!invalid) {
      line[length++] = static_cast<char>(byte);
    }
  }
  if (sweeping && millis() - lastSweepStep >= sweepIntervalMs) {
    advanceSweep();
  }
}
