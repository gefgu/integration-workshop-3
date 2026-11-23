# TedTronics — ESP32 router MT8816AE (revisão 2, 18/11/2026)

## Arquivos e origem

- `tedtronics_esp32_router_revisado.ino` — firmware pronto para abrir na **Arduino IDE**.
- `tests/test_router.cpp` — testes com modelos C++ dos 74HC595 e MT8816, sem necessidade de uma ESP32, para verificar **lógica**.
- Revisado contra o projeto do EasyEDA `ProPrj_Oficias_agrVai_deusehbom_2lados_2026-11-09(1).epro2`, especificamente as redes atribuídas aos pads das PCBs `PCB1_A_200x100` e `ROUTER_B_150X100`.
- Esta revisão **não** foi gravada nem testada nas placas físicas; os jumpers instalados não podem ser medidos pelo arquivo EPRO2.

## 1. Topologia confirmada nas duas PCBs

| Item | Conexão |
|---|---|
| PCB A U1 MT8816, X0...X10 | NODE00...NODE10 |
| PCB B U2 MT8816, X0...X10 | NODE11...NODE21 |
| U1/U2 Y0 | Terra, BUS00 na A e GND na B |
| U1/U2 Y1 | PULSE_BUS (reservado) |
| U1/U2 Y2 | TEST_BUS (reservado) |
| U1/U2 Y3 | SENSE_A (reservado) |
| U1/U2 Y4 | SENSE_B (reservado) |
| U1 Y5/Y6/Y7 | A_BUS1/A_BUS2/A_BUS3 (locais) |
| U2 Y5/Y6/Y7 | B_BUS1/B_BUS2/B_BUS3 (locais) |

No arquivo, os três barramentos livres da A e os três da B **não são eletricamente comuns entre as placas**. Em consequência, o firmware bloqueia `CONNECT 3 17`, por exemplo. Y3/Y4 poderiam criar caminhos entre placas quando conectados pelos headers, mas **não** são utilizados nesta versão porque foram reservados à medição.

**Opcional, se realmente foram instaladas pontes adicionais:** somente depois de medir continuidade entre U1 Y5 (pino 19) ↔ U2 Y5 (19), U1 Y6 (17) ↔ U2 Y6 (17) e U1 Y7 (15) ↔ U2 Y7 (15), alterar no `.ino`:

```cpp
constexpr bool CONFIGURAR_PONTES_AB = true;
```

Isso transforma as 6 redes locais em **3 redes globais**, compartilháveis entre os 22 nodes. Não habilitar sem as pontes físicas.

## 2. GPIOs e 74HC595 verificados no projeto

| GPIO ESP | Rede de saída | Destino |
|---|---|---|
| 23 | C_Q1, via Q1 | U5 SER (14) |
| 18 | C_Q2, via Q2 | U5/U6 SRCLK (11) |
| 22 | C_Q3, via Q3 | U5/U6 RCLK (12) |
| 19 | C_Q4, via Q4 | U1/U2 STROBE (18) |
| 21 | C_Q5, via Q5 | U5/U6 OE# (13) |
| 25 | Q6/Q12 | U1/U2 RESET (3) |
| 14 | circuito Q10/Q9 placa B | TEST_BUS, mantido desativado |
| 26 | circuito Q8/Q7 placa B | PULSE_BUS alto, mantido desativado |
| 27 | circuito Q11 placa B | PULSE_BUS baixo, mantido desativado |

Q1–Q5 invertem o nível lógico: GPIO HIGH faz nível LOW no pino do CI. Q6/Q12 comandam o reset invertido: **GPIO25 LOW → RESET do MT8816 alto → TODAS as chaves abertas**, quando a alimentação e o circuito estão corretos; **GPIO25 HIGH → RESET baixo → programação habilitada**.

- U5: `QA=AX0`, `QB=AX1`, `QC=AX2`, `QD=AX3`, `QE=AY0`, `QF=AY1`, `QG=AY2`, `QH=DATA`.
- U5 QH' (pino 9) → U6 SER (pino 14), na rede SER_U6.
- U6: `QA=CS_A` (U1), `QB=CS_B` (U2).
- A transmissão desloca 16 bits, **U6 primeiro e U5 depois**, bit 15 até 0; a atualização de saída ocorre na borda de subida do RCLK real (após o transistor inversor).
- A escrita de um crosspoint ocorre com `CS=1` e STROBE=1, e o MT8816 memoriza DATA na descida de STROBE.

O GPIO34 da ESP32 está associado ao PULSE_CMD no projeto, mas é **somente entrada** no ESP32 clássico; não é utilizado pelo programa.

## 3. Instalação e primeira operação

1. Na Arduino IDE, instale a placa **ESP32 by Espressif Systems**, selecione **ESP32 Dev Module** para o módulo DOIT clássico e a porta USB correspondente.
2. Abra o arquivo `.ino`, compile e carregue. Configure o **Monitor Serial em 115200**, com término de linha **Nova linha** (ou NL+CR).
3. Antes de ligar cargas, confira a alimentação correta de **5V_SYS nos 74HC595, 12V_SYS nos MT8816** e GND comum; a ESP32 trabalha com 3,3 V em seus GPIOs.
4. Execute:

```text
RESET
STATUS
CONNECT 0 5
MAP
LIST
CONNECT 5 7
MAP
RESET
CONNECT 11 12
MAP
RESET
```

### Comandos

| Comando | Comportamento |
|---|---|
| `CONNECT 0 5` | Inclui a aresta lógica 0–5 e programa a rede por Y5/Y6/Y7 |
| `CONNECT NODE05 N07` | Aceita nomes completos e abreviados, sem diferença de maiúsculas |
| `DISCONNECT 0 5` | Remove **somente a aresta** 0–5. Um caminho alternativo ainda pode unir os nós |
| `ISOLATE 5` | Remove todas as arestas envolvendo NODE05 |
| `LIST` | Lista arestas e redes planejadas |
| `MAP` | Mostra cada crosspoint X/Y que o firmware pretende manter fechado |
| `STATUS` | Estado **comandado** do reset, número de arestas e redes |
| `REAPPLY` | Faz reset e recria todas as redes cadastradas na RAM |
| `RESET` | Limpa RAM e afirma RESET em ambos os MT8816, deixando todos os crosspoints OFF |
| `STOP` | Sinônimo de RESET, útil em situação de emergência |
| `HELP` | Ajuda |

Aliases: `LIGAR`/`JUNTAR`, `DESLIGAR`, `ISOLAR`, `LISTAR`, `MAPA`, `ESTADO`, `REAPLICAR`, `LIMPAR`, `AJUDA`.

### Exemplo de MAP

Após `CONNECT 0 5` e `CONNECT 5 7`, a placa A deverá receber:

```text
NODE00 -> U1 X0 Y5
NODE05 -> U1 X5 Y5
NODE07 -> U1 X7 Y5
```

Assim, **três nodes são eletricamente conectados no mesmo barramento**. O uso de Y5 deixa Y6 e Y7 disponíveis para outros dois grupos independentes na placa A.

Após `CONNECT 11 12`, a placa B deverá receber `U2 X0 Y5` e `U2 X1 Y5`, independentemente dos barramentos usados na placa A, porque Y5_A e Y5_B são separados na topologia original.

## 4. Comportamento de segurança e limitações

- O boot inicializa RESET ativo, zera os 74HC595 e desliga os geradores de sinais especiais (`GPIO14/26/27 = LOW`); **isso não garante ausência de pulsos antes de `setup()`**, durante o reset/bootloader da ESP32.
- Mudanças de configuração fazem **reset total e reprogramação** (*break-before-make*). Todas as redes sofrem uma breve interrupção, incluindo as não modificadas.
- Se não há ligações ativas, o firmware mantém o RESET dos MT8816 ativo.
- O software **não possui retorno de status dos 74HC595/MT8816 nem sensores de tensão/corrente**. `OK`, `STATUS`, `LIST` e `MAP` indicam o **comando solicitado**, não continuidade confirmada.
- O programa não pode impedir curtos se o circuito externo já une tensões diferentes, ou se a pessoa ordenar conectar redes incompatíveis.
- Os barramentos Y0–Y4 são deliberadamente reservados. Este firmware **não fornece recursos de GND, teste, pulso e medição selecionáveis**, apenas roteamento nos barramentos livres Y5–Y7.
- O MT8816 suporta correntes muito pequenas: **±15 mA é um limite ABSOLUTO por I/O, não corrente recomendada de operação**. Cada chave tem resistência ON significativa; dois nodes no mesmo Y têm duas chaves no caminho. Evite motores, buzzer de corrente alta, fontes em curto e outros circuitos acima da capacidade.
- As duas PCBs não têm fonte de alimentação 5 V/12 V regulada embutida apenas por serem placas de roteamento. Faça a alimentação correta antes do uso.
- O estado não é persistido: reiniciar a ESP32 limpa o grafo e reinicia as matrizes abertas.

### Teste físico sugerido (sem componentes de carga)

1. Com fontes desligadas, teste curtos indevidos entre 12V, 5V e GND e verifique cabeamento dos headers de A para B.
2. Energize com fontes de corrente limitada. Verifique nos CIs: U5/U6 VCC pino 16 = 5 V; U1/U2 VDD pino 40 = 12 V; referências de terra corretas.
3. Envie `RESET`: confira U1/U2 pino 3 (RESET) **alto** e pino 18 (STROBE) **baixo**.
4. Envie `CONNECT 0 5`: confira U1 pino 3 **baixo**. Não use continuidade ou resistência com as placas energizadas. Para o teste de tensão limitado abaixo, siga o guia de ligações, página 9.
5. Envie `CONNECT 5 7`: repita o teste de tensão limitado em NODE07 para verificar a rede planejada.
6. Envie `RESET`: todas as conexões analógicas devem abrir.
7. Repita na B (`CONNECT 11 12`). Se B não responder, verifique **J_ADDR_L, J_ADDR_R, J_CMD, J_SERV** e a continuidade dos jumpers.

## 5. Verificação executada

Foi realizada compilação do `.ino` com `g++ -std=c++17 -Wall -Wextra -Werror`, substituindo as funções Arduino por mocks e simulando **dois 74HC595, duas memórias 16×8 de MT8816, inversões dos BC548 e bordas STROBE/RESET**.

Testes: boot seguro, programação de ambas as placas, agrupamento de 3 nós, três redes e rejeição da quarta, tentativa cross-placa sem pontes, desconexão, ciclo de arestas, isolamento, reprogramação, reset e **400 comandos pseudoaleatórios** comparados ao mapa de crosspoints realmente retidos na simulação. Adicionalmente, o modo opcional com as três pontes entre placas foi testado em simulação.

**O código não foi compilado com o toolchain real ESP32/Arduino nem executado no hardware físico.** Esses testes de lógica não garantem funcionamento de uma montagem específica.

### Referências dos fabricantes

- [MT8816AE, datasheet da família MT8816 (Microchip/Zarlink)](https://www.mouser.com/datasheet/2/268/Microchip_06182024_MT8816AE1-3459976.pdf)
- [74HC595, datasheet TI](https://www.ti.com/lit/ds/symlink/cd74hc595.pdf)

## Teste seguro de tensão para o roteamento

Com as placas energizadas e sem componentes no tabuleiro, ligue uma fonte de 3,3 V ao NODE00 através de um resistor de 10 kΩ; ligue NODE05 ao GND através de 100 kΩ. O GND da fonte de teste deve ser comum ao das placas. Meça NODE05 com voltímetro DC de alta impedância: após `RESET`, espere aproximadamente 0 V; após `CONNECT 0 5`, a tensão deve subir (idealmente cerca de 3 V, sujeita às cargas reais); após `RESET`, deve cair novamente. Repita com NODE11 e NODE12 para a placa B. Desligue as fontes antes de trocar os fios. Se os valores forem inesperados, pare e investigue; não são limites de aceitação medidos.

Não use este firmware nos perfboards revision5–7: ele é específico da PCB EasyEDA A/B descrita acima. Confirme a pinagem e a identificação física antes de inserir a ESP32 ou alimentar a placa. O comando `STOP` depende de firmware e comunicação e não substitui desligar fisicamente a alimentação.
