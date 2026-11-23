# Voltímetro de seis pontas com a UART da Raspberry Pi

A montagem usa a **ESP32 da placa dos componentes inteligentes** para medir seis contatos e mostrar **três diferenças de tensão**, uma em cada OLED. A **ESP32 do roteador** continua responsável por selecionar os nós que recebem a fonte de 3,3 V e o retorno. Os divisores ficam em uma protoboard externa. Nesta etapa, deixe o RC522 e o pulso desconectados.

Este é o plano de montagem e de integração. O [firmware atual da placa inteligente](perfboard_stage1_test.ino) ainda mostra uma tensão de demonstração. A leitura real das seis pontas em conjunto precisa ser implementada antes de ligar os divisores à placa.

## 1. Separe as peças

- Uma protoboard pequena, com espaço para seis junções independentes.
- **12 resistores de 10 kΩ**, de preferência ±1%. Use dois por ponta.
- Seis jumpers removíveis dos contatos do tabuleiro às entradas dos divisores.
- Seis jumpers das saídas dos divisores aos GPIOs da ESP32 inteligente e jumpers para o GND comum.
- A placa inteligente com suas OLEDs e o roteador de 3,3 V. O roteador conserva o resistor de 560 Ω no ramal da fonte.

## 2. Confira os GPIOs na placa inteligente

Os números abaixo são **GPIOs da ESP32 inteligente**, identificados pelos rótulos da placa. Planeje uma entrada por ponta, mesmo que os contatos escolhidos mudem depois.

| Medição | Ponta P1 | Ponta P2 | Mostra |
|---|---|---|---|
| Telinha 1 | GPIO34 · ADC1 | GPIO35 · ADC1 | P1 da telinha 1 − P2 da telinha 1 |
| Telinha 2 | GPIO13 · ADC2 | GPIO25 · ADC2 | P1 da telinha 2 − P2 da telinha 2 |
| Telinha 3 | GPIO27 · ADC2 | GPIO14 · ADC2 | P1 da telinha 3 − P2 da telinha 3 |

- **GPIO14** é `TEST_ENABLE` no `perfboard_stage1_test`. Com a alimentação desligada, desconecte o circuito externo de teste desse GPIO. Antes de conectar o divisor, grave a versão de firmware que configura GPIO14 como **entrada analógica** e desativa a configuração de saída e todos os acionamentos de `TEST_ENABLE`.
- Confirme que **GPIO13, GPIO25, GPIO27, GPIO34 e GPIO35** estão livres fisicamente. Para esta montagem externa, as saídas dos divisores chegam direto aos GPIOs. Se houver divisores ou outros circuitos já ligados a esses pinos na placa, confira a ligação antes de conectar a protoboard.
- Mantenha o **Wi-Fi desligado** nesta ESP32, pois quatro entradas usam ADC2. GPIO36 e GPIO39 continuam no joystick.

## 3. Monte os seis divisores

Desligue os USBs e a alimentação antes de mexer nos fios. Faça **uma fileira para cada ponta**. Repita este desenho seis vezes:

```text
Contato do tabuleiro ── jumper ── 10 kΩ ──●── jumper para o GPIO da tabela
                                         └── 10 kΩ ── GND comum
```

1. Coloque uma perna de cada resistor na mesma fileira, no mesmo lado da canaleta. Esse ponto é a junção `●`.
2. Ligue a outra perna do primeiro resistor ao fio que vem do **contato medido**.
3. Ligue a outra perna do segundo resistor ao **barramento de GND**.
4. Puxe o fio do **GPIO a partir da junção**. Etiquete cada entrada e saída, por exemplo `T1-P1` e `T1-P2`.
5. Una o GND da protoboard ao **GND fixo da ESP32 do roteador** e ao **GND da ESP32 inteligente**. As seis junções ficam separadas. A protoboard dos divisores dispensa um fio de 3V3.

A ponta P2 também é um sinal medido. Ligue-a ao contato desejado através do divisor, inclusive quando esse contato puder virar fonte em outra rota. O **GND comum** é a referência fixa do sistema.

## 4. Mantenha a UART da Raspberry Pi

O conector `J_UART` da placa inteligente continua com três fios. Confirme a orientação e os rótulos na placa.

| `J_UART` na placa inteligente | Raspberry Pi |
|---|---|
| Pino 1 · GND | GND |
| Pino 2 · ESP_TX / GPIO33 | RX · pino físico 10 |
| Pino 3 · ESP_RX / GPIO32 | TX · pino físico 8 |

A UART usa sinais de **3,3 V** e o cabo leva GND, TX e RX. Cada placa usa sua própria alimentação. Preserve também o SCL das OLEDs no GPIO22 e os fios SDA individuais já testados. No sketch de bancada, os slots OLED 0, 1 e 2 usam SDA **GPIO4, GPIO16 e GPIO18**, respectivamente. Confira a numeração das telinhas pela identificação do teste atual.

## 5. Integre a leitura ao firmware e confira na bancada

Use o [`perfboard_stage1_test.ino`](perfboard_stage1_test.ino) como base para manter o mapeamento das telas, do joystick e da UART. Na versão para esta montagem, cada par deve ter suas próprias leituras no lugar do valor de `demoResistorVoltage()`.

Cada divisor entrega metade da tensão do contato ao ADC. Leia as seis entradas em milivolts com atenuação adequada, multiplique cada leitura por **2** e calcule **P1 − P2** para cada tela. Com **3,3 V** na ponta, a junção do divisor fica nominalmente em **1,65 V**. As seis entradas são lidas em sequência e as telas podem mostrar juntas as três diferenças de uma **rota estável**. Cada contato medido precisa ficar entre GND e 3,3 V neste ensaio.

1. **Valide uma telinha primeiro.** Com as duas pontas da telinha 1 no GND fixo, espere uma diferença próxima de zero.
2. **Confira a polaridade.** Ligue P1 ao nó 2 e P2 ao nó 3. No roteador, mande `POWER 2 3` para manter uma rota fixa. Espere leitura positiva. Mande `POWER 3 2` sem mover as pontas e espere leitura negativa. A tensão sob carga pode ficar abaixo de 3,3 V.
3. **Repita para os outros pares.** Use a mesma rota conhecida para conferir cada tela antes de distribuir as seis pontas entre os contatos desejados. Registre a diferença de cada tela e compare com um multímetro ou com uma tensão conhecida quando disponível.
4. **Para testar o isolamento do roteador**, mande `OFF` e retire os jumpers que vêm dos nós. Os divisores deixam um caminho resistivo de cerca de **20 kΩ para GND por ponta** enquanto estão ligados. Antes de desligar a ESP32 inteligente, desligue a rota ou retire as pontas dos nós ativos.

[Guia do teste da placa inteligente](README.md) · [Proposta de pulso e voltímetro](../../../PULSO_E_VOLTIMETRO.md) · [ADC do ESP32](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32/schematic-checklist.html)
