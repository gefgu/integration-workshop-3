# Perfboard — teste da etapa 1

Sketch independente para ESP32 clássico de 30 pinos. Testa seis portas OLED, joystick e comunicação com o Pi. Este perfil experimental também usa GPIO14 como sinal de habilitação; não mede tensão, corrente, curto ou estado real da chave.

Na lição com LED e buzzer em série, o Pi envia `VOLTTEST 1` repetidamente por USB. O ESP32 procura as seis portas, seleciona até três detectadas e mostra somente a tensão calculada no resistor: `0.0V` desligado ou `2.40V` ligado para fonte de 5 V, resistor de 1 kΩ, buzzer aproximado por 250 Ω e LED ideal de 2 V. O valor é calculado por `DemoVoltage.h`, sem medição física. A tela segue o comando, não confirma que a chave ou a carga funcionaram. Ao sair da lição ou perder a comunicação o modo de teste expira; a tela pode manter sua última imagem.

## Teste da lição 1 kΩ com chave externa

Grave `perfboard_stage1_test.ino` junto com `LineReader.h` no ESP32 Dev Module, usando as bibliotecas Adafruit GFX e Adafruit SSD1306. Conecte o ESP32 ao Raspberry Pi por USB e feche o Monitor Serial antes de iniciar a bancada. O joystick usa X=GPIO36, Y=GPIO39 e botão ativo em LOW=GPIO26. GPIO14 é uma saída de habilitação ativa em HIGH para uma chave externa apropriada; essa chave deve permanecer desligada inclusive durante reset e perda de alimentação. Confira compatibilidade 3,3 V e terra comum conforme a chave utilizada.

O USB anuncia `HELLO controles 2`, envia os eventos `KEY`, e aceita `POWER 1` / `POWER 0`. `POWER 1` expira em 1,5 s sem renovação; `POWER 0` desliga. O Pi renova somente durante a etapa final aprovada da lição ao vivo e enquanto a câmera e a sessão permanecem válidas. Após perda da sessão é necessário clicar novamente. A UART 32/33 não aceita comandos de potência. Esse timeout depende do firmware e não substitui intertravamento ou proteção independentes.

Na lição do buzzer, `VOLTTEST 1` renova o modo de tela simulada; o ESP32 publica `SMART <máscara>` a cada segundo. Os bits 0–5 indicam quais OLEDs selecionados responderam e foram inicializados. O Pi mostra os slots e exige tanto um componente inteligente visível na câmera quanto uma resposta recente de tela. Um ACK I²C não comprova a identidade, a posição física, a função ou a leitura elétrica do componente; a tela mostra valores simulados.

Primeiro teste com a carga desconectada: confirme com multímetro a saída desligada no boot/reset, ao sair da lição e ao desconectar USB. Com câmera, montagem e chave conferidas, use o clique do joystick em Energizar; clique outra vez para desligar. A câmera não mede polaridade nem continuidade elétrica; confira ambas fisicamente. Nenhuma compilação, teste de software ou desenho comprova a chave ou a bancada física.

## Mapa da placa

| Função | GPIO ESP32 |
|---|---|
| SCL compartilhado | 22 |
| SDA das portas 0, 1, 2, 3, 4, 5 | 4, 16, 18, 17, 19, 21 |
| Joystick X / Y | 36 (VP) / 39 (VN) |
| UART RX / TX | 32 / 33 |

Mapa atualizado conforme a fiação informada da placa soldada:

| Porta / comando | Identificação na ESP32 | GPIO SDA |
|---|---|---|
| OLED0 / `screens 0` | D4 | 4 |
| OLED1 / `screens 1` | RX2 | 16 |
| OLED2 / `screens 2` | D18 | 18 |
| OLED3 / `screens 3` | TX2 | 17 |
| OLED4 / `screens 4` | D19 | 19 |
| OLED5 / `screens 5` | D21 | 21 |

Essa numeração substitui o mapa antigo deste teste. Os PDFs e outros sketches
anteriores podem mostrar a ordem antiga; para este teste da placa soldada, use
a tabela acima. A mensagem de inicialização e `status` imprimem o mapa usado
pelo próprio código.

Não usar RX16/TX17 do teste UART antigo: esses pinos agora são SDA. Não conectar SW do joystick a GPIO35. Alimentação/sinais de 3,3 V, GND comum. O conector OLED da placa é 3V3/GND/SCL/SDA; conferir os nomes no módulo, pois sua ordem pode diferir.

## 1. Preparação e upload

1. Fazer inspeção, continuidade e medição de alimentação com multímetro conforme o [guia de soldagem](../../../eletronics/perfboard/tscircuit/smart-perfboard/stage1/guia-soldagem-etapa1.pdf). Firmware não verifica soldas, polaridade, tensão ou corrente.
2. Desconectar fisicamente a fonte externa de 3,3 V e retirar JP_EXT. Desconectar o Pi e outros sinais externos para o upload. USB e alimentação externa não podem ficar conectados simultaneamente.
3. Abrir `perfboard_stage1_test.ino` no Arduino IDE, selecionar **ESP32 Dev Module** e a porta USB real.
4. No gerenciador de bibliotecas, instalar **Adafruit SSD1306** e **Adafruit GFX Library**, aceitando dependências (Adafruit BusIO). `Wire` acompanha o pacote ESP32.
5. Fazer upload. Abrir Monitor Serial em **115200 baud**, terminação **New Line**. Reiniciar com EN se a mensagem inicial não aparecer.

Durante os testes interativos pelo Monitor Serial, manter a fonte externa desconectada e JP_EXT aberto: o USB alimenta a placa pelo DevKit. Não conectar uma fonte externa apenas para alimentar telas junto com USB. Se a alimentação USB não suportar a carga, parar e rever o arranjo de alimentação; não paralelar fontes. O teste de operação com fonte externa exige USB desconectado e medição separada; este sketch não mede a tensão da fonte.

Default: OLED 128×64, 100 kHz, autodetecção 0x3C/0x3D. Para módulo 128×32, mudar `OLED_HEIGHT` para 32 antes do upload. Pressupõe SSD1306; SH1106 precisa de outro driver.

## 2. Uma tela primeiro

Com tudo desligado, conectar uma tela na porta 0. Ligar pelo USB nas condições acima e enviar:

```text
scan
screens 0
```

Esperado: `SLOT 0 SDA=4: ACK at 0x3C` (ou 0x3D). A tela deve mostrar **SLOT 0**, SDA4/SCL22 e um contador que muda. As portas sem módulo podem indicar `NO ACK`; isso é esperado.

Para trocar o cabo: enviar `off`, desligar a alimentação, mudar o cabo e ligar novamente. Testar cada porta, enviando `screens 1`, depois `screens 2`, etc. O número exibido deve corresponder à porta física. Cada reinicialização volta com telas desabilitadas.

`scan` verifica somente ACK em 0x3C/0x3D; não prova que os pixels mudaram nem que a fiação está isolada. A biblioteca `display()` não retorna sucesso de cada transferência. Confirmar visualmente conteúdo e contador, especialmente se duas telas responderem juntas.

Depois dos testes individuais, com tudo desligado, conectar a combinação desejada. Exemplo:

```text
screens 0 1 2
```

Máximo três portas atualizadas por vez, uma após a outra. `screens 3 4 5` seleciona outro grupo. `off` interrompe tráfego, mas NÃO corta alimentação nem apaga necessariamente a imagem. Todas as telas fisicamente conectadas continuam consumindo corrente.

Sem pull-ups externos: os módulos devem fornecer SDA/SCL para 3,3 V. Confirmar ambos com módulos totalmente desconectados/desligados. SCL é comum: vários pull-ups em paralelo podem carregar demais a linha. Iniciar com uma tela e qualificar a combinação antes de conectar todas. Linhas SDA sem módulo podem flutuar. Os pinos inativos ficam em INPUT; não amarrar SDAs entre si. Não conectar/desconectar módulos energizados.

## 3. Joystick: só quatro direções

Com alimentação desligada, conectar 3V3/GND/X/Y. No Monitor Serial:

```text
joy on
c
```

Soltar o joystick no centro antes de `c`. Esperado: centro aceito e valores X/Y próximos do centro; mover para esquerda, direita, cima e baixo. O monitor mostra os valores e direção; os OLEDs selecionados também mostram a direção. Retorno ao centro gera `CENTER`.

Se a montagem inverter os eixos, alterar `INVERT_X`/`INVERT_Y` e fazer novo upload. Diagonais são reduzidas ao eixo dominante. Ajustar `DEAD_ZONE` se necessário. `joy off` interrompe amostragem. Um ADC flutuante pode parecer válido: calibrar não prova que o joystick está conectado. Conferir resposta física em todas as direções. Não há leitura de botão.

## 4. UART sem Raspberry Pi — loopback

1. Desligar a placa e desconectar completamente o cabo do Pi.
2. Colocar um jumper entre **ESP_TX e ESP_RX** no conector J_UART (C26/R14 ↔ C27/R14). Não ligar ao GND/3V3.
3. Alimentar pelo USB, abrir o monitor e enviar `loop`.
4. Esperado: `UART LOOPBACK PASS`. Sem eco em dois segundos: `UART LOOPBACK TIMEOUT`.
5. Desligar e retirar o jumper antes de conectar o Pi.

Isso verifica TX33 → conector → RX32. Não verifica a configuração ou o cabo do Pi. Não usar jumper de loopback enquanto o TX do Pi estiver conectado.

## 5. UART com Raspberry Pi

Com as duas placas desligadas, retirar o jumper de loopback e conectar:

| Pi 3B — pino físico | ESP32 / conector |
|---|---|
| 8 — GPIO14 TX | RX32 / J_UART ESP_RX |
| 10 — GPIO15 RX | TX33 / J_UART ESP_TX |
| 6 — GND | GND |

Sem fio de alimentação entre Pi e ESP32. Ambos os receptores devem estar alimentados durante comunicação. O Pi pode ter sua própria alimentação, enquanto o ESP32 fica alimentado pelo USB do computador; sua fonte externa de 3,3 V continua desconectada.

No Raspberry Pi OS, habilitar o hardware serial e desabilitar o console serial em `sudo raspi-config`, reiniciando quando necessário. Instalar pyserial e executar:

```sh
sudo apt install python3-serial
python3 pi_stage1_test.py --port /dev/serial0
```

Esperado: `PASS: PING/PONG round trip ...` a cada dois segundos. Para joystick, enviar `joy on` e `c` pelo Monitor Serial do ESP32; mover o stick. No Pi, deve aparecer `JOY <id> LEFT/RIGHT/UP/DOWN/CENTER`, seguido de ACK. No ESP32, `Pi ACK event ...`. Nenhum comando recebido pelo Pi aciona saídas de potência. Ctrl+C encerra o programa Python.

Se o Pi continuar sem iniciar, usar apenas o loopback até resolver o boot. A leitura UART tem buffers limitados e descarta linhas inválidas/longas. A calibração e as transferências completas de tela podem atrasar o processamento; este teste não estabelece a latência do firmware final.

## Comandos USB

| Comando | Ação |
|---|---|
| `help` / `?` | Lista de comandos |
| `status` | Pinagem, seleção e estado do joystick |
| `scan` | ACK nas seis portas, em sequência |
| `screens 0` | Uma porta (0…5) |
| `screens 0 2 5` | Até três portas distintas |
| `off` | Para tráfego OLED; não desliga alimentação |
| `joy on` / `joy off` | Habilita/desabilita leitura de eixos |
| `c` | Calibra centro, com joystick habilitado |
| `loop` | Testa eco UART com jumper TX/RX e Pi desconectado |

## Registro

Estado inicial: código preparado; compilação/upload e testes físicos ainda não confirmados. Registrar porta testada, endereço detectado, conteúdo visual, direções corretas, loopback, PING/PONG e tensão medida sob carga. Não considerar a etapa aprovada apenas por iniciar o sketch ou obter ACK.
