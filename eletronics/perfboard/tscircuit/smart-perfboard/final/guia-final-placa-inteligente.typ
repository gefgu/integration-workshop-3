#set page(width:240mm,height:180mm,margin:9mm,footer:context [Placa inteligente · revisão final de projeto v1 · #counter(page).display()])
#set text(font:"DejaVu Sans",size:8.5pt)
= Guia de fiação — placa inteligente completa
26/10/2026 · Escopo: placa ESP32 já soldada + placa complementar de medição/pulso/continuidade. O projeto interno do roteador não faz parte deste guia.

*Preservar a placa existente:* seis conectores OLED, joystick, UART, soquetes ESP32, alimentação e capacitores mantêm os furos do PDF simplificado. A extensão é proposta em outra perfboard 30×45, conectada por chicote. Não foi demonstrado que 77 peças adicionais cabem no espaço livre da placa já soldada; este guia não presume esse encaixe.

*Estado:* projeto elétrico completo para revisão e montagem incremental. Geometria nominal e verificações de software não comprovam corpos reais, soldas, estabilidade analógica, fuga, proteção ou desempenho do conjunto. Fazer dry-fit antes de cortar fios/soldar a extensão. A proteção existente foi relatada pronta, mas suas interfaces ainda precisam ser identificadas no hardware real.

*Funções:* três peças intercambiáveis em seis posições completas; um par medido por vez; um gerador de pulsos ativo por vez. Sem amperímetro e sem banco de resistores didáticos. Alimentação/controle OLED não atravessam a matriz. A seleção dos P1/P2/P3 fica fora desta placa.

*Ordem:* conferir a placa já soldada (Sxx) → montar a extensão (Fxxx) → unir chicotes H_CTRL/H_POWER/H_ROUTER → testar as condições de liberação. Não misturar Sxx, Fxxx e a numeração Wxxx do projeto antigo.

*Alimentação:* regulada 3,3V para ESP32/lógica/telas e 5V para o circuito de saída; nenhum 5V entra em GPIO ou ADC. USB e fonte externa da ESP32 nunca em paralelo. O Pi usa TX/RX/GND, sem positivo de alimentação. Desconectar sinais externos que possam alimentar a placa durante programação.

*Importante:* esta conclusão não instala um novo regulador nem pull-ups externos nas telas. C_BULK da placa base foi projetado como 47µF; a fotografia parece 100µF/10V. Registrar o valor real e a polaridade.
#pagebreak()
= 1 — Placa existente: referência e conexões
#grid(columns:(1fr,1fr),image("../stage1/top.svg",width:105mm),image("../stage1/underside.svg",width:105mm))
#pagebreak()
= 2 — Pinagem da placa existente
#table(columns:(25%,75%),inset:4pt,text("Função"),text("GPIO / posição TOP"),
text("SCL comum"),text("GPIO22: J_ESP_L.14 = C10/R18"),
text("SDA0…5"),text("GPIO4,21,19,18,17,16: C10/R9,R15,R14,R13,R11,R10"),
text("OLEDs 0…5"),text("C2–5 nas linhas R4,R7,R10,R13,R16,R19; ordem 3V3/GND/SCL/SDA"),
text("Joystick"),text("J_JOY C24–27/R19 = 3V3/GND/X/Y; X=GPIO36 C20/R18; Y=GPIO39 C20/R17; sem SW"),
text("Pi UART"),text("J_UART C25–27/R14 = GND/TX33/RX32. Pi pino8 TX→RX32; TX33→Pi pino10 RX; GND→Pi pino6"),
text("Entrada e link"),text("J_POWER C25–26/R3 = 3,3V/GND. JP_EXT C25–26/R6, remover em modo USB"),
text("Capacitores"),text("C_BULK (+)C26/R10 (−)C27/R10; C_LOCAL 100nF C24–25/R22"))

Na vista inferior, preservar a numeração TOP espelhada. Não definir pinagem do OLED pela ordem mecânica: seguir os sinais impressos no módulo. Não aplicar tensão ao VIN da ESP32 nesta alimentação de 3,3V.
#pagebreak()
= 3 — Conferir fios da placa soldada (1–14)
#table(columns:(8%,20%,36%,36%),inset:4pt,text("Fio"),text("Sinal"),text("Origem"),text("Destino"),
text("S01"),text("V3V3_EXT"),text("J_POWER.1 — C25/R3"),text("JP_EXT.1 — C25/R6"),
text("S02"),text("V3V3_BOARD"),text("JP_EXT.2 — C26/R6"),text("C_BULK.1 — C26/R10"),
text("S03"),text("V3V3_BOARD"),text("C_BULK.1 — C26/R10"),text("C_LOCAL.1 — C24/R22"),
text("S04"),text("V3V3_BOARD"),text("C_LOCAL.1 — C24/R22"),text("J_ESP_L.1 — C10/R5"),
text("S05"),text("V3V3_BOARD"),text("J_ESP_L.1 — C10/R5"),text("J_JOY.1 — C24/R19"),
text("S06"),text("V3V3_BOARD"),text("J_JOY.1 — C24/R19"),text("J_OLED0.1 — C2/R4"),
text("S07"),text("V3V3_BOARD"),text("J_OLED0.1 — C2/R4"),text("J_OLED1.1 — C2/R7"),
text("S08"),text("V3V3_BOARD"),text("J_OLED1.1 — C2/R7"),text("J_OLED2.1 — C2/R10"),
text("S09"),text("V3V3_BOARD"),text("J_OLED2.1 — C2/R10"),text("J_OLED3.1 — C2/R13"),
text("S10"),text("V3V3_BOARD"),text("J_OLED3.1 — C2/R13"),text("J_OLED4.1 — C2/R16"),
text("S11"),text("V3V3_BOARD"),text("J_OLED4.1 — C2/R16"),text("J_OLED5.1 — C2/R19"),
text("S12"),text("GND"),text("J_POWER.2 — C26/R3"),text("C_BULK.2 — C27/R10"),
text("S13"),text("GND"),text("C_BULK.2 — C27/R10"),text("C_LOCAL.2 — C25/R22"),
text("S14"),text("GND"),text("C_LOCAL.2 — C25/R22"),text("J_ESP_L.2 — C10/R6"))

Essas conexões são da etapa simplificada. Conferir, não desfazer soldas corretas. Nenhum fio depende de cabeçalhos futuros de medição ou expansão.
#pagebreak()
= 3 — Conferir fios da placa soldada (15–28)
#table(columns:(8%,20%,36%,36%),inset:4pt,text("Fio"),text("Sinal"),text("Origem"),text("Destino"),
text("S15"),text("GND"),text("J_ESP_L.2 — C10/R6"),text("J_ESP_R.2 — C20/R6"),
text("S16"),text("GND"),text("J_ESP_R.2 — C20/R6"),text("J_UART.1 — C25/R14"),
text("S17"),text("GND"),text("J_UART.1 — C25/R14"),text("J_JOY.2 — C25/R19"),
text("S18"),text("GND"),text("J_JOY.2 — C25/R19"),text("J_OLED0.2 — C3/R4"),
text("S19"),text("GND"),text("J_OLED0.2 — C3/R4"),text("J_OLED1.2 — C3/R7"),
text("S20"),text("GND"),text("J_OLED1.2 — C3/R7"),text("J_OLED2.2 — C3/R10"),
text("S21"),text("GND"),text("J_OLED2.2 — C3/R10"),text("J_OLED3.2 — C3/R13"),
text("S22"),text("GND"),text("J_OLED3.2 — C3/R13"),text("J_OLED4.2 — C3/R16"),
text("S23"),text("GND"),text("J_OLED4.2 — C3/R16"),text("J_OLED5.2 — C3/R19"),
text("S24"),text("SCL"),text("J_ESP_L.14 — C10/R18"),text("J_OLED0.3 — C4/R4"),
text("S25"),text("SCL"),text("J_OLED0.3 — C4/R4"),text("J_OLED1.3 — C4/R7"),
text("S26"),text("SCL"),text("J_OLED1.3 — C4/R7"),text("J_OLED2.3 — C4/R10"),
text("S27"),text("SCL"),text("J_OLED2.3 — C4/R10"),text("J_OLED3.3 — C4/R13"),
text("S28"),text("SCL"),text("J_OLED3.3 — C4/R13"),text("J_OLED4.3 — C4/R16"))

Essas conexões são da etapa simplificada. Conferir, não desfazer soldas corretas. Nenhum fio depende de cabeçalhos futuros de medição ou expansão.
#pagebreak()
= 3 — Conferir fios da placa soldada (29–39)
#table(columns:(8%,20%,36%,36%),inset:4pt,text("Fio"),text("Sinal"),text("Origem"),text("Destino"),
text("S29"),text("SCL"),text("J_OLED4.3 — C4/R16"),text("J_OLED5.3 — C4/R19"),
text("S30"),text("SDA_0"),text("J_ESP_L.5 — C10/R9"),text("J_OLED0.4 — C5/R4"),
text("S31"),text("SDA_1"),text("J_ESP_L.11 — C10/R15"),text("J_OLED1.4 — C5/R7"),
text("S32"),text("SDA_2"),text("J_ESP_L.10 — C10/R14"),text("J_OLED2.4 — C5/R10"),
text("S33"),text("SDA_3"),text("J_ESP_L.9 — C10/R13"),text("J_OLED3.4 — C5/R13"),
text("S34"),text("SDA_4"),text("J_ESP_L.7 — C10/R11"),text("J_OLED4.4 — C5/R16"),
text("S35"),text("SDA_5"),text("J_ESP_L.6 — C10/R10"),text("J_OLED5.4 — C5/R19"),
text("S36"),text("JOY_X"),text("J_ESP_R.14 — C20/R18"),text("J_JOY.3 — C26/R19"),
text("S37"),text("JOY_Y"),text("J_ESP_R.13 — C20/R17"),text("J_JOY.4 — C27/R19"),
text("S38"),text("UART_TX"),text("J_ESP_R.9 — C20/R13"),text("J_UART.2 — C26/R14"),
text("S39"),text("UART_RX"),text("J_ESP_R.10 — C20/R14"),text("J_UART.3 — C27/R14"))

Essas conexões são da etapa simplificada. Conferir, não desfazer soldas corretas. Nenhum fio depende de cabeçalhos futuros de medição ou expansão.
#pagebreak()
= 4 — Chicote H_CTRL: ESP32 → complemento
#table(columns:(10%,20%,13%,31%,26%),inset:4pt,text("J_CTRL pin"),text("Sinal"),text("ESP32"),text("Ponto na placa base"),text("Destino no complemento"),
text("1"),text("ARM"),text("GPIO13"),text("J_ESP_R.3 C20/R7"),text("C2/R13"),
text("2"),text("HEARTBEAT"),text("GPIO14"),text("J_ESP_R.5 C20/R9"),text("C3/R13"),
text("3"),text("MODE_A"),text("GPIO25"),text("J_ESP_R.8 C20/R12"),text("C4/R13"),
text("4"),text("MODE_B"),text("GPIO26"),text("J_ESP_R.7 C20/R11"),text("C5/R13"),
text("5"),text("MODE_C"),text("GPIO27"),text("J_ESP_R.6 C20/R10"),text("C6/R13"),
text("6"),text("ADC_A"),text("GPIO34"),text("J_ESP_R.12 C20/R16"),text("C7/R13"),
text("7"),text("ADC_B"),text("GPIO35"),text("J_ESP_R.11 C20/R15"),text("C8/R13"),
text("8"),text("EDU_ON (entrada)"),text("GPIO23"),text("J_ESP_L.15 C10/R19"),text("C9/R13"),
text("9"),text("3V3_LOCAL"),text("3V3"),text("J_ESP_L.1 C10/R5"),text("C10/R13"),
text("10"),text("GND"),text("GND"),text("J_ESP_R.2 C20/R6"),text("C11/R13"))

Podem ser fios soldados ao terminal do soquete acessível, com o ESP32 retirado, sem alterar as conexões existentes. Não depender do cabeçalho J_EXP do projeto antigo: ele não faz parte da etapa simplificada. GPIO34/35 só recebem a saída condicionada (aprox.0,25–2,9V), nunca os sinais brutos de 5V.
#pagebreak()
= 5 — Energia e cabo externo de sinais
== J_POWER do complemento
#table(columns:(8%,18%,22%,52%),inset:4pt,text("Pino"),text("Sinal"),text("Furo TOP"),text("Origem / função"),
text("1"),text("V5V_SYS"),text("C22/R10"),text("5V de lógica"),
text("2"),text("GND"),text("C23/R10"),text("GND comum"),
text("3"),text("V5V_EDU"),text("C24/R10"),text("5V didático habilitado e limitado; deve derivar de 5V_SYS"),
text("4"),text("GND"),text("C25/R10"),text("GND comum"))
== J_ROUTER do complemento
#table(columns:(8%,18%,22%,52%),inset:4pt,text("Pino"),text("Sinal"),text("Furo TOP"),text("Origem / função"),
text("1"),text("SENSE_A"),text("C7/R11"),text("Terminal analógico selecionado, absoluto 0…5,25V"),
text("2"),text("GND"),text("C8/R11"),text("GND comum"),
text("3"),text("SENSE_B"),text("C9/R11"),text("Terminal analógico selecionado, absoluto 0…5,25V"),
text("4"),text("PULSE"),text("C10/R11"),text("Saída para P3 selecionado, não é alimentação da tela"),
text("5"),text("GND"),text("C11/R11"),text("GND comum"),
text("6"),text("EDU_ON"),text("C12/R11"),text("3,3V lógico somente com fonte didática válida/ligada"),
text("7"),text("OFF_OK"),text("C13/R11"),text("3,3V lógico somente com circuito desenergizado verificado"))

*Contrato externo, sem desenhar o roteador:* SENSE_A/B são distintos e nunca unidos pela seleção. PULSE_OUT vai a somente um P3. EDU_ON e EDU_OFF_OK são sinais de 0/3,3V, nunca 5V; cabos abertos são tratados como NÃO autorizado pelos pull-downs. EDU_OFF_OK não pode ser um jumper permanente: deve representar uma condição de desenergização realmente verificada, incluindo capacitores/fontes externas. Não energizar a integração enquanto a origem desses sinais não estiver identificada e validada. V5V_EDU não pode permanecer acima de V5V_SYS durante operação normal; verificar sequenciamento e descarga.
#pagebreak()
= 6 — Complemento: posições propostas
#grid(columns:(1fr,1fr),image("assets/top.svg",width:105mm),image("assets/underside.svg",width:105mm))
#pagebreak()
= 7 — Legenda de componentes (1–18)
#table(columns:(6%,26%,38%,30%),inset:4pt,text("#"),text("Referência"),text("Valor/peça"),text("Pinos extremos TOP"),
text("1"),text("J_CTRL"),text("10 pins"),text("1=C2/R13; 10=C11/R13"),
text("2"),text("J_POWER"),text("4 pins"),text("1=C22/R10; 4=C25/R10"),
text("3"),text("J_ROUTER"),text("7 pins"),text("1=C7/R11; 7=C13/R11"),
text("4"),text("R_BIAS_TOP"),text("5.62k"),text("1=C22/R12; 2=C25/R12"),
text("5"),text("R_BIAS_BOT"),text("1k"),text("1=C16/R13; 2=C13/R13"),
text("6"),text("C_BIAS"),text("100nF"),text("1=C27/R2; 2=C28/R2"),
text("7"),text("R_A_TOP"),text("1M"),text("1=C18/R14; 2=C21/R14"),
text("8"),text("R_A_BOT"),text("1M"),text("1=C23/R14; 2=C26/R14"),
text("9"),text("C_A_DIV"),text("1nF"),text("1=C27/R5; 2=C28/R5"),
text("10"),text("R_A_ADC"),text("1k"),text("1=C2/R15; 2=C5/R15"),
text("11"),text("C_A_ADC"),text("10nF"),text("1=C27/R8; 2=C28/R8"),
text("12"),text("R_B_TOP"),text("1M"),text("1=C7/R15; 2=C10/R15"),
text("13"),text("R_B_BOT"),text("1M"),text("1=C12/R15; 2=C15/R15"),
text("14"),text("C_B_DIV"),text("1nF"),text("1=C27/R11; 2=C28/R11"),
text("15"),text("R_B_ADC"),text("1k"),text("1=C17/R16; 2=C20/R16"),
text("16"),text("C_B_ADC"),text("10nF"),text("1=C22/R16; 2=C23/R16"),
text("17"),text("U_BUF"),text("MCP6002-I/P"),text("1=C2/R2; 8=C5/R2"),
text("18"),text("C_BUF"),text("100nF"),text("1=C26/R16; 2=C27/R16"))
#pagebreak()
= 7 — Legenda de componentes (19–36)
#table(columns:(6%,26%,38%,30%),inset:4pt,text("#"),text("Referência"),text("Valor/peça"),text("Pinos extremos TOP"),
text("19"),text("U_WATCH"),text("CD74HC123E"),text("1=C7/R2; 16=C10/R2"),
text("20"),text("R_WATCH"),text("680k"),text("1=C2/R17; 2=C5/R17"),
text("21"),text("C_WATCH"),text("1uF"),text("1=C7/R17; 2=C8/R17"),
text("22"),text("C_WATCH_VCC"),text("100nF"),text("1=C11/R17; 2=C12/R17"),
text("23"),text("R_PD_ARM"),text("100k"),text("1=C14/R18; 2=C17/R18"),
text("24"),text("R_PD_HB"),text("100k"),text("1=C19/R18; 2=C22/R18"),
text("25"),text("R_PD_MODE_A"),text("100k"),text("1=C24/R18; 2=C27/R18"),
text("26"),text("R_PD_MODE_B"),text("100k"),text("1=C5/R19; 2=C2/R19"),
text("27"),text("R_PD_MODE_C"),text("100k"),text("1=C7/R19; 2=C10/R19"),
text("28"),text("R_PD_EDU_ON"),text("100k"),text("1=C12/R20; 2=C15/R20"),
text("29"),text("R_PD_EDU_OFF_OK"),text("100k"),text("1=C17/R20; 2=C20/R20"),
text("30"),text("U_MODE"),text("CD74HC238E"),text("1=C12/R2; 16=C15/R2"),
text("31"),text("C_MODE"),text("100nF"),text("1=C23/R20; 2=C22/R20"),
text("32"),text("U_GATE"),text("CD74HC08E"),text("1=C17/R2; 14=C20/R2"),
text("33"),text("C_GATE"),text("100nF"),text("1=C26/R20; 2=C27/R20"),
text("34"),text("R_REF_H_TOP"),text("1k"),text("1=C2/R21; 2=C5/R21"),
text("35"),text("R_REF_H_BOT"),text("49.9k"),text("1=C7/R21; 2=C10/R21"),
text("36"),text("R_REF_L_TOP"),text("49.9k"),text("1=C12/R22; 2=C15/R22"))
#pagebreak()
= 7 — Legenda de componentes (37–54)
#table(columns:(6%,26%,38%,30%),inset:4pt,text("#"),text("Referência"),text("Valor/peça"),text("Pinos extremos TOP"),
text("37"),text("R_REF_L_BOT"),text("1k"),text("1=C17/R22; 2=C20/R22"),
text("38"),text("C_REF_H"),text("100nF"),text("1=C2/R23; 2=C3/R23"),
text("39"),text("C_REF_L"),text("100nF"),text("1=C6/R23; 2=C7/R23"),
text("40"),text("R_H_SENSE"),text("10"),text("1=C22/R22; 2=C25/R22"),
text("41"),text("R_L_SENSE"),text("10"),text("1=C12/R24; 2=C9/R24"),
text("42"),text("R_IN_H_N"),text("47k"),text("1=C14/R24; 2=C17/R24"),
text("43"),text("R_IN_H_P"),text("47k"),text("1=C19/R24; 2=C22/R24"),
text("44"),text("R_IN_L_P"),text("47k"),text("1=C24/R24; 2=C27/R24"),
text("45"),text("R_IN_L_N"),text("47k"),text("1=C2/R25; 2=C5/R25"),
text("46"),text("U_LIMIT"),text("MCP6002-I/P"),text("1=C22/R2; 8=C25/R2"),
text("47"),text("C_LIMIT"),text("100nF"),text("1=C8/R26; 2=C7/R26"),
text("48"),text("R_H_GATE"),text("1k"),text("1=C10/R26; 2=C13/R26"),
text("49"),text("R_L_GATE"),text("1k"),text("1=C15/R26; 2=C18/R26"),
text("50"),text("R_H_OFF"),text("100k"),text("1=C20/R26; 2=C23/R26"),
text("51"),text("R_L_OFF"),text("100k"),text("1=C25/R26; 2=C28/R26"),
text("52"),text("C_H_COMP"),text("1nF"),text("1=C2/R27; 2=C3/R27"),
text("53"),text("C_L_COMP"),text("1nF"),text("1=C11/R28; 2=C12/R28"),
text("54"),text("Q_H_ADAPTER"),text("BSS84 on D-S-G adapter"),text("1=C5/R28; 3=C7/R28"))
#pagebreak()
= 7 — Legenda de componentes (55–72)
#table(columns:(6%,26%,38%,30%),inset:4pt,text("#"),text("Referência"),text("Valor/peça"),text("Pinos extremos TOP"),
text("55"),text("Q_LOW"),text("2N7000 on D-S-G adapter"),text("1=C14/R28; 3=C16/R28"),
text("56"),text("U_SSR_HIGH"),text("AQY212EH"),text("1=C2/R7; 4=C5/R7"),
text("57"),text("R_U_SSR_HIGH_LED"),text("270"),text("1=C18/R28; 2=C21/R28"),
text("58"),text("R_U_SSR_HIGH_BASE"),text("4.7k"),text("1=C23/R28; 2=C26/R28"),
text("59"),text("R_U_SSR_HIGH_OFF"),text("100k"),text("1=C2/R30; 2=C5/R30"),
text("60"),text("Q_U_SSR_HIGH"),text("BC548B"),text("1=C7/R30; 3=C9/R30"),
text("61"),text("U_SSR_LOW"),text("AQY212EH"),text("1=C22/R7; 4=C25/R7"),
text("62"),text("R_U_SSR_LOW_LED"),text("270"),text("1=C11/R30; 2=C14/R30"),
text("63"),text("R_U_SSR_LOW_BASE"),text("4.7k"),text("1=C16/R30; 2=C19/R30"),
text("64"),text("R_U_SSR_LOW_OFF"),text("100k"),text("1=C21/R30; 2=C24/R30"),
text("65"),text("Q_U_SSR_LOW"),text("BC548B"),text("1=C26/R30; 3=C28/R30"),
text("66"),text("D_STIM"),text("1N4148"),text("1=C2/R32; 2=C5/R32"),
text("67"),text("R_STIM"),text("11k"),text("1=C7/R32; 2=C10/R32"),
text("68"),text("U_SSR_STIM"),text("AQY212EH"),text("1=C2/R10; 4=C5/R10"),
text("69"),text("R_U_SSR_STIM_LED"),text("270"),text("1=C12/R32; 2=C15/R32"),
text("70"),text("R_U_SSR_STIM_BASE"),text("4.7k"),text("1=C17/R32; 2=C20/R32"),
text("71"),text("R_U_SSR_STIM_OFF"),text("100k"),text("1=C22/R32; 2=C25/R32"),
text("72"),text("Q_U_SSR_STIM"),text("BC548B"),text("1=C2/R34; 3=C4/R34"))
#pagebreak()
= 7 — Legenda de componentes (73–77)
#table(columns:(6%,26%,38%,30%),inset:4pt,text("#"),text("Referência"),text("Valor/peça"),text("Pinos extremos TOP"),
text("73"),text("U_SSR_RETURN"),text("AQY212EH"),text("1=C17/R10; 4=C20/R10"),
text("74"),text("R_U_SSR_RETURN_LED"),text("270"),text("1=C6/R34; 2=C9/R34"),
text("75"),text("R_U_SSR_RETURN_BASE"),text("4.7k"),text("1=C11/R34; 2=C14/R34"),
text("76"),text("R_U_SSR_RETURN_OFF"),text("100k"),text("1=C16/R34; 2=C19/R34"),
text("77"),text("Q_U_SSR_RETURN"),text("BC548B"),text("1=C21/R34; 3=C23/R34"))
#pagebreak()
= 8 — Polaridade, soquetes e adaptadores
- ICs DIP: pino1 no círculo do desenho. Vista superior: pinos descem de um lado e sobem pelo outro. Usar soquetes; conferir entalhe, quantidade de pinos e modelo antes de inserir.
- U_BUF e U_LIMIT = MCP6002-I/P DIP8; U_WATCH = CD74HC123E; U_MODE = CD74HC238E; U_GATE = CD74HC08E, todos HC a3,3V exceto U_LIMIT a5V_SYS. Não substituir por HCT na lógica de3,3V.
- PhotoMOS U_SSR_HIGH/LOW/STIM/RETURN = AQY212EH DIP4: 1=ânodo LED,2=cátodo,3/4=contato isolado. Não é relé mecânico genérico e não equivale a módulo com LED/resistor já instalado.
- BC548B: confirmar C-B-E no datasheet/fabricante real; os três furos do desenho representam C/B/E nessa ordem. Não instalar 2N3904 de pinagem E-B-C sem revisar os fios.
- Q_H_ADAPTER BSS84: adaptador numerado1=D,2=S,3=G. No SOT23 BSS84 usual:1=G,2=S,3=D; portanto o adaptador precisa mapear esses pinos, não copiá-los em linha. Corpo e encapsulamento do adaptador devem ser medidos.
- Q_LOW usa 2N7000 em adaptador1=D,2=S,3=G. Identificar D/S/G do componente real antes de montar; não confiar em orientação visual de outro fabricante.
- D_STIM 1N4148: faixa = cátodo K, ligada ao R_STIM.
- R_A_TOP/BOT e R_B_TOP/BOT =1MΩ±0,1%; não usar10kΩ. R_STIM=11kΩ±1%; resistores de referência1k/49,9k e sensores10Ω±1%. Capacitores da extensão não polarizados; C_WATCH=1µF com tolerância conhecida, preferir±5%, conferir corpo real.
- Formar terminais sem esforço no corpo; isolar fios e adaptadores. Não usar o desenho nominal como prova de encaixe dos corpos ou dos plugs.
#pagebreak()
= 9 — Fiação do complemento F001–F010
#grid(columns:(90mm,1fr),gutter:5mm,image("assets/wire-01.svg",width:90mm),[
#table(columns:(28%,36%,36%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("F001 ARM"),text("J_CTRL.1 — C2/R13"),text("U_WATCH.3 — C7/R4"),
text("F002 ARM"),text("U_WATCH.3 — C7/R4"),text("R_PD_ARM.1 — C14/R18"),
text("F003 HB"),text("J_CTRL.2 — C3/R13"),text("U_WATCH.2 — C7/R3"),
text("F004 HB"),text("U_WATCH.2 — C7/R3"),text("R_PD_HB.1 — C19/R18"),
text("F005 MODE_A"),text("J_CTRL.3 — C4/R13"),text("R_PD_MODE_A.1 — C24/R18"),
text("F006 MODE_A"),text("R_PD_MODE_A.1 — C24/R18"),text("U_MODE.1 — C12/R2"),
text("F007 MODE_B"),text("J_CTRL.4 — C5/R13"),text("R_PD_MODE_B.1 — C5/R19"),
text("F008 MODE_B"),text("R_PD_MODE_B.1 — C5/R19"),text("U_MODE.2 — C12/R3"),
text("F009 MODE_C"),text("J_CTRL.5 — C6/R13"),text("R_PD_MODE_C.1 — C7/R19"),
text("F010 MODE_C"),text("R_PD_MODE_C.1 — C7/R19"),text("U_MODE.3 — C12/R4"))

])
Linhas tracejadas só identificam terminais. Planejar manualmente fios isolados, afastar sinais de alta impedância dos controles e verificar cruzamentos. A lista não é rota de cobre nem percurso físico aprovado.
#pagebreak()
= 9 — Fiação do complemento F011–F020
#grid(columns:(90mm,1fr),gutter:5mm,image("assets/wire-02.svg",width:90mm),[
#table(columns:(28%,36%,36%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("F011 ADC_A"),text("J_CTRL.6 — C7/R13"),text("R_A_ADC.2 — C5/R15"),
text("F012 ADC_A"),text("R_A_ADC.2 — C5/R15"),text("C_A_ADC.1 — C27/R8"),
text("F013 ADC_B"),text("J_CTRL.7 — C8/R13"),text("R_B_ADC.2 — C20/R16"),
text("F014 ADC_B"),text("R_B_ADC.2 — C20/R16"),text("C_B_ADC.1 — C22/R16"),
text("F015 EDU_ON"),text("J_CTRL.8 — C9/R13"),text("J_ROUTER.6 — C12/R11"),
text("F016 EDU_ON"),text("J_ROUTER.6 — C12/R11"),text("R_PD_EDU_ON.1 — C12/R20"),
text("F017 EDU_ON"),text("R_PD_EDU_ON.1 — C12/R20"),text("U_GATE.2 — C17/R3"),
text("F018 EDU_ON"),text("U_GATE.2 — C17/R3"),text("U_GATE.5 — C17/R6"),
text("F019 V3V3_LOCAL"),text("J_CTRL.9 — C10/R13"),text("R_BIAS_TOP.1 — C22/R12"),
text("F020 V3V3_LOCAL"),text("R_BIAS_TOP.1 — C22/R12"),text("U_BUF.8 — C5/R2"))

])
Linhas tracejadas só identificam terminais. Planejar manualmente fios isolados, afastar sinais de alta impedância dos controles e verificar cruzamentos. A lista não é rota de cobre nem percurso físico aprovado.
#pagebreak()
= 9 — Fiação do complemento F021–F030
#grid(columns:(90mm,1fr),gutter:5mm,image("assets/wire-03.svg",width:90mm),[
#table(columns:(28%,36%,36%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("F021 V3V3_LOCAL"),text("U_BUF.8 — C5/R2"),text("C_BUF.1 — C26/R16"),
text("F022 V3V3_LOCAL"),text("C_BUF.1 — C26/R16"),text("U_WATCH.16 — C10/R2"),
text("F023 V3V3_LOCAL"),text("U_WATCH.16 — C10/R2"),text("R_WATCH.1 — C2/R17"),
text("F024 V3V3_LOCAL"),text("R_WATCH.1 — C2/R17"),text("C_WATCH_VCC.1 — C11/R17"),
text("F025 V3V3_LOCAL"),text("C_WATCH_VCC.1 — C11/R17"),text("U_MODE.16 — C15/R2"),
text("F026 V3V3_LOCAL"),text("U_MODE.16 — C15/R2"),text("C_MODE.1 — C23/R20"),
text("F027 V3V3_LOCAL"),text("C_MODE.1 — C23/R20"),text("U_GATE.14 — C20/R2"),
text("F028 V3V3_LOCAL"),text("U_GATE.14 — C20/R2"),text("C_GATE.1 — C26/R20"),
text("F029 V3V3_LOCAL"),text("C_GATE.1 — C26/R20"),text("R_U_SSR_HIGH_LED.1 — C18/R28"),
text("F030 V3V3_LOCAL"),text("R_U_SSR_HIGH_LED.1 — C18/R28"),text("R_U_SSR_LOW_LED.1 — C11/R30"))

])
Linhas tracejadas só identificam terminais. Planejar manualmente fios isolados, afastar sinais de alta impedância dos controles e verificar cruzamentos. A lista não é rota de cobre nem percurso físico aprovado.
#pagebreak()
= 9 — Fiação do complemento F031–F040
#grid(columns:(90mm,1fr),gutter:5mm,image("assets/wire-04.svg",width:90mm),[
#table(columns:(28%,36%,36%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("F031 V3V3_LOCAL"),text("R_U_SSR_LOW_LED.1 — C11/R30"),text("D_STIM.1 — C2/R32"),
text("F032 V3V3_LOCAL"),text("D_STIM.1 — C2/R32"),text("R_U_SSR_STIM_LED.1 — C12/R32"),
text("F033 V3V3_LOCAL"),text("R_U_SSR_STIM_LED.1 — C12/R32"),text("R_U_SSR_RETURN_LED.1 — C6/R34"),
text("F034 GND"),text("J_CTRL.10 — C11/R13"),text("J_POWER.2 — C23/R10"),
text("F035 GND"),text("J_POWER.2 — C23/R10"),text("J_POWER.4 — C25/R10"),
text("F036 GND"),text("J_POWER.4 — C25/R10"),text("J_ROUTER.2 — C8/R11"),
text("F037 GND"),text("J_ROUTER.2 — C8/R11"),text("J_ROUTER.5 — C11/R11"),
text("F038 GND"),text("J_ROUTER.5 — C11/R11"),text("R_BIAS_BOT.2 — C13/R13"),
text("F039 GND"),text("R_BIAS_BOT.2 — C13/R13"),text("C_BIAS.2 — C28/R2"),
text("F040 GND"),text("C_BIAS.2 — C28/R2"),text("C_A_DIV.2 — C28/R5"))

])
Linhas tracejadas só identificam terminais. Planejar manualmente fios isolados, afastar sinais de alta impedância dos controles e verificar cruzamentos. A lista não é rota de cobre nem percurso físico aprovado.
#pagebreak()
= 9 — Fiação do complemento F041–F050
#grid(columns:(90mm,1fr),gutter:5mm,image("assets/wire-05.svg",width:90mm),[
#table(columns:(28%,36%,36%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("F041 GND"),text("C_A_DIV.2 — C28/R5"),text("C_A_ADC.2 — C28/R8"),
text("F042 GND"),text("C_A_ADC.2 — C28/R8"),text("C_B_DIV.2 — C28/R11"),
text("F043 GND"),text("C_B_DIV.2 — C28/R11"),text("C_B_ADC.2 — C23/R16"),
text("F044 GND"),text("C_B_ADC.2 — C23/R16"),text("U_BUF.4 — C2/R5"),
text("F045 GND"),text("U_BUF.4 — C2/R5"),text("C_BUF.2 — C27/R16"),
text("F046 GND"),text("C_BUF.2 — C27/R16"),text("U_WATCH.1 — C7/R2"),
text("F047 GND"),text("U_WATCH.1 — C7/R2"),text("U_WATCH.8 — C7/R9"),
text("F048 GND"),text("U_WATCH.8 — C7/R9"),text("U_WATCH.9 — C10/R9"),
text("F049 GND"),text("U_WATCH.9 — C10/R9"),text("U_WATCH.10 — C10/R8"),
text("F050 GND"),text("U_WATCH.10 — C10/R8"),text("U_WATCH.11 — C10/R7"))

])
Linhas tracejadas só identificam terminais. Planejar manualmente fios isolados, afastar sinais de alta impedância dos controles e verificar cruzamentos. A lista não é rota de cobre nem percurso físico aprovado.
#pagebreak()
= 9 — Fiação do complemento F051–F060
#grid(columns:(90mm,1fr),gutter:5mm,image("assets/wire-06.svg",width:90mm),[
#table(columns:(28%,36%,36%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("F051 GND"),text("U_WATCH.11 — C10/R7"),text("C_WATCH_VCC.2 — C12/R17"),
text("F052 GND"),text("C_WATCH_VCC.2 — C12/R17"),text("R_PD_ARM.2 — C17/R18"),
text("F053 GND"),text("R_PD_ARM.2 — C17/R18"),text("R_PD_HB.2 — C22/R18"),
text("F054 GND"),text("R_PD_HB.2 — C22/R18"),text("R_PD_MODE_A.2 — C27/R18"),
text("F055 GND"),text("R_PD_MODE_A.2 — C27/R18"),text("R_PD_MODE_B.2 — C2/R19"),
text("F056 GND"),text("R_PD_MODE_B.2 — C2/R19"),text("R_PD_MODE_C.2 — C10/R19"),
text("F057 GND"),text("R_PD_MODE_C.2 — C10/R19"),text("R_PD_EDU_ON.2 — C15/R20"),
text("F058 GND"),text("R_PD_EDU_ON.2 — C15/R20"),text("R_PD_EDU_OFF_OK.2 — C20/R20"),
text("F059 GND"),text("R_PD_EDU_OFF_OK.2 — C20/R20"),text("U_MODE.4 — C12/R5"),
text("F060 GND"),text("U_MODE.4 — C12/R5"),text("U_MODE.5 — C12/R6"))

])
Linhas tracejadas só identificam terminais. Planejar manualmente fios isolados, afastar sinais de alta impedância dos controles e verificar cruzamentos. A lista não é rota de cobre nem percurso físico aprovado.
#pagebreak()
= 9 — Fiação do complemento F061–F070
#grid(columns:(90mm,1fr),gutter:5mm,image("assets/wire-07.svg",width:90mm),[
#table(columns:(28%,36%,36%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("F061 GND"),text("U_MODE.5 — C12/R6"),text("U_MODE.8 — C12/R9"),
text("F062 GND"),text("U_MODE.8 — C12/R9"),text("C_MODE.2 — C22/R20"),
text("F063 GND"),text("C_MODE.2 — C22/R20"),text("U_GATE.7 — C17/R8"),
text("F064 GND"),text("U_GATE.7 — C17/R8"),text("U_GATE.12 — C20/R4"),
text("F065 GND"),text("U_GATE.12 — C20/R4"),text("U_GATE.13 — C20/R3"),
text("F066 GND"),text("U_GATE.13 — C20/R3"),text("C_GATE.2 — C27/R20"),
text("F067 GND"),text("C_GATE.2 — C27/R20"),text("R_REF_H_BOT.2 — C10/R21"),
text("F068 GND"),text("R_REF_H_BOT.2 — C10/R21"),text("R_REF_L_BOT.2 — C20/R22"),
text("F069 GND"),text("R_REF_L_BOT.2 — C20/R22"),text("C_REF_H.2 — C3/R23"),
text("F070 GND"),text("C_REF_H.2 — C3/R23"),text("C_REF_L.2 — C7/R23"))

])
Linhas tracejadas só identificam terminais. Planejar manualmente fios isolados, afastar sinais de alta impedância dos controles e verificar cruzamentos. A lista não é rota de cobre nem percurso físico aprovado.
#pagebreak()
= 9 — Fiação do complemento F071–F080
#grid(columns:(90mm,1fr),gutter:5mm,image("assets/wire-08.svg",width:90mm),[
#table(columns:(28%,36%,36%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("F071 GND"),text("C_REF_L.2 — C7/R23"),text("R_L_SENSE.2 — C9/R24"),
text("F072 GND"),text("R_L_SENSE.2 — C9/R24"),text("U_LIMIT.4 — C22/R5"),
text("F073 GND"),text("U_LIMIT.4 — C22/R5"),text("C_LIMIT.2 — C7/R26"),
text("F074 GND"),text("C_LIMIT.2 — C7/R26"),text("R_L_OFF.2 — C28/R26"),
text("F075 GND"),text("R_L_OFF.2 — C28/R26"),text("R_U_SSR_HIGH_OFF.2 — C5/R30"),
text("F076 GND"),text("R_U_SSR_HIGH_OFF.2 — C5/R30"),text("Q_U_SSR_HIGH.3 — C9/R30"),
text("F077 GND"),text("Q_U_SSR_HIGH.3 — C9/R30"),text("R_U_SSR_LOW_OFF.2 — C24/R30"),
text("F078 GND"),text("R_U_SSR_LOW_OFF.2 — C24/R30"),text("Q_U_SSR_LOW.3 — C28/R30"),
text("F079 GND"),text("Q_U_SSR_LOW.3 — C28/R30"),text("R_U_SSR_STIM_OFF.2 — C25/R32"),
text("F080 GND"),text("R_U_SSR_STIM_OFF.2 — C25/R32"),text("Q_U_SSR_STIM.3 — C4/R34"))

])
Linhas tracejadas só identificam terminais. Planejar manualmente fios isolados, afastar sinais de alta impedância dos controles e verificar cruzamentos. A lista não é rota de cobre nem percurso físico aprovado.
#pagebreak()
= 9 — Fiação do complemento F081–F090
#grid(columns:(90mm,1fr),gutter:5mm,image("assets/wire-09.svg",width:90mm),[
#table(columns:(28%,36%,36%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("F081 GND"),text("Q_U_SSR_STIM.3 — C4/R34"),text("U_SSR_RETURN.4 — C20/R10"),
text("F082 GND"),text("U_SSR_RETURN.4 — C20/R10"),text("R_U_SSR_RETURN_OFF.2 — C19/R34"),
text("F083 GND"),text("R_U_SSR_RETURN_OFF.2 — C19/R34"),text("Q_U_SSR_RETURN.3 — C23/R34"),
text("F084 V5V_SYS"),text("J_POWER.1 — C22/R10"),text("U_LIMIT.8 — C25/R2"),
text("F085 V5V_SYS"),text("U_LIMIT.8 — C25/R2"),text("C_LIMIT.1 — C8/R26"),
text("F086 V5V_EDU"),text("J_POWER.3 — C24/R10"),text("R_REF_H_TOP.1 — C2/R21"),
text("F087 V5V_EDU"),text("R_REF_H_TOP.1 — C2/R21"),text("R_REF_L_TOP.1 — C12/R22"),
text("F088 V5V_EDU"),text("R_REF_L_TOP.1 — C12/R22"),text("R_H_SENSE.1 — C22/R22"),
text("F089 SENSE_A"),text("J_ROUTER.1 — C7/R11"),text("R_A_TOP.1 — C18/R14"),
text("F090 SENSE_A"),text("R_A_TOP.1 — C18/R14"),text("U_SSR_STIM.4 — C5/R10"))

])
Linhas tracejadas só identificam terminais. Planejar manualmente fios isolados, afastar sinais de alta impedância dos controles e verificar cruzamentos. A lista não é rota de cobre nem percurso físico aprovado.
#pagebreak()
= 9 — Fiação do complemento F091–F100
#grid(columns:(90mm,1fr),gutter:5mm,image("assets/wire-10.svg",width:90mm),[
#table(columns:(28%,36%,36%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("F091 SENSE_B"),text("J_ROUTER.3 — C9/R11"),text("R_B_TOP.1 — C7/R15"),
text("F092 SENSE_B"),text("R_B_TOP.1 — C7/R15"),text("U_SSR_RETURN.3 — C20/R11"),
text("F093 PULSE_OUT"),text("J_ROUTER.4 — C10/R11"),text("U_SSR_HIGH.4 — C5/R7"),
text("F094 PULSE_OUT"),text("U_SSR_HIGH.4 — C5/R7"),text("U_SSR_LOW.3 — C25/R8"),
text("F095 EDU_OFF_OK"),text("J_ROUTER.7 — C13/R11"),text("R_PD_EDU_OFF_OK.1 — C17/R20"),
text("F096 EDU_OFF_OK"),text("R_PD_EDU_OFF_OK.1 — C17/R20"),text("U_GATE.10 — C20/R6"),
text("F097 BIAS"),text("R_BIAS_TOP.2 — C25/R12"),text("R_BIAS_BOT.1 — C16/R13"),
text("F098 BIAS"),text("R_BIAS_BOT.1 — C16/R13"),text("C_BIAS.1 — C27/R2"),
text("F099 BIAS"),text("C_BIAS.1 — C27/R2"),text("R_A_BOT.2 — C26/R14"),
text("F100 BIAS"),text("R_A_BOT.2 — C26/R14"),text("R_B_BOT.2 — C15/R15"))

])
Linhas tracejadas só identificam terminais. Planejar manualmente fios isolados, afastar sinais de alta impedância dos controles e verificar cruzamentos. A lista não é rota de cobre nem percurso físico aprovado.
#pagebreak()
= 9 — Fiação do complemento F101–F110
#grid(columns:(90mm,1fr),gutter:5mm,image("assets/wire-11.svg",width:90mm),[
#table(columns:(28%,36%,36%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("F101 DIV_A"),text("R_A_TOP.2 — C21/R14"),text("R_A_BOT.1 — C23/R14"),
text("F102 DIV_A"),text("R_A_BOT.1 — C23/R14"),text("C_A_DIV.1 — C27/R5"),
text("F103 DIV_A"),text("C_A_DIV.1 — C27/R5"),text("U_BUF.3 — C2/R4"),
text("F104 BUF_A"),text("R_A_ADC.1 — C2/R15"),text("U_BUF.1 — C2/R2"),
text("F105 BUF_A"),text("U_BUF.1 — C2/R2"),text("U_BUF.2 — C2/R3"),
text("F106 DIV_B"),text("R_B_TOP.2 — C10/R15"),text("R_B_BOT.1 — C12/R15"),
text("F107 DIV_B"),text("R_B_BOT.1 — C12/R15"),text("C_B_DIV.1 — C27/R11"),
text("F108 DIV_B"),text("C_B_DIV.1 — C27/R11"),text("U_BUF.5 — C5/R5"),
text("F109 BUF_B"),text("R_B_ADC.1 — C17/R16"),text("U_BUF.6 — C5/R4"),
text("F110 BUF_B"),text("U_BUF.6 — C5/R4"),text("U_BUF.7 — C5/R3"))

])
Linhas tracejadas só identificam terminais. Planejar manualmente fios isolados, afastar sinais de alta impedância dos controles e verificar cruzamentos. A lista não é rota de cobre nem percurso físico aprovado.
#pagebreak()
= 9 — Fiação do complemento F111–F120
#grid(columns:(90mm,1fr),gutter:5mm,image("assets/wire-12.svg",width:90mm),[
#table(columns:(28%,36%,36%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("F111 ALIVE"),text("U_WATCH.13 — C10/R5"),text("U_MODE.6 — C12/R7"),
text("F112 WATCH_CX"),text("U_WATCH.14 — C10/R4"),text("C_WATCH.2 — C8/R17"),
text("F113 WATCH_RX"),text("U_WATCH.15 — C10/R3"),text("R_WATCH.2 — C5/R17"),
text("F114 WATCH_RX"),text("R_WATCH.2 — C5/R17"),text("C_WATCH.1 — C7/R17"),
text("F115 DEC_DIAG"),text("U_MODE.11 — C15/R7"),text("U_GATE.9 — C20/R7"),
text("F116 DEC_LOW"),text("U_MODE.13 — C15/R5"),text("U_GATE.4 — C17/R5"),
text("F117 DEC_HIGH"),text("U_MODE.14 — C15/R4"),text("U_GATE.1 — C17/R2"),
text("F118 HIGH_EN"),text("U_GATE.3 — C17/R4"),text("R_U_SSR_HIGH_BASE.1 — C23/R28"),
text("F119 LOW_EN"),text("U_GATE.6 — C17/R7"),text("R_U_SSR_LOW_BASE.1 — C16/R30"),
text("F120 DIAG_EN"),text("U_GATE.8 — C20/R8"),text("R_U_SSR_STIM_BASE.1 — C17/R32"))

])
Linhas tracejadas só identificam terminais. Planejar manualmente fios isolados, afastar sinais de alta impedância dos controles e verificar cruzamentos. A lista não é rota de cobre nem percurso físico aprovado.
#pagebreak()
= 9 — Fiação do complemento F121–F130
#grid(columns:(90mm,1fr),gutter:5mm,image("assets/wire-13.svg",width:90mm),[
#table(columns:(28%,36%,36%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("F121 DIAG_EN"),text("R_U_SSR_STIM_BASE.1 — C17/R32"),text("R_U_SSR_RETURN_BASE.1 — C11/R34"),
text("F122 REF_H"),text("R_REF_H_TOP.2 — C5/R21"),text("R_REF_H_BOT.1 — C7/R21"),
text("F123 REF_H"),text("R_REF_H_BOT.1 — C7/R21"),text("C_REF_H.1 — C2/R23"),
text("F124 REF_H"),text("C_REF_H.1 — C2/R23"),text("R_IN_H_P.1 — C19/R24"),
text("F125 REF_L"),text("R_REF_L_TOP.2 — C15/R22"),text("R_REF_L_BOT.1 — C17/R22"),
text("F126 REF_L"),text("R_REF_L_BOT.1 — C17/R22"),text("C_REF_L.1 — C6/R23"),
text("F127 REF_L"),text("C_REF_L.1 — C6/R23"),text("R_IN_L_P.1 — C24/R24"),
text("F128 H_SENSE"),text("R_H_SENSE.2 — C25/R22"),text("R_IN_H_N.1 — C14/R24"),
text("F129 H_SENSE"),text("R_IN_H_N.1 — C14/R24"),text("R_H_OFF.2 — C23/R26"),
text("F130 H_SENSE"),text("R_H_OFF.2 — C23/R26"),text("C_H_COMP.2 — C3/R27"))

])
Linhas tracejadas só identificam terminais. Planejar manualmente fios isolados, afastar sinais de alta impedância dos controles e verificar cruzamentos. A lista não é rota de cobre nem percurso físico aprovado.
#pagebreak()
= 9 — Fiação do complemento F131–F140
#grid(columns:(90mm,1fr),gutter:5mm,image("assets/wire-14.svg",width:90mm),[
#table(columns:(28%,36%,36%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("F131 H_SENSE"),text("C_H_COMP.2 — C3/R27"),text("Q_H_ADAPTER.2 — C6/R28"),
text("F132 L_SENSE"),text("R_L_SENSE.1 — C12/R24"),text("R_IN_L_N.1 — C2/R25"),
text("F133 L_SENSE"),text("R_IN_L_N.1 — C2/R25"),text("C_L_COMP.2 — C12/R28"),
text("F134 L_SENSE"),text("C_L_COMP.2 — C12/R28"),text("Q_LOW.2 — C15/R28"),
text("F135 LIM_A_N"),text("R_IN_H_N.2 — C17/R24"),text("U_LIMIT.2 — C22/R3"),
text("F136 LIM_A_P"),text("R_IN_H_P.2 — C22/R24"),text("U_LIMIT.3 — C22/R4"),
text("F137 LIM_B_P"),text("R_IN_L_P.2 — C27/R24"),text("U_LIMIT.5 — C25/R5"),
text("F138 LIM_B_N"),text("R_IN_L_N.2 — C5/R25"),text("U_LIMIT.6 — C25/R4"),
text("F139 H_DRIVE"),text("U_LIMIT.1 — C22/R2"),text("R_H_GATE.1 — C10/R26"),
text("F140 H_DRIVE"),text("R_H_GATE.1 — C10/R26"),text("C_H_COMP.1 — C2/R27"))

])
Linhas tracejadas só identificam terminais. Planejar manualmente fios isolados, afastar sinais de alta impedância dos controles e verificar cruzamentos. A lista não é rota de cobre nem percurso físico aprovado.
#pagebreak()
= 9 — Fiação do complemento F141–F150
#grid(columns:(90mm,1fr),gutter:5mm,image("assets/wire-15.svg",width:90mm),[
#table(columns:(28%,36%,36%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("F141 L_DRIVE"),text("U_LIMIT.7 — C25/R3"),text("R_L_GATE.1 — C15/R26"),
text("F142 L_DRIVE"),text("R_L_GATE.1 — C15/R26"),text("C_L_COMP.1 — C11/R28"),
text("F143 H_GATE"),text("R_H_GATE.2 — C13/R26"),text("R_H_OFF.1 — C20/R26"),
text("F144 H_GATE"),text("R_H_OFF.1 — C20/R26"),text("Q_H_ADAPTER.3 — C7/R28"),
text("F145 L_GATE"),text("R_L_GATE.2 — C18/R26"),text("R_L_OFF.1 — C25/R26"),
text("F146 L_GATE"),text("R_L_OFF.1 — C25/R26"),text("Q_LOW.3 — C16/R28"),
text("F147 SOURCE_OUT"),text("Q_H_ADAPTER.1 — C5/R28"),text("U_SSR_HIGH.3 — C5/R8"),
text("F148 SINK_IN"),text("Q_LOW.1 — C14/R28"),text("U_SSR_LOW.4 — C25/R7"),
text("F149 U_SSR_HIGH_A"),text("U_SSR_HIGH.1 — C2/R7"),text("R_U_SSR_HIGH_LED.2 — C21/R28"),
text("F150 U_SSR_HIGH_K"),text("U_SSR_HIGH.2 — C2/R8"),text("Q_U_SSR_HIGH.1 — C7/R30"))

])
Linhas tracejadas só identificam terminais. Planejar manualmente fios isolados, afastar sinais de alta impedância dos controles e verificar cruzamentos. A lista não é rota de cobre nem percurso físico aprovado.
#pagebreak()
= 9 — Fiação do complemento F151–F160
#grid(columns:(90mm,1fr),gutter:5mm,image("assets/wire-16.svg",width:90mm),[
#table(columns:(28%,36%,36%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("F151 U_SSR_HIGH_BASE"),text("R_U_SSR_HIGH_BASE.2 — C26/R28"),text("R_U_SSR_HIGH_OFF.1 — C2/R30"),
text("F152 U_SSR_HIGH_BASE"),text("R_U_SSR_HIGH_OFF.1 — C2/R30"),text("Q_U_SSR_HIGH.2 — C8/R30"),
text("F153 U_SSR_LOW_A"),text("U_SSR_LOW.1 — C22/R7"),text("R_U_SSR_LOW_LED.2 — C14/R30"),
text("F154 U_SSR_LOW_K"),text("U_SSR_LOW.2 — C22/R8"),text("Q_U_SSR_LOW.1 — C26/R30"),
text("F155 U_SSR_LOW_BASE"),text("R_U_SSR_LOW_BASE.2 — C19/R30"),text("R_U_SSR_LOW_OFF.1 — C21/R30"),
text("F156 U_SSR_LOW_BASE"),text("R_U_SSR_LOW_OFF.1 — C21/R30"),text("Q_U_SSR_LOW.2 — C27/R30"),
text("F157 STIM_FEED"),text("D_STIM.2 — C5/R32"),text("R_STIM.1 — C7/R32"),
text("F158 STIM_LIMITED"),text("R_STIM.2 — C10/R32"),text("U_SSR_STIM.3 — C5/R11"),
text("F159 U_SSR_STIM_A"),text("U_SSR_STIM.1 — C2/R10"),text("R_U_SSR_STIM_LED.2 — C15/R32"),
text("F160 U_SSR_STIM_K"),text("U_SSR_STIM.2 — C2/R11"),text("Q_U_SSR_STIM.1 — C2/R34"))

])
Linhas tracejadas só identificam terminais. Planejar manualmente fios isolados, afastar sinais de alta impedância dos controles e verificar cruzamentos. A lista não é rota de cobre nem percurso físico aprovado.
#pagebreak()
= 9 — Fiação do complemento F161–F166
#grid(columns:(90mm,1fr),gutter:5mm,image("assets/wire-17.svg",width:90mm),[
#table(columns:(28%,36%,36%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("F161 U_SSR_STIM_BASE"),text("R_U_SSR_STIM_BASE.2 — C20/R32"),text("R_U_SSR_STIM_OFF.1 — C22/R32"),
text("F162 U_SSR_STIM_BASE"),text("R_U_SSR_STIM_OFF.1 — C22/R32"),text("Q_U_SSR_STIM.2 — C3/R34"),
text("F163 U_SSR_RETURN_A"),text("U_SSR_RETURN.1 — C17/R10"),text("R_U_SSR_RETURN_LED.2 — C9/R34"),
text("F164 U_SSR_RETURN_K"),text("U_SSR_RETURN.2 — C17/R11"),text("Q_U_SSR_RETURN.1 — C21/R34"),
text("F165 U_SSR_RETURN_BASE"),text("R_U_SSR_RETURN_BASE.2 — C14/R34"),text("R_U_SSR_RETURN_OFF.1 — C16/R34"),
text("F166 U_SSR_RETURN_BASE"),text("R_U_SSR_RETURN_OFF.1 — C16/R34"),text("Q_U_SSR_RETURN.2 — C22/R34"))

])
Linhas tracejadas só identificam terminais. Planejar manualmente fios isolados, afastar sinais de alta impedância dos controles e verificar cruzamentos. A lista não é rota de cobre nem percurso físico aprovado.
#pagebreak()
= 10 — Montagem incremental e verificações
1. Conferir as duas faces da placa já soldada pelos fios Sxx. Guardar fotos e resultados; não instalar as antigas redes10k/10k de medição.
2. Fazer dry-fit de toda a extensão em30×45, confirmando dimensões, corpos, adaptadores e plugs. Só então fixar um pino de cada soquete e conferir alinhamento.
3. Com ICs removidos, instalar GND,3,3V e5V conforme a lista; conferir continuidade e curtos antes de conectar qualquer fonte. Resistores, capacitores e soquetes não são internamente unidos pela perfboard.
4. Alimentar sem ESP32, ICs e sinais externos; medir polaridade e tensões em cada soquete. Desligar e instalar por bloco: buffer, watchdog/decodificador, regulador de corrente, PhotoMOS e diagnóstico.
5. Medição: aplicar fonte conhecida limitada em SENSE_A/B, mantendo diagnóstico e pulso desabilitados. Medir BIAS≈0,5V e DIV_A/B≈0,25V a entrada zero. Verificar entradas0,1,2,5 e5,25V contra multímetro e calibrar ganho/offset de cada canal. Repetir trocando A/B e com entradas iguais.
6. Medir impedância efetiva e fuga; não declarar≥1MΩ/≤10µA apenas pelos valores nominais. Conferir ruído, estabilização e atualização≤100ms nas três posições. O software deve publicar somente amostras da geração de rota confirmada.
7. Com saída desconectada do aluno, confirmar alta impedância em boot, ARM=0, heartbeat ausente e perda de EDU_ON. Medir expiração real de U_WATCH; alvo200–350ms, sem assumir0,45RC a3,3V. Ajustar a rede e medir limites.
8. Testar corrente SOURCE e SINK com fonte de bancada limitada: curto aGND e curto a5V até o máximo permitido. Medir≤12mA, aquecimento e oscilação, incluindo transientes. A compensação1nF é valor inicial que exige osciloscópio/ensaio; não equivale a circuito já homologado.
9. Verificar PULSE_OUT alto≥3,5V/baixo≤0,5V sob2mA. Depois medir no nó P3 real através do caminho selecionado. A resistência da chave externa faz parte da queda total.
10. Medir pulso0,5–10Hz e duty25–75%, erro±5% e±5p.p.; não basta observar LED piscando. Firmware deve inserir break-before-make≥5ms e compensar/verificar atraso do PhotoMOS no sinal real.
11. Continuidade: sem energia didática/pulso, testar curto conhecido,1kΩ e aberto no fim do cabo. Registrar resistência das rotas, incerteza e histerese. O ADC nativo/MCP6002 não prova por si só a classificação histórica≤20Ω/≥100Ω; resultado incerto não libera exercício.
12. Completar verificações de todos os seis locais e de desconexão/reinício antes da operação integrada. Nenhum teste da placa antiga substitui esses ensaios.
#pagebreak()
= 11 — Estados de controle e software
#table(columns:(10%,14%,14%,14%,48%),inset:4pt,text("Código"),text("GPIO25 A"),text("GPIO26 B"),text("GPIO27 C"),text("Resultado"),
text("0"),text("0"),text("0"),text("0"),text("Tudo aberto"),
text("1"),text("1"),text("0"),text("0"),text("SOURCE, somente com ALIVE e EDU_ON"),
text("2"),text("0"),text("1"),text("0"),text("SINK, somente com ALIVE e EDU_ON"),
text("4"),text("0"),text("0"),text("1"),text("Estímulo + retorno, somente com ALIVE e EDU_OFF_OK"),
text("3,5,6,7"),text("—"),text("—"),text("—"),text("Saídas utilizadas desabilitadas"))

ARM/GPIO13 mantém /CLR baixo no boot. Só liberar após configurar00 e validar comunicação; heartbeat GPIO14 com bordas a cada50ms apenas com autorização fresca. Antes de qualquer transição: código0 → esperar≥5ms → selecionar novo código. Alterar posição externa somente com saída aberta. A lógica seleciona uma função por vez, sem energizar SOURCE/SINK/DIAG simultaneamente em estado estável; firmware deve evitar glitches nas transições dos bits.

O buffer recebe entradas absolutas0…5,25V; leitura final é V(A)−V(B), com ganho/offset calibrados por canal, não subtração fixa de0,25V. Inicialmente esperar≥10ms após confirmação da seleção, depois adquirir/mediar sem mudar rota.

Na continuidade, P1=A recebe estímulo3,3V via diodo/11k; P2=B ganha retorno removível por PhotoMOS. Não deixar esse retorno fechado durante voltímetro/pulso. O estado código4 deve ser retirado antes de restaurar o exercício.

O sketch perfboard_stage1_test continua válido para telas, joystick e UART; ele NÃO implementa o protocolo/condicionamento/calibração e as proteções temporais desta extensão. Não habilitar saídas com firmware antigo de pinagem diferente. Esta entrega é o guia de fiação; firmware de integração e aceitação física permanecem tarefas separadas.
