# Controles da bancada — joystick + Energizar na ESP32, serial até a Raspberry Pi

O aluno não toca na tela. Ele usa:

- um **joystick analógico de Arduino** (módulo KY-023 / HW-504, 5 pinos: GND, +5V, VRx, VRy, SW);
- um **botão comum** (Energizar).

Os dois ficam ligados numa ESP32. A ESP32 manda cada ação para a Raspberry Pi pela **porta serial** (UART). O
serviço da bancada (`bench/service`, `bench_service/controls.py`) converte cada linha numa tecla que a tela da
bancada já entende.

A tela da bancada funciona como um **videogame**: só aparecem Voltar, Próximo/Continuar, Pular e as escolhas
da tela. Som, ajuda, ranking, câmera e sair ficam num **menu** que abre segurando o clique. O aluno começa numa
tela de título (Começar, Continuar, Sair).

| Ação física | Linha na serial | Tecla na tela | Efeito |
|---|---|---|---|
| Joystick → / ↑ | `KEY <id> RIGHT` / `UP` | `ArrowRight` / `ArrowUp` | avança: próximo passo, ou a próxima escolha da lista |
| Joystick ← / ↓ | `KEY <id> LEFT` / `DOWN` | `ArrowLeft` / `ArrowDown` | volta: passo anterior (← também sai da tela), ou a escolha anterior |
| Clique curto | `KEY <id> OK` | espaço | confirma a escolha (dentro da lição, só no quiz) |
| Segurar o clique (0,8 s) | `KEY <id> MENU` | `Escape` | abre/fecha o menu (Som, Ajuda, Ranking, Câmera, Sair) |
| Botão Energizar | `KEY <id> ENERGIZAR` | `Enter` | liga/desliga o circuito nas telas de montagem |

**Por enquanto o Energizar é o Enter do teclado do computador**; depois vem o botão próprio (GPIO32), que já manda
a mesma tecla.

Cada empurrão do joystick conta uma vez: a direção precisa ficar firme por 50 ms, a diagonal é ignorada e o
joystick precisa voltar ao centro por 120 ms antes do próximo comando (o "rebote" da mola não conta). Segurando,
repete devagar (depois de 1 s, a cada 0,45 s).


## Ligações

Desligue tudo antes de ligar os fios. Use os nomes impressos nos módulos. Os números são **GPIO**, não posição no
conector da placa.

| Peça | Pino | ESP32 |
|---|---|---|
| Joystick | +5V (VCC) | **3V3** (não 5 V: o ADC da ESP32 aceita até 3,3 V) |
| Joystick | GND | GND |
| Joystick | VRx | GPIO34 (D34) |
| Joystick | VRy | GPIO35 (D35) |
| Joystick | SW | GPIO27 (D27; pull-up interno ligado) |
| Botão Energizar (opcional) | um terminal | GPIO32 |
| Botão Energizar (opcional) | outro terminal | GND (pull-up interno ligado) |

| Raspberry Pi (pino físico) | ESP32 |
|---|---|
| 8 — TXD | RX2 / GPIO16 |
| 10 — RXD | TX2 / GPIO17 |
| 6 — GND | GND |

TX vai em RX nos dois sentidos. São sinais de 3,3 V: não precisa de conversor. Não ligue 5 V nem 3V3 de uma placa
na outra; só o GND é comum. Alimente a ESP32 pelo USB (ou pela fonte da bancada) e a Pi pela fonte dela.

Esta é a mesma serial do teste `firmware/component_testing/uart_pi_test`. Os pinos do joystick são os da
montagem atual (D34, D35, D27), diferentes dos do `joystick_test`. Os GPIO16/17 são linhas SDA na ESP32 dos componentes inteligentes, então este sketch roda numa
**ESP32 separada** (a "ESP32 #2" do `pi-controls`).

## Gravar na ESP32

1. Arduino IDE 2, placa **ESP32 Dev Module** (pacote *esp32 by Espressif*).
2. Abra `bench_controls.ino` e grave.
3. Monitor Serial do USB a 115200: cada ação aparece como `-> KEY 1 DOWN`, e a resposta da Pi como `<- ACK 1`.
4. **Deixe o joystick parado ao ligar**: o centro é medido na partida.
5. Se as direções saírem trocadas depois de montar, ajuste `SWAP_XY`, `INVERT_X` e `INVERT_Y` no início do sketch.

## Ligar na Raspberry Pi

1. `sudo raspi-config` → Interface Options → Serial Port: login pela serial **Não**, hardware serial **Sim**. Reinicie.
2. Instale o pyserial no ambiente do serviço: `pip install -e 'bench/service[controls]'`.
3. Rode o serviço com a porta: `python -m bench_service --controls /dev/serial0` (ou defina
   `TEDTRONICS_BENCH_CONTROLS=/dev/serial0`). O usuário precisa estar no grupo `dialout`.
4. `GET /controls/state` mostra `connected: true` quando a ESP32 responde aos `PING`.

Se a ESP32 for desligada, o serviço continua no ar e reconecta sozinho.

## Protocolo

115200 baud, 8N1, linhas ASCII terminadas em `\n`; linhas inválidas ou longas são descartadas.

| Sentido | Linha | Significado |
|---|---|---|
| ESP32 → Pi | `HELLO controles 1` | partida (ou resposta a `HELLO?`) |
| ESP32 → Pi | `KEY <id> UP\|DOWN\|LEFT\|RIGHT\|OK\|MENU\|ENERGIZAR` | uma ação (`VOLTAR` também é aceito, para um botão dedicado) |
| ESP32 → Pi | `PONG <n>` | resposta ao `PING <n>` |
| Pi → ESP32 | `ACK <id>` | a ação chegou à tela |
| Pi → ESP32 | `PING <n>` | a cada 2 s; sem resposta por 5 s, o link aparece como desconectado |
| Pi → ESP32 | `HELLO?` | ao abrir a porta |

Sem o hardware, dá para simular uma ação com o serviço em modo demonstração: `POST /dev/controls/ok`
(ou `up`, `down`, `left`, `right`, `menu`, `energizar`).

## O que está verificado

O lado da Pi tem testes automáticos (`bench/service/tests/test_controls.py`) e foi conferido na tela da bancada com
ações simuladas. O sketch compila (esp32 3.3.3) e roda numa ESP32 ligada ao PC pela USB: responde `PING`/`PONG` e
encontra o joystick (centro ≈ 1780). Ainda falta conferir no hardware as direções, o clique longo e o botão
Energizar, e o link pela UART da Pi.
