# Roteador de oito nós com dois 74HC4051

Ensaio em protoboard com ESP32 clássico, dois 74HC4051 da família HC, dois capacitores de 100 nF, um resistor de 560 Ω ±1% de ¼ W, dois resistores de 10 kΩ, jumpers e multímetro. Confira a marcação, o encapsulamento e a pinagem dos CIs disponíveis. Monte com o USB desligado e mantenha a PCB original desconectada.

| Pino do 74HC4051 | CI da fonte | CI do retorno |
|---|---|---|
| 16 (VCC) | 3V3 do ESP32 | 3V3 do ESP32 |
| 7 (VEE), 8 (GND) | GND comum | GND comum |
| 3 (COM) | 3V3 através de 560 Ω | GND comum |
| 11 (S0) | GPIO18 | GPIO21 |
| 10 (S1) | GPIO19 | GPIO22 |
| 9 (S2) | GPIO25 | GPIO26 |
| 6 (EN) | GPIO23, compartilhado | GPIO23, compartilhado |
| 13, 14, 15 (canais 0, 1, 2) | Nós 0, 1, 2 | Mesmos nós 0, 1, 2 |
| 12, 1, 5, 2, 4 (canais 3 a 7) | Nós 3, 4, 5, 6, 7 | Mesmos nós 3, 4, 5, 6, 7 |

Instale um capacitor de 100 nF entre os pinos 16 e 8 de cada CI e um pull-up de 10 kΩ entre o EN compartilhado e 3V3. O firmware aciona EN em push-pull. O pull-up mantém os canais abertos durante o reset. Os GPIOs da tabela são os números dos sinais no ESP32.

Na montagem de três nós, retire os dois jumpers entre S2 e GND antes de ligar GPIO25 e GPIO26. Una os pinos de canal de mesmo número dos dois CIs, com uma junção separada por nó.

## Varredura automática

A tabela acima descreve o banco A. Para o banco B sem 74HC139, compartilhe os seis sinais de endereço e as alimentações. Ligue os COM da fonte ao mesmo ponto após o resistor de 560 Ω e os COM de retorno ao GND. Os nós ficam separados por banco. Ligue o EN de A ao GPIO23 e o EN de B ao GPIO32, cada junção com seu próprio pull-up de 10 kΩ para 3V3.

Com `sweepOnBoot = true`, a ESP32 percorre os oito pares consecutivos (0 → 1, 1 → 2, …, 7 → 0) em A e depois os mesmos oito em B. Cada rota dura 125 ms, cerca de 2 s por ciclo completo. Use na bancada supervisionada. `OFF` interrompe a varredura e abre os dois bancos. `POWER B 2 3` interrompe a varredura e fixa a fonte no nó 2 e o retorno no nó 3 de B. `POWER 2 3` continua selecionando A. O reset reinicia a varredura.

## Ensaio serial

Para os ensaios da tabela, grave com `sweepOnBoot = false`.

Grave o sketch deste diretório em uma placa ESP32 clássica. Abra o monitor serial a **115200 baud** com final de linha LF ou CRLF. Na partida, o sketch anuncia `OK OFF`. Use `POWER <nó da fonte> <nó do GND>` com dois nós distintos de 0 a 7. Use `OFF` para desligar ou `PING` para verificar a comunicação. A rota permanece ativa até o próximo comando válido, erro de comando ou reset. Fechar o monitor serial pode deixar a rota ativa com a placa alimentada. Envie `OFF` ao encerrar.

| Ensaio | Ação e resultado previsto | Medido |
|---|---|---|
| Partida/reset | Com 3V3 presente, meça EN com o ESP32 mantido em reset. Espere nível alto. Ao soltar o reset, a saída permanece OFF. | |
| Alimentação | Meça 3V3 no pino 16 dos dois CIs. | |
| Rota 0–1 | Envie `POWER 0 1`. Meça entre os nós com 10 kΩ de carga entre eles. Ponta vermelha no nó 0. Espere perto de 3,1 V, conforme a tensão de alimentação e a resistência dos canais. | |
| Troca para 0–2 | Retire a carga e envie `POWER 0 2`. Coloque os 10 kΩ entre 0 e 2 e repita. | |
| Canais 4–7 | Com 10 kΩ entre os nós selecionados, teste `POWER 4 0`, `POWER 5 4`, `POWER 6 5`, `POWER 7 6` e `POWER 0 7`. Espere tensão positiva com a ponta vermelha no primeiro nó de cada comando. | |
| Nó livre | Ative `POWER 0 2` e retire a carga. No nó 1, coloque 10 kΩ para GND e depois para 3V3, uma ligação por vez. O nó deve seguir a polarização. | |
| OFF | Envie `OFF`. Com 10 kΩ, polarize o antigo nó da fonte para GND e depois, em outro teste, o antigo nó de GND para 3V3. Cada nó deve seguir a respectiva polarização. | |
| Comando inválido | Ative uma rota antes de cada tentativa. Envie `POWER 0 0`, `POWER 0 8` e `POWER 0 1 extra`. Espere `ERR OFF` e confirme EN alto. | |

Com 3,30 V e o resistor de 560 Ω ±1%, o limite calculado de corrente no ramal é 5,96 mA, desprezando a resistência dos canais. Registre a tensão real, o multímetro, a marcação dos CIs e as leituras da tabela.

Depois de confirmar o roteamento contínuo, o mesmo ramal de 560 Ω pode receber o driver de pulso previsto no projeto. Valide amplitude e largura com osciloscópio e carga. Para testar o voltímetro, comece com um único divisor de 15 kΩ/10 kΩ em uma segunda ESP32 e compare com o multímetro. Remova os jumpers do voltímetro durante os testes de isolamento.

[Roteador com multiplexadores](../../../ROTEADOR_COM_MULTIPLEXADORES.md) · [Pulso e voltímetro](../../../PULSO_E_VOLTIMETRO.md) · [Datasheet TI](https://www.ti.com/lit/ds/symlink/cd74hc4051.pdf)
