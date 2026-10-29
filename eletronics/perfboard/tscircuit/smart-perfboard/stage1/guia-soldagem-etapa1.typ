#set page(paper:"a4",flipped:true,margin:10mm)
#set text(font:"DejaVu Sans",size:10pt)
#set page(footer:context [Etapa 1 · #counter(page).display()])
= ESP32 — guia de soldagem, etapa 1
Data: 2026-10-21. Placa proposta: 30 × 45 furos, passo 2,54 mm.

*Escopo:* ESP32 removível, alimentação 3,3 V, capacitores, seis conectores OLED, joystick e UART do Raspberry Pi. Sem medição de tensão, multiplexador, expansão ou gerador de pulso.

*Antes de soldar:* confirmar a posição real dos furos, distância dos soquetes e encaixe dos jumpers. Os desenhos não são medições da placa fotografada. Se a montagem real divergir, revisar as coordenadas antes de continuar.

*Orientação:* vista superior, USB voltado para a linha 1; colunas 1–30 da esquerda para a direita. A vista inferior é espelhada, preservando os números da vista superior.

*Alimentação:* entrada externa regulada de 3,3 V; nunca aplicar 5 V ao pino 3V3. Não há regulador adicional nesta placa. Manter JP_EXT como ligação removível do plano físico. USB e fonte externa nunca conectados simultaneamente. Para gravar: desligar/desconectar a fonte externa, remover JP_EXT e desconectar periféricos que possam alimentar os sinais.

*Capacitores:* C_LOCAL = 100 nF (104), sem polaridade. C_BULK previsto = 47 µF; a fotografia parece mostrar 100 µF/10 V. Confirmar e registrar o valor real; 100 µF pode ser usado como desacoplamento local, verificando a partida da alimentação. Faixa negativa → GND; positivo → 3,3 V.

*OLED:* sem resistores pull-up externos. Os módulos devem fornecer pull-ups para 3,3 V. Confirmar SDA e SCL em cada módulo e a carga combinada de SCL; apenas a leitura SDA/VCC foi relatada. Começar com uma tela.

*Montagem:* todos os componentes em cima; fios isolados por baixo. Cruzamento de linhas não é junção. Cada ilha de solda é independente. Não usar os pinos de expansão ou o cabeçalho GND da etapa futura como pontos intermediários: este guia tem sua própria lista de fios.
#pagebreak()
= Posições — vista superior e inferior
#grid(columns:(1fr,1fr),image("top.svg",width:110mm),image("underside.svg",width:110mm))
#pagebreak()
= Lista de componentes e posições
Os números dos desenhos seguem o catálogo completo; componentes de etapas posteriores estão ocultos.

#table(columns: (5%,17%,48%,30%),inset:4pt,text("#"),text("Referência"),text("Peça"),text("Furos extremos"),
text("1"),text("J_ESP_L"),text("15 pinos — 30-pin ESP32 left socket"),text("C10/R5 → C10/R19"),
text("2"),text("J_ESP_R"),text("15 pinos — 30-pin ESP32 right socket"),text("C20/R5 → C20/R19"),
text("3"),text("J_POWER"),text("2 pinos — Regulated 3.3 V IN"),text("C25/R3 → C26/R3"),
text("4"),text("JP_EXT"),text("2 pinos — REMOVE for USB programming"),text("C25/R6 → C26/R6"),
text("5"),text("J_UART"),text("3 pinos — Pi: cross TX/RX"),text("C25/R14 → C27/R14"),
text("6"),text("J_JOY"),text("4 pinos — Joystick axes ONLY"),text("C24/R19 → C27/R19"),
text("7"),text("J_OLED0"),text("4 pinos — OLED slot 0"),text("C2/R4 → C5/R4"),
text("8"),text("J_OLED1"),text("4 pinos — OLED slot 1"),text("C2/R7 → C5/R7"),
text("9"),text("J_OLED2"),text("4 pinos — OLED slot 2"),text("C2/R10 → C5/R10"),
text("10"),text("J_OLED3"),text("4 pinos — OLED slot 3"),text("C2/R13 → C5/R13"),
text("11"),text("J_OLED4"),text("4 pinos — OLED slot 4"),text("C2/R16 → C5/R16"),
text("12"),text("J_OLED5"),text("4 pinos — OLED slot 5"),text("C2/R19 → C5/R19"),
text("26"),text("C_BULK"),text("47uF"),text("C26/R10 → C27/R10"),
text("27"),text("C_LOCAL"),text("100nF"),text("C24/R22 → C25/R22"))

Retirar o ESP32 antes de soldar os soquetes. Não soldar o módulo permanentemente. Confirmar folga para USB, EN/BOOT e conectores fêmea. Manter C17–29/R28–43 livre nas duas faces.
#pagebreak()
= Conectores — conferir pelos sinais
#table(columns: (23%,77%),inset:4pt,text("Conector"),text("Ordem dos pinos (esquerda → direita, vista superior)"),
text("J_POWER"),text("C25/R3 = 3,3 V externo; C26/R3 = GND"),
text("JP_EXT"),text("C25/R6 = fonte; C26/R6 = alimentação da placa; shunt removível"),
text("J_OLED0…5"),text("C2 = 3,3 V; C3 = GND; C4 = SCL; C5 = SDA (nas respectivas linhas)"),
text("J_JOY"),text("C24/R19 = 3,3 V; C25 = GND; C26 = X; C27 = Y; sem SW"),
text("J_UART"),text("C25/R14 = GND; C26 = TX do ESP; C27 = RX do ESP"))

*OLED:* mapear os jumpers pelos nomes impressos no módulo; a ordem física do módulo pode ser diferente. Todos compartilham 3,3 V, GND e SCL/GPIO22. SDAs separados: slots 0…5 → GPIO4,21,19,18,17,16.

*Pi:* pino físico 8 (TX/GPIO14) → J_UART RX/GPIO32; pino físico 10 (RX/GPIO15) ← J_UART TX/GPIO33; pino físico 6 → GND. Não conectar pinos de alimentação do Pi.

*Joystick:* X → GPIO36/VP; Y → GPIO39/VN. Usar somente 3,3 V/GND/X/Y.
#pagebreak()
= Esquema elétrico — etapa 1
#image("schematic.svg",width:100%,height:160mm,fit:"contain")
#pagebreak()
= Fiação V3V3_EXT
Linhas tracejadas indicam terminais; escolher o trajeto físico de fio isolado e conferir folgas. Não são trilhas de cobre nem prova de ausência de curto.
#grid(columns:(100mm,1fr),gutter:6mm,image("wiring-1.svg",width:100mm),[
#table(columns: (12%,44%,44%),inset:4pt,text("Fio"),text("Origem"),text("Destino"),
text("S01"),text("J_POWER.1 — C25/R3"),text("JP_EXT.1 — C25/R6"))

])
#pagebreak()
= Fiação V3V3_BOARD — bloco 1
Linhas tracejadas indicam terminais; escolher o trajeto físico de fio isolado e conferir folgas. Não são trilhas de cobre nem prova de ausência de curto.
#grid(columns:(100mm,1fr),gutter:6mm,image("wiring-2.svg",width:100mm),[
#table(columns: (12%,44%,44%),inset:4pt,text("Fio"),text("Origem"),text("Destino"),
text("S02"),text("JP_EXT.2 — C26/R6"),text("C_BULK.1 — C26/R10"),
text("S03"),text("C_BULK.1 — C26/R10"),text("C_LOCAL.1 — C24/R22"),
text("S04"),text("C_LOCAL.1 — C24/R22"),text("J_ESP_L.1 — C10/R5"),
text("S05"),text("J_ESP_L.1 — C10/R5"),text("J_JOY.1 — C24/R19"),
text("S06"),text("J_JOY.1 — C24/R19"),text("J_OLED0.1 — C2/R4"),
text("S07"),text("J_OLED0.1 — C2/R4"),text("J_OLED1.1 — C2/R7"),
text("S08"),text("J_OLED1.1 — C2/R7"),text("J_OLED2.1 — C2/R10"),
text("S09"),text("J_OLED2.1 — C2/R10"),text("J_OLED3.1 — C2/R13"))

])
#pagebreak()
= Fiação V3V3_BOARD — bloco 2
Linhas tracejadas indicam terminais; escolher o trajeto físico de fio isolado e conferir folgas. Não são trilhas de cobre nem prova de ausência de curto.
#grid(columns:(100mm,1fr),gutter:6mm,image("wiring-3.svg",width:100mm),[
#table(columns: (12%,44%,44%),inset:4pt,text("Fio"),text("Origem"),text("Destino"),
text("S10"),text("J_OLED3.1 — C2/R13"),text("J_OLED4.1 — C2/R16"),
text("S11"),text("J_OLED4.1 — C2/R16"),text("J_OLED5.1 — C2/R19"))

])
#pagebreak()
= Fiação GND — bloco 1
Linhas tracejadas indicam terminais; escolher o trajeto físico de fio isolado e conferir folgas. Não são trilhas de cobre nem prova de ausência de curto.
#grid(columns:(100mm,1fr),gutter:6mm,image("wiring-4.svg",width:100mm),[
#table(columns: (12%,44%,44%),inset:4pt,text("Fio"),text("Origem"),text("Destino"),
text("S12"),text("J_POWER.2 — C26/R3"),text("C_BULK.2 — C27/R10"),
text("S13"),text("C_BULK.2 — C27/R10"),text("C_LOCAL.2 — C25/R22"),
text("S14"),text("C_LOCAL.2 — C25/R22"),text("J_ESP_L.2 — C10/R6"),
text("S15"),text("J_ESP_L.2 — C10/R6"),text("J_ESP_R.2 — C20/R6"),
text("S16"),text("J_ESP_R.2 — C20/R6"),text("J_UART.1 — C25/R14"),
text("S17"),text("J_UART.1 — C25/R14"),text("J_JOY.2 — C25/R19"),
text("S18"),text("J_JOY.2 — C25/R19"),text("J_OLED0.2 — C3/R4"),
text("S19"),text("J_OLED0.2 — C3/R4"),text("J_OLED1.2 — C3/R7"))

])
#pagebreak()
= Fiação GND — bloco 2
Linhas tracejadas indicam terminais; escolher o trajeto físico de fio isolado e conferir folgas. Não são trilhas de cobre nem prova de ausência de curto.
#grid(columns:(100mm,1fr),gutter:6mm,image("wiring-5.svg",width:100mm),[
#table(columns: (12%,44%,44%),inset:4pt,text("Fio"),text("Origem"),text("Destino"),
text("S20"),text("J_OLED1.2 — C3/R7"),text("J_OLED2.2 — C3/R10"),
text("S21"),text("J_OLED2.2 — C3/R10"),text("J_OLED3.2 — C3/R13"),
text("S22"),text("J_OLED3.2 — C3/R13"),text("J_OLED4.2 — C3/R16"),
text("S23"),text("J_OLED4.2 — C3/R16"),text("J_OLED5.2 — C3/R19"))

])
#pagebreak()
= Fiação SCL
Linhas tracejadas indicam terminais; escolher o trajeto físico de fio isolado e conferir folgas. Não são trilhas de cobre nem prova de ausência de curto.
#grid(columns:(100mm,1fr),gutter:6mm,image("wiring-6.svg",width:100mm),[
#table(columns: (12%,44%,44%),inset:4pt,text("Fio"),text("Origem"),text("Destino"),
text("S24"),text("J_ESP_L.14 — C10/R18"),text("J_OLED0.3 — C4/R4"),
text("S25"),text("J_OLED0.3 — C4/R4"),text("J_OLED1.3 — C4/R7"),
text("S26"),text("J_OLED1.3 — C4/R7"),text("J_OLED2.3 — C4/R10"),
text("S27"),text("J_OLED2.3 — C4/R10"),text("J_OLED3.3 — C4/R13"),
text("S28"),text("J_OLED3.3 — C4/R13"),text("J_OLED4.3 — C4/R16"),
text("S29"),text("J_OLED4.3 — C4/R16"),text("J_OLED5.3 — C4/R19"))

])
#pagebreak()
= Fiação SDA_0
Linhas tracejadas indicam terminais; escolher o trajeto físico de fio isolado e conferir folgas. Não são trilhas de cobre nem prova de ausência de curto.
#grid(columns:(100mm,1fr),gutter:6mm,image("wiring-7.svg",width:100mm),[
#table(columns: (12%,44%,44%),inset:4pt,text("Fio"),text("Origem"),text("Destino"),
text("S30"),text("J_ESP_L.5 — C10/R9"),text("J_OLED0.4 — C5/R4"))

])
#pagebreak()
= Fiação SDA_1
Linhas tracejadas indicam terminais; escolher o trajeto físico de fio isolado e conferir folgas. Não são trilhas de cobre nem prova de ausência de curto.
#grid(columns:(100mm,1fr),gutter:6mm,image("wiring-8.svg",width:100mm),[
#table(columns: (12%,44%,44%),inset:4pt,text("Fio"),text("Origem"),text("Destino"),
text("S31"),text("J_ESP_L.11 — C10/R15"),text("J_OLED1.4 — C5/R7"))

])
#pagebreak()
= Fiação SDA_2
Linhas tracejadas indicam terminais; escolher o trajeto físico de fio isolado e conferir folgas. Não são trilhas de cobre nem prova de ausência de curto.
#grid(columns:(100mm,1fr),gutter:6mm,image("wiring-9.svg",width:100mm),[
#table(columns: (12%,44%,44%),inset:4pt,text("Fio"),text("Origem"),text("Destino"),
text("S32"),text("J_ESP_L.10 — C10/R14"),text("J_OLED2.4 — C5/R10"))

])
#pagebreak()
= Fiação SDA_3
Linhas tracejadas indicam terminais; escolher o trajeto físico de fio isolado e conferir folgas. Não são trilhas de cobre nem prova de ausência de curto.
#grid(columns:(100mm,1fr),gutter:6mm,image("wiring-10.svg",width:100mm),[
#table(columns: (12%,44%,44%),inset:4pt,text("Fio"),text("Origem"),text("Destino"),
text("S33"),text("J_ESP_L.9 — C10/R13"),text("J_OLED3.4 — C5/R13"))

])
#pagebreak()
= Fiação SDA_4
Linhas tracejadas indicam terminais; escolher o trajeto físico de fio isolado e conferir folgas. Não são trilhas de cobre nem prova de ausência de curto.
#grid(columns:(100mm,1fr),gutter:6mm,image("wiring-11.svg",width:100mm),[
#table(columns: (12%,44%,44%),inset:4pt,text("Fio"),text("Origem"),text("Destino"),
text("S34"),text("J_ESP_L.7 — C10/R11"),text("J_OLED4.4 — C5/R16"))

])
#pagebreak()
= Fiação SDA_5
Linhas tracejadas indicam terminais; escolher o trajeto físico de fio isolado e conferir folgas. Não são trilhas de cobre nem prova de ausência de curto.
#grid(columns:(100mm,1fr),gutter:6mm,image("wiring-12.svg",width:100mm),[
#table(columns: (12%,44%,44%),inset:4pt,text("Fio"),text("Origem"),text("Destino"),
text("S35"),text("J_ESP_L.6 — C10/R10"),text("J_OLED5.4 — C5/R19"))

])
#pagebreak()
= Fiação JOY_X
Linhas tracejadas indicam terminais; escolher o trajeto físico de fio isolado e conferir folgas. Não são trilhas de cobre nem prova de ausência de curto.
#grid(columns:(100mm,1fr),gutter:6mm,image("wiring-13.svg",width:100mm),[
#table(columns: (12%,44%,44%),inset:4pt,text("Fio"),text("Origem"),text("Destino"),
text("S36"),text("J_ESP_R.14 — C20/R18"),text("J_JOY.3 — C26/R19"))

])
#pagebreak()
= Fiação JOY_Y
Linhas tracejadas indicam terminais; escolher o trajeto físico de fio isolado e conferir folgas. Não são trilhas de cobre nem prova de ausência de curto.
#grid(columns:(100mm,1fr),gutter:6mm,image("wiring-14.svg",width:100mm),[
#table(columns: (12%,44%,44%),inset:4pt,text("Fio"),text("Origem"),text("Destino"),
text("S37"),text("J_ESP_R.13 — C20/R17"),text("J_JOY.4 — C27/R19"))

])
#pagebreak()
= Fiação UART_TX
Linhas tracejadas indicam terminais; escolher o trajeto físico de fio isolado e conferir folgas. Não são trilhas de cobre nem prova de ausência de curto.
#grid(columns:(100mm,1fr),gutter:6mm,image("wiring-15.svg",width:100mm),[
#table(columns: (12%,44%,44%),inset:4pt,text("Fio"),text("Origem"),text("Destino"),
text("S38"),text("J_ESP_R.9 — C20/R13"),text("J_UART.2 — C26/R14"))

])
#pagebreak()
= Fiação UART_RX
Linhas tracejadas indicam terminais; escolher o trajeto físico de fio isolado e conferir folgas. Não são trilhas de cobre nem prova de ausência de curto.
#grid(columns:(100mm,1fr),gutter:6mm,image("wiring-16.svg",width:100mm),[
#table(columns: (12%,44%,44%),inset:4pt,text("Fio"),text("Origem"),text("Destino"),
text("S39"),text("J_ESP_R.10 — C20/R14"),text("J_UART.3 — C27/R14"))

])
#pagebreak()
= Sequência de soldagem e testes
1. Com tudo desligado, encaixar ESP32/soquetes e jumpers para conferir folgas. Fotografar e confirmar os furos da montagem real.
2. Retirar ESP32 e periféricos. Fixar um terminal por conector, conferir alinhamento, completar as soldas. Soldar os capacitores com polaridade correta.
3. Instalar primeiro os fios de alimentação e GND deste guia. Conferir cada terminal com multímetro. Não há ligação automática entre ilhas.
4. Medir isolamento entre 3,3 V e GND; capacitores podem causar indicação transitória. Investigar curto persistente. Inspecionar pontes entre ilhas vizinhas.
5. Sem ESP32/periféricos, alimentar externamente e medir polaridade e tensão nos soquetes e em todos os conectores: alvo 3,3 V. Desligar.
6. Instalar fios de SCL, SDAs, joystick e UART; confirmar continuidade de ponta a ponta e ausência de curto entre sinais. Não unir as seis SDAs.
7. Inserir ESP32 com alimentação desligada. Fazer primeiro teste com uma tela, 100 kHz, firmware configurado para o GPIO da porta escolhida. Verificar alimentação sob carga, inicialização e conteúdo correto.
8. Desligar antes de cada mudança. Testar individualmente as outras portas, depois a combinação de até três posições ativas. Validar pull-ups paralelos de SCL e todos os módulos fisicamente alimentados.
9. Testar joystick nas quatro direções. Testar UART bidirecional em 115200 8N1; firmware deve usar RX32/TX33, não RX16/TX17 do teste antigo.
10. Registrar tensão medida, valor real de C_BULK, teste de cada porta e fotos das duas faces. Só considerar aprovado o que foi medido.

*Não conectar a matriz de medição nesta etapa.* GPIO34/35 ficam livres. Não instalar pulso, multiplexador, resistores de pull-up ou resistores do ADC. Os fios Sxx deste guia são específicos da etapa 1; não misturar com a numeração Wxxx do projeto completo.

*Registro:* placa/foto: __________  C_BULK: __________  fonte sem carga: __________  fonte sob carga: __________  portas testadas: __________  responsável/data: __________
