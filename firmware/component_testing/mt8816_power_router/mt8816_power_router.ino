#include <Arduino.h>
#include <driver/gpio.h>
#include <string.h>

// Classic ESP32. Four inverting controls, non-inverting STROBE, active-high source.
constexpr gpio_num_t ax0 = GPIO_NUM_18;
constexpr gpio_num_t ax1 = GPIO_NUM_19;
constexpr gpio_num_t ay0 = GPIO_NUM_21;
constexpr gpio_num_t resetPin = GPIO_NUM_22;
constexpr gpio_num_t sourceEnable = GPIO_NUM_23;
constexpr gpio_num_t strobe = GPIO_NUM_26;

void matrixLevel(gpio_num_t pin, bool high) {
  gpio_set_level(pin, high ? 0 : 1);
}

void allOff() {
  gpio_set_level(sourceEnable, 0);
  delay(10);  // Allow the source switch to open before changing the matrix.
  matrixLevel(resetPin, true);
  gpio_set_level(strobe, 0);
  delayMicroseconds(100);
  // Keep RESET asserted until the next valid route.
}

void closeCrosspoint(char node, bool groundBus) {
  const unsigned address = node - '0';  // Table 1 codes for X0, X1 and X2.
  matrixLevel(ax0, address & 1);
  matrixLevel(ax1, address & 2);
  matrixLevel(ay0, groundBus);
  delayMicroseconds(100);
  gpio_set_level(strobe, 1);
  delayMicroseconds(100);
  gpio_set_level(strobe, 0);
  delayMicroseconds(100);
}

bool isNode(const char *token) {
  return token && token[0] >= '0' && token[0] <= '2' && token[1] == '\0';
}

void handleCommand(char *line) {
  char *rest;
  const char *command = strtok_r(line, " \t\r", &rest);
  if (!command) return;
  const char *first = strtok_r(nullptr, " \t\r", &rest);
  const char *second = strtok_r(nullptr, " \t\r", &rest);
  const char *extra = strtok_r(nullptr, " \t\r", &rest);

  allOff();
  if (strcmp(command, "OFF") == 0 && !first) {
    Serial.println("OK OFF");
    return;
  }
  if (strcmp(command, "POWER") != 0 || !isNode(first) || !isNode(second)
      || first[0] == second[0] || extra) {
    Serial.println("ERR OFF. Use POWER <+5V node> <GND node>, or OFF.");
    return;
  }

  matrixLevel(resetPin, false);
  delayMicroseconds(100);
  closeCrosspoint(first[0], false);  // Y0 supplies +5 V.
  closeCrosspoint(second[0], true);  // Y1 supplies GND.
  gpio_set_level(sourceEnable, 1);
  delay(10);
  Serial.println("OK POWER");
}

void setup() {
  const gpio_num_t pins[] = {sourceEnable, resetPin, strobe, ax0, ax1, ay0};
  for (gpio_num_t pin : pins) {
    gpio_set_level(pin, 0);
    gpio_set_direction(pin, GPIO_MODE_OUTPUT);
  }
  allOff();
  Serial.begin(115200);
  Serial.println("OK OFF. Use POWER <+5V node> <GND node>, or OFF.");
}

void loop() {
  static char line[32];
  static size_t length = 0;
  static bool invalid = false;
  while (Serial.available()) {
    const int byte = Serial.read();
    if (byte == '\n') {
      if (invalid) {
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
}
