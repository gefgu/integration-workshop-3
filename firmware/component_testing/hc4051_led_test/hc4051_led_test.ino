#include <Arduino.h>
#include <driver/gpio.h>

constexpr gpio_num_t seletorS0 = GPIO_NUM_18;
constexpr gpio_num_t seletorS1 = GPIO_NUM_19;
constexpr unsigned quantidadeLeds = 3;  // Canais consecutivos a partir do canal 0.
static_assert(quantidadeLeds >= 1 && quantidadeLeds <= 4, "S2 em GND permite de 1 a 4 LEDs.");
constexpr gpio_num_t habilitacao = GPIO_NUM_23;

void setup() {
  // EN alto desliga o mux. Em dreno aberto, o resistor sobe EN para 3V3.
  gpio_set_level(habilitacao, 1);
  gpio_set_direction(habilitacao, GPIO_MODE_OUTPUT_OD);

  pinMode(seletorS0, OUTPUT);
  pinMode(seletorS1, OUTPUT);
}

void loop() {
  static unsigned canal = 0;

  gpio_set_level(habilitacao, 1);  // Desliga antes de trocar o canal.
  delayMicroseconds(10);
  digitalWrite(seletorS0, canal & 1);
  digitalWrite(seletorS1, (canal >> 1) & 1);
  delayMicroseconds(10);
  gpio_set_level(habilitacao, 0);

  delay(1000);
  canal = (canal + 1) % quantidadeLeds;
}
