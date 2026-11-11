// ESP32 GPIO14 continuity/enable test. Re-upload the lesson firmware afterwards.
// Disconnect the switch input or its load for the first measurements.
constexpr int TEST_PIN = 14;
void setup() {
  digitalWrite(TEST_PIN, LOW);
  pinMode(TEST_PIN, OUTPUT);
  Serial.begin(115200);
  digitalWrite(TEST_PIN, HIGH);
  Serial.println("GPIO14 HIGH continuously; measure relative to ESP32 GND");
}

void loop() {}
