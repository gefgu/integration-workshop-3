# TedTronics — pulso e voltímetro

## Requisitos e divisão entre as placas

- **Equipe completa com cinco integrantes:** fonte de pulso e voltímetro são obrigatórios.
- **Se alguém sair da equipe:** o pulso continua obrigatório. O voltímetro deixa de ser obrigatório nesse cenário, conforme a regra discutida.
- **ESP32 do roteador:** controla os multiplexadores, o banco e a fonte de pulso. A mesma placa decide quando a fonte pode ser aplicada.
- **Segunda ESP32, opcional:** lê as três posições inteligentes por jumpers próprios. No primeiro teste, pode mostrar as leituras pelo próprio USB, com GND comum entre as duas placas.

Estas são propostas de bancada. A PCB original fica desconectada e as leituras previstas precisam ser verificadas fisicamente.

## Fonte de pulso compartilhada

Reserve um GPIO com capacidade de saída, por exemplo **GPIO27** no ESP32 clássico se estiver livre. A montagem com dois CIs e três nós usa cinco GPIOs para roteamento e mais um para pulso. A versão com quatro CIs e dois bancos de oito usa oito para roteamento e mais um para pulso.

```text
ESP32 / LEDC ─► driver de 0/5 V ─► 560 Ω ─► COM do mux da fonte ─► nó da fonte
GND ──────────────────────────────────────► COM do mux de GND ───► nó de GND
```

A fonte de 5 V fornece a corrente e o GPIO comanda o driver. Mantenha o driver alto para alimentação contínua. Alterne o driver entre alto e baixo para produzir o pulso sem mudar a seleção do nó nem abrir o retorno de GND. Para obter um nível baixo definido no nó, use um driver que o leve a zero durante a pausa. Uma chave aberta pode deixar o nó flutuando. Em OFF, desabilite os multiplexadores. Comece com a rota desabilitada e configure o driver e os endereços antes de habilitar.

Um pulso compartilhado pode ser enviado a qualquer nó do banco ativo. Pulsos independentes simultâneos são outro requisito. Para verificar a amplitude e a largura, meça com osciloscópio entre os dois nós selecionados, com a carga de teste. Um multímetro basta para o teste contínuo.

[Espressif Arduino-ESP32 LEDC](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/ledc.html) · [Roteador com multiplexadores](ROTEADOR_COM_MULTIPLEXADORES.md)

## Voltímetro com jumpers diretos e ADC interno

Passe um fio de medição individual de cada contato até a segunda ESP32, pelo seu próprio divisor. Os jumpers de medição podem ficar montados e ser removidos para testes de isolamento. A medição fica fora do multiplexador que direciona a alimentação.

| Tipo de medição | Entradas para três posições |
|---|---|
| Um nó de cada posição em relação ao GND comum | Três entradas ADC, por exemplo GPIO32, GPIO33 e GPIO34 do ADC1 do ESP32 clássico. |
| Tensão de duas pontas, P1 − P2 | Seis entradas ADC, duas por posição. Leia cada ponta em relação ao GND comum e subtraia as leituras. Confira os pinos ADC disponíveis na placa. |

A leitura por subtração é adequada para sinais lentos com cada ponta entre 0 e 5 V em relação ao GND do projeto. Os canais são lidos em sequência e os três valores podem ser mostrados juntos. O ADC interno é suficiente para demonstrar tensão contínua. Compare cada entrada com o multímetro antes de depender da precisão, principalmente perto de zero.

```text
Nó ── 15 kΩ ──┬── entrada ADC
               │
             10 kΩ
               │
              GND
```

Com esse divisor, 5 V no nó dão cerca de 2 V na entrada. Configure a atenuação adequada, leia com `analogReadMilliVolts()` e multiplique por 2,5 como ponto de partida. Calibre com o multímetro. Comece com uma posição, aplique uma tensão contínua conhecida e depois replique os divisores.

**Em OFF os divisores ainda carregam os nós.** Remova os jumpers para verificar o isolamento do roteador. Se o produto exigir desconexão elétrica também com os jumpers instalados, preveja uma chave analógica em cada caminho de medição, conforme a interface final.

[Espressif Arduino-ESP32 ADC](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html) · [Guia de hardware ESP32](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32/schematic-checklist.html)

## Alternativa com ADS1115

- **Um ADS1115** para três posições referenciadas ao GND. Use AIN0, AIN1 e AIN2 com divisores individuais.
- **Dois ADS1115** para três posições diferenciais. O primeiro usa AIN0/AIN1 para uma posição e AIN2/AIN3 para outra. O segundo usa AIN0/AIN1 para a terceira. Use endereços I²C distintos para compartilhar SDA e SCL.
- Alimente os módulos em 3,3 V e dimensione cada divisor para manter **cada ponta** dentro da faixa de entrada em relação ao GND. Com resistores iguais, 5 V viram aproximadamente 2,5 V. Calibre o divisor e confira a escala.
- Defina frequência e largura do pulso antes de escolher como medir o pico. A amostragem sequencial pode deixar passar um pulso curto.

[Datasheet TI ADS1115](https://www.ti.com/lit/ds/symlink/ads1115.pdf)
