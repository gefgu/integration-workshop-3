#set page(width:240mm,height:180mm,margin:9mm,footer:context [Placa inteligente simplificada + RC522 · 27/10/2026 · #counter(page).display()])
#set text(font:"DejaVu Sans",size:9pt)
= Guia de montagem e fiação — versão simplificada final
*Uma perfboard 30×45; montagem existente preservada; agora com RC522.* Este é o guia atual da placa inteligente. Substitui, neste escopo, o guia da placa complementar e o plano de 69 peças novas. Não instalar aqueles circuitos.

*Já soldado, conforme informado:* soquetes da ESP32, seis conectores OLED, joystick, UART, entrada de 3,3 V, link JP_EXT e capacitores. São 14 referências preservadas, além do módulo ESP32. Os 39 fios Sxx são conferência da montagem; não refazer conexões corretas.

*Acrescentar:* quatro resistores 10 kΩ, dois resistores 1 kΩ, dois capacitores 100 nF, conector J_ROUTER de 4 pinos e conector J_NFC de 7 pinos. São 10 peças na perfboard. O módulo RC522 fica externo, ligado por 7 jumpers, sem IRQ. Não há buffer, ADC externo, gerador 5 V ou circuito local de estímulo de continuidade.

*Funções e limites:* três peças inteligentes em seis posições completas; leitura de um par por vez; um comando de pulso ativo por vez. O roteador selecionaA/B, aplica e retira o estímulo de continuidade, e produz 5 V/0 V/desconexão no P3 autorizado. A placa inteligente recebeA/B e envia somente um sinal lógico 3,3 V no GPIO27.

*Status:* coordenadas, netlist, preservação dos fios e footprints são verificados em software. Corpos reais, soquetes, plugs, soldas, fonte e comunicação ainda exigem inspeção/ensaio. Fazer dry-fit das 10 peças novas antes de soldar.

*Limitação explícita do projeto simplificado:* divisor 10k/10k apresenta cerca de 20 kΩ à entrada e pode alterar o circuito medido. Não atende≥1MΩ do voltímetro do Notion, nem garante fuga≤10µA se houver tensão externa com a bancada desligada. Não aplicar tensão com receptor desenergizado. Esta versão é protótipo simplificado por decisão do usuário, não comprovação integral dos requisitos originais.
#pagebreak()
= 1 — Orientação, cores e sequência de trabalho
ColunasC1…C30: esquerda→direita na vista superior. LinhasR1…R45: cima→baixo. USB da ESP32 voltado paraR1. Na vista inferior, os números continuam sendo os da vista superior: não inverter os nomes dos pinos. Pin 1 recebe um círculo preto. Cada ilha da perfboard é isolada até receber um fio.

#table(columns:(36%,64%),inset:4pt,text("Cor"),text("Rede"),
text("Vermelho / preto"),text("Alimentação 3,3 V / GND"),
text("Azul / verde"),text("SCL compartilhado / SDAs das telas separados"),
text("Laranja / roxo"),text("TX33 / RX32 da UART"),
text("Rosa / verde-azulado"),text("Joystick X / Y"),
text("Azul / laranja / verde-azulado / roxo / marrom"),text("RC522 SCK / MOSI / MISO / SS / RST"),
text("Magenta"),text("PULSE_CMD: comando lógico 3,3 V para o roteador"))

Ordem sugerida: conferir partes existentes → posicionar 10 peças novas → soldar/conferir GND e 3,3 V → canaisA/B → cinco sinais SPI → comando de pulso → testar funções separadas. As páginas Sxx conferem fios existentes; Nxx acrescentam somente fios novos; E/T descrevem cabos externos. Cruzamento no desenho não é junção.
#pagebreak()
= 2 — Layout final: superior e inferior
#grid(columns:(1fr,1fr),image("assets/top.svg",width:105mm),image("assets/underside.svg",width:105mm))
#pagebreak()
= 3 — Peças novas: posicionar antes de soldar
#table(columns:(19%,15%,43%,23%),inset:4pt,text("Ref"),text("Peça"),text("Furos de cada terminal TOP"),text("Função"),
text("J_ROUTER"),text("4 pinos"),text("1=C2/R25 · 2=C3/R25 · 3=C4/R25 · 4=C5/R25"),text("ConectaA/B/GND/comando, sem 5 V"),
text("J_NFC"),text("7 pinos"),text("1=C21/R25 · 2=C22/R25 · 3=C23/R25 · 4=C24/R25 · 5=C25/R25 · 6=C26/R25 · 7=C27/R25"),text("Conecta o RC522 externo"),
text("R_A_TOP"),text("10k"),text("1=C3/R29 · 2=C3/R32"),text("Resistor superior do divisor"),
text("R_A_BOT"),text("10k"),text("1=C3/R34 · 2=C6/R34"),text("Resistor inferior até GND"),
text("R_A_ADC"),text("1k"),text("1=C3/R37 · 2=C6/R37"),text("Resistor série antes do ADC"),
text("C_A_ADC"),text("100 nF"),text("1=C6/R40 · 2=C7/R40"),text("Filtra o pino do ADC"),
text("R_B_TOP"),text("10k"),text("1=C11/R29 · 2=C11/R32"),text("Resistor superior do divisor"),
text("R_B_BOT"),text("10k"),text("1=C11/R34 · 2=C14/R34"),text("Resistor inferior até GND"),
text("R_B_ADC"),text("1k"),text("1=C11/R37 · 2=C14/R37"),text("Resistor série antes do ADC"),
text("C_B_ADC"),text("100 nF"),text("1=C14/R40 · 2=C15/R40"),text("Filtra o pino do ADC"))

Os resistores 10k/1k não têm polaridade. Capacitores 100 nF também não. Resistores axiais são previstos deitados,7,62mm entre terminais; capacitores têm 2,54mm propostos. Conferir peças reais sem forçar terminais. Não instalar pull-ups externos de tela. O RC522 precisa aceitar alimentação 3,3 V e ter sua pinagem conferida pelos nomes impressos.
#pagebreak()
= 4 — Pinagem completa da ESP32
#table(columns:(34%,16%,50%),inset:4pt,text("Função"),text("GPIO"),text("Ponto TOP do soquete"),
text("SCL telas"),text("22"),text("J_ESP_L.14 — C10/R18"),
text("SDA0"),text("4"),text("J_ESP_L.5 — C10/R9"),
text("SDA1"),text("21"),text("J_ESP_L.11 — C10/R15"),
text("SDA2"),text("19"),text("J_ESP_L.10 — C10/R14"),
text("SDA3"),text("18"),text("J_ESP_L.9 — C10/R13"),
text("SDA4"),text("17"),text("J_ESP_L.7 — C10/R11"),
text("SDA5"),text("16"),text("J_ESP_L.6 — C10/R10"),
text("Joystick X"),text("36/VP"),text("J_ESP_R.14 — C20/R18"),
text("Joystick Y"),text("39/VN"),text("J_ESP_R.13 — C20/R17"),
text("ADC A"),text("34"),text("J_ESP_R.12 — C20/R16"),
text("ADC B"),text("35"),text("J_ESP_R.11 — C20/R15"),
text("Pi RX"),text("32"),text("J_ESP_R.10 — C20/R14"),
text("Pi TX"),text("33"),text("J_ESP_R.9 — C20/R13"),
text("NFC SCK"),text("14"),text("J_ESP_R.5 — C20/R9"),
text("NFC MOSI"),text("23"),text("J_ESP_L.15 — C10/R19"),
text("NFC MISO"),text("13"),text("J_ESP_R.3 — C20/R7"),
text("NFC SS"),text("25"),text("J_ESP_R.8 — C20/R12"),
text("NFC RST"),text("26"),text("J_ESP_R.7 — C20/R11"),
text("Comando de pulso"),text("27"),text("J_ESP_R.6 — C20/R10"))

São números GPIO, não números físicos do DevKit. GPIO1/3 da programação e GPIO2/5/12/15 permanecem sem uso. Não copiar a pinagem de SPI/UART padrão: GPIO18/19 já são SDAs de telas; UART16/17 também conflita.
#pagebreak()
= Conferir: entrada e distribuição 3,3 V — bloco 1
#grid(columns:(86mm,1fr),gutter:5mm,image("assets/wire-01.svg",width:86mm),[
#table(columns:(27%,36.5%,36.5%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("S01\nV3V3_EXT"),text("J_POWER.1\nC25/R3"),text("JP_EXT.1\nC25/R6"),
text("S02\nV3V3_BOARD"),text("JP_EXT.2\nC26/R6"),text("C_BULK.1\nC26/R10"),
text("S03\nV3V3_BOARD"),text("C_BULK.1\nC26/R10"),text("C_LOCAL.1\nC24/R22"),
text("S04\nV3V3_BOARD"),text("C_LOCAL.1\nC24/R22"),text("J_ESP_L.1\nC10/R5"),
text("S05\nV3V3_BOARD"),text("J_ESP_L.1\nC10/R5"),text("J_JOY.1\nC24/R19"))

*S01:* Leva a fonte externa de 3,3 V até o link removível JP_EXT.

*S02:* Distribui os 3,3 V da placa. Não é 5 V e não passa pelo roteador.

*S03:* Distribui os 3,3 V da placa. Não é 5 V e não passa pelo roteador.

*S04:* Distribui os 3,3 V da placa. Não é 5 V e não passa pelo roteador.

*S05:* Distribui os 3,3 V da placa. Não é 5 V e não passa pelo roteador.

])

Manter alimentação desligada. Soldar fio isolado nos terminais indicados; conferir continuidade de ponta a ponta e ausência de ponte para a ilha vizinha. O traço mostra as pontas, não um percurso físico obrigatório.
#pagebreak()
= Conferir: entrada e distribuição 3,3 V — bloco 2
#grid(columns:(86mm,1fr),gutter:5mm,image("assets/wire-02.svg",width:86mm),[
#table(columns:(27%,36.5%,36.5%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("S06\nV3V3_BOARD"),text("J_JOY.1\nC24/R19"),text("J_OLED0.1\nC2/R4"),
text("S07\nV3V3_BOARD"),text("J_OLED0.1\nC2/R4"),text("J_OLED1.1\nC2/R7"),
text("S08\nV3V3_BOARD"),text("J_OLED1.1\nC2/R7"),text("J_OLED2.1\nC2/R10"),
text("S09\nV3V3_BOARD"),text("J_OLED2.1\nC2/R10"),text("J_OLED3.1\nC2/R13"),
text("S10\nV3V3_BOARD"),text("J_OLED3.1\nC2/R13"),text("J_OLED4.1\nC2/R16"))

*S06:* Distribui os 3,3 V da placa. Não é 5 V e não passa pelo roteador.

*S07:* Distribui os 3,3 V da placa. Não é 5 V e não passa pelo roteador.

*S08:* Distribui os 3,3 V da placa. Não é 5 V e não passa pelo roteador.

*S09:* Distribui os 3,3 V da placa. Não é 5 V e não passa pelo roteador.

*S10:* Distribui os 3,3 V da placa. Não é 5 V e não passa pelo roteador.

])

Manter alimentação desligada. Soldar fio isolado nos terminais indicados; conferir continuidade de ponta a ponta e ausência de ponte para a ilha vizinha. O traço mostra as pontas, não um percurso físico obrigatório.
#pagebreak()
= Conferir: entrada e distribuição 3,3 V — bloco 3
#grid(columns:(86mm,1fr),gutter:5mm,image("assets/wire-03.svg",width:86mm),[
#table(columns:(27%,36.5%,36.5%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("S11\nV3V3_BOARD"),text("J_OLED4.1\nC2/R16"),text("J_OLED5.1\nC2/R19"))

*S11:* Distribui os 3,3 V da placa. Não é 5 V e não passa pelo roteador.

])

Manter alimentação desligada. Soldar fio isolado nos terminais indicados; conferir continuidade de ponta a ponta e ausência de ponte para a ilha vizinha. O traço mostra as pontas, não um percurso físico obrigatório.
#pagebreak()
= Conferir: GND existente — bloco 1
#grid(columns:(86mm,1fr),gutter:5mm,image("assets/wire-04.svg",width:86mm),[
#table(columns:(27%,36.5%,36.5%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("S12\n GND"),text("J_POWER.2\nC26/R3"),text("C_BULK.2\nC27/R10"),
text("S13\n GND"),text("C_BULK.2\nC27/R10"),text("C_LOCAL.2\nC25/R22"),
text("S14\n GND"),text("C_LOCAL.2\nC25/R22"),text("J_ESP_L.2\nC10/R6"),
text("S15\n GND"),text("J_ESP_L.2\nC10/R6"),text("J_ESP_R.2\nC20/R6"),
text("S16\n GND"),text("J_ESP_R.2\nC20/R6"),text("J_UART.1\nC25/R14"))

*S12:* Une os retornos à mesma referência elétrica. Ilha isolada precisa desta ligação.

*S13:* Une os retornos à mesma referência elétrica. Ilha isolada precisa desta ligação.

*S14:* Une os retornos à mesma referência elétrica. Ilha isolada precisa desta ligação.

*S15:* Une os retornos à mesma referência elétrica. Ilha isolada precisa desta ligação.

*S16:* Une os retornos à mesma referência elétrica. Ilha isolada precisa desta ligação.

])

Manter alimentação desligada. Soldar fio isolado nos terminais indicados; conferir continuidade de ponta a ponta e ausência de ponte para a ilha vizinha. O traço mostra as pontas, não um percurso físico obrigatório.
#pagebreak()
= Conferir: GND existente — bloco 2
#grid(columns:(86mm,1fr),gutter:5mm,image("assets/wire-05.svg",width:86mm),[
#table(columns:(27%,36.5%,36.5%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("S17\n GND"),text("J_UART.1\nC25/R14"),text("J_JOY.2\nC25/R19"),
text("S18\n GND"),text("J_JOY.2\nC25/R19"),text("J_OLED0.2\nC3/R4"),
text("S19\n GND"),text("J_OLED0.2\nC3/R4"),text("J_OLED1.2\nC3/R7"),
text("S20\n GND"),text("J_OLED1.2\nC3/R7"),text("J_OLED2.2\nC3/R10"),
text("S21\n GND"),text("J_OLED2.2\nC3/R10"),text("J_OLED3.2\nC3/R13"))

*S17:* Une os retornos à mesma referência elétrica. Ilha isolada precisa desta ligação.

*S18:* Une os retornos à mesma referência elétrica. Ilha isolada precisa desta ligação.

*S19:* Une os retornos à mesma referência elétrica. Ilha isolada precisa desta ligação.

*S20:* Une os retornos à mesma referência elétrica. Ilha isolada precisa desta ligação.

*S21:* Une os retornos à mesma referência elétrica. Ilha isolada precisa desta ligação.

])

Manter alimentação desligada. Soldar fio isolado nos terminais indicados; conferir continuidade de ponta a ponta e ausência de ponte para a ilha vizinha. O traço mostra as pontas, não um percurso físico obrigatório.
#pagebreak()
= Conferir: GND existente — bloco 3
#grid(columns:(86mm,1fr),gutter:5mm,image("assets/wire-06.svg",width:86mm),[
#table(columns:(27%,36.5%,36.5%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("S22\n GND"),text("J_OLED3.2\nC3/R13"),text("J_OLED4.2\nC3/R16"),
text("S23\n GND"),text("J_OLED4.2\nC3/R16"),text("J_OLED5.2\nC3/R19"))

*S22:* Une os retornos à mesma referência elétrica. Ilha isolada precisa desta ligação.

*S23:* Une os retornos à mesma referência elétrica. Ilha isolada precisa desta ligação.

])

Manter alimentação desligada. Soldar fio isolado nos terminais indicados; conferir continuidade de ponta a ponta e ausência de ponte para a ilha vizinha. O traço mostra as pontas, não um percurso físico obrigatório.
#pagebreak()
= Conferir: clock e dados das telas — bloco 1
#grid(columns:(86mm,1fr),gutter:5mm,image("assets/wire-07.svg",width:86mm),[
#table(columns:(27%,36.5%,36.5%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("S24\n SCL"),text("J_ESP_L.14\nC10/R18"),text("J_OLED0.3\nC4/R4"),
text("S25\n SCL"),text("J_OLED0.3\nC4/R4"),text("J_OLED1.3\nC4/R7"),
text("S26\n SCL"),text("J_OLED1.3\nC4/R7"),text("J_OLED2.3\nC4/R10"),
text("S27\n SCL"),text("J_OLED2.3\nC4/R10"),text("J_OLED3.3\nC4/R13"),
text("S28\n SCL"),text("J_OLED3.3\nC4/R13"),text("J_OLED4.3\nC4/R16"))

*S24:* Leva o clock GPIO22 compartilhado entre as seis telas.

*S25:* Leva o clock GPIO22 compartilhado entre as seis telas.

*S26:* Leva o clock GPIO22 compartilhado entre as seis telas.

*S27:* Leva o clock GPIO22 compartilhado entre as seis telas.

*S28:* Leva o clock GPIO22 compartilhado entre as seis telas.

])

Manter alimentação desligada. Soldar fio isolado nos terminais indicados; conferir continuidade de ponta a ponta e ausência de ponte para a ilha vizinha. O traço mostra as pontas, não um percurso físico obrigatório.
#pagebreak()
= Conferir: clock e dados das telas — bloco 2
#grid(columns:(86mm,1fr),gutter:5mm,image("assets/wire-08.svg",width:86mm),[
#table(columns:(27%,36.5%,36.5%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("S29\n SCL"),text("J_OLED4.3\nC4/R16"),text("J_OLED5.3\nC4/R19"),
text("S30\n SDA_0"),text("J_ESP_L.5\nC10/R9"),text("J_OLED0.4\nC5/R4"),
text("S31\n SDA_1"),text("J_ESP_L.11\nC10/R15"),text("J_OLED1.4\nC5/R7"),
text("S32\n SDA_2"),text("J_ESP_L.10\nC10/R14"),text("J_OLED2.4\nC5/R10"),
text("S33\n SDA_3"),text("J_ESP_L.9\nC10/R13"),text("J_OLED3.4\nC5/R13"))

*S29:* Leva o clock GPIO22 compartilhado entre as seis telas.

*S30:* Dados I²C exclusivos da posição 0. Nunca unir aos outros SDAs.

*S31:* Dados I²C exclusivos da posição 1. Nunca unir aos outros SDAs.

*S32:* Dados I²C exclusivos da posição 2. Nunca unir aos outros SDAs.

*S33:* Dados I²C exclusivos da posição 3. Nunca unir aos outros SDAs.

])

Manter alimentação desligada. Soldar fio isolado nos terminais indicados; conferir continuidade de ponta a ponta e ausência de ponte para a ilha vizinha. O traço mostra as pontas, não um percurso físico obrigatório.
#pagebreak()
= Conferir: clock e dados das telas — bloco 3
#grid(columns:(86mm,1fr),gutter:5mm,image("assets/wire-09.svg",width:86mm),[
#table(columns:(27%,36.5%,36.5%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("S34\n SDA_4"),text("J_ESP_L.7\nC10/R11"),text("J_OLED4.4\nC5/R16"),
text("S35\n SDA_5"),text("J_ESP_L.6\nC10/R10"),text("J_OLED5.4\nC5/R19"))

*S34:* Dados I²C exclusivos da posição 4. Nunca unir aos outros SDAs.

*S35:* Dados I²C exclusivos da posição 5. Nunca unir aos outros SDAs.

])

Manter alimentação desligada. Soldar fio isolado nos terminais indicados; conferir continuidade de ponta a ponta e ausência de ponte para a ilha vizinha. O traço mostra as pontas, não um percurso físico obrigatório.
#pagebreak()
= Conferir: joystick e UART
#grid(columns:(86mm,1fr),gutter:5mm,image("assets/wire-10.svg",width:86mm),[
#table(columns:(27%,36.5%,36.5%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("S36\nJOY_X"),text("J_ESP_R.14\nC20/R18"),text("J_JOY.3\nC26/R19"),
text("S37\nJOY_Y"),text("J_ESP_R.13\nC20/R17"),text("J_JOY.4\nC27/R19"),
text("S38\n UART_TX"),text("J_ESP_R.9\nC20/R13"),text("J_UART.2\nC26/R14"),
text("S39\n UART_RX"),text("J_ESP_R.10\nC20/R14"),text("J_UART.3\nC27/R14"))

*S36:* Leva a tensão do eixo horizontal ao GPIO36/VP.

*S37:* Leva a tensão do eixo vertical ao GPIO39/VN.

*S38:* Leva dados transmitidos pela ESP32/GPIO33 ao conector do Pi.

*S39:* Leva os dados recebidos do Pi ao GPIO32.

])

Manter alimentação desligada. Soldar fio isolado nos terminais indicados; conferir continuidade de ponta a ponta e ausência de ponte para a ilha vizinha. O traço mostra as pontas, não um percurso físico obrigatório.
#pagebreak()
= Acrescentar: alimentação e GND novos — bloco 1
#grid(columns:(86mm,1fr),gutter:5mm,image("assets/wire-11.svg",width:86mm),[
#table(columns:(27%,36.5%,36.5%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("N01\nV3V3_BOARD"),text("J_ESP_L.1\nC10/R5"),text("J_NFC.1\nC21/R25"),
text("N02\n GND"),text("J_ESP_L.2\nC10/R6"),text("J_ROUTER.2\nC3/R25"),
text("N03\n GND"),text("J_ROUTER.2\nC3/R25"),text("J_NFC.2\nC22/R25"),
text("N04\n GND"),text("J_NFC.2\nC22/R25"),text("R_A_BOT.2\nC6/R34"),
text("N05\n GND"),text("R_A_BOT.2\nC6/R34"),text("C_A_ADC.2\nC7/R40"))

*N01:* Distribui os 3,3 V da placa. Não é 5 V e não passa pelo roteador.

*N02:* Une os retornos à mesma referência elétrica. Ilha isolada precisa desta ligação.

*N03:* Une os retornos à mesma referência elétrica. Ilha isolada precisa desta ligação.

*N04:* Une os retornos à mesma referência elétrica. Ilha isolada precisa desta ligação.

*N05:* Une os retornos à mesma referência elétrica. Ilha isolada precisa desta ligação.

])

Manter alimentação desligada. Soldar fio isolado nos terminais indicados; conferir continuidade de ponta a ponta e ausência de ponte para a ilha vizinha. O traço mostra as pontas, não um percurso físico obrigatório.
#pagebreak()
= Acrescentar: alimentação e GND novos — bloco 2
#grid(columns:(86mm,1fr),gutter:5mm,image("assets/wire-12.svg",width:86mm),[
#table(columns:(27%,36.5%,36.5%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("N06\n GND"),text("C_A_ADC.2\nC7/R40"),text("R_B_BOT.2\nC14/R34"),
text("N07\n GND"),text("R_B_BOT.2\nC14/R34"),text("C_B_ADC.2\nC15/R40"))

*N06:* Une os retornos à mesma referência elétrica. Ilha isolada precisa desta ligação.

*N07:* Une os retornos à mesma referência elétrica. Ilha isolada precisa desta ligação.

])

Manter alimentação desligada. Soldar fio isolado nos terminais indicados; conferir continuidade de ponta a ponta e ausência de ponte para a ilha vizinha. O traço mostra as pontas, não um percurso físico obrigatório.
#pagebreak()
= Acrescentar: medição canal A
#grid(columns:(86mm,1fr),gutter:5mm,image("assets/wire-13.svg",width:86mm),[
#table(columns:(27%,36.5%,36.5%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("N16\n ADC_A"),text("J_ESP_R.12\nC20/R16"),text("R_A_ADC.2\nC6/R37"),
text("N17\n ADC_A"),text("R_A_ADC.2\nC6/R37"),text("C_A_ADC.1\nC6/R40"),
text("N18\nSENSE_A"),text("J_ROUTER.1\nC2/R25"),text("R_A_TOP.1\nC3/R29"),
text("N20\nDIV_A"),text("R_A_TOP.2\nC3/R32"),text("R_A_BOT.1\nC3/R34"),
text("N21\nDIV_A"),text("R_A_BOT.1\nC3/R34"),text("R_A_ADC.1\nC3/R37"))

*N16:* Tensão condicionada do canal A → GPIO34; capacitor 100 nF filtra esta entrada.

*N17:* Tensão condicionada do canal A → GPIO34; capacitor 100 nF filtra esta entrada.

*N18:* Entrada bruta A → resistor superior 10k. O roteador seleciona o ponto A.

*N20:* Junção do divisor A: metade nominal da tensão de entrada, antes do resistor 1k.

*N21:* Junção do divisor A: metade nominal da tensão de entrada, antes do resistor 1k.

])

Manter alimentação desligada. Soldar fio isolado nos terminais indicados; conferir continuidade de ponta a ponta e ausência de ponte para a ilha vizinha. O traço mostra as pontas, não um percurso físico obrigatório.
#pagebreak()
= Acrescentar: medição canal B
#grid(columns:(86mm,1fr),gutter:5mm,image("assets/wire-14.svg",width:86mm),[
#table(columns:(27%,36.5%,36.5%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("N14\n ADC_B"),text("J_ESP_R.11\nC20/R15"),text("R_B_ADC.2\nC14/R37"),
text("N15\n ADC_B"),text("R_B_ADC.2\nC14/R37"),text("C_B_ADC.1\nC14/R40"),
text("N19\nSENSE_B"),text("J_ROUTER.3\nC4/R25"),text("R_B_TOP.1\nC11/R29"),
text("N22\nDIV_B"),text("R_B_TOP.2\nC11/R32"),text("R_B_BOT.1\nC11/R34"),
text("N23\nDIV_B"),text("R_B_BOT.1\nC11/R34"),text("R_B_ADC.1\nC11/R37"))

*N14:* Tensão condicionada do canal B → GPIO35; capacitor 100 nF filtra esta entrada.

*N15:* Tensão condicionada do canal B → GPIO35; capacitor 100 nF filtra esta entrada.

*N19:* Entrada bruta B → resistor superior 10k. O roteador seleciona o ponto B.

*N22:* Junção do divisor B: metade nominal da tensão de entrada, antes do resistor 1k.

*N23:* Junção do divisor B: metade nominal da tensão de entrada, antes do resistor 1k.

])

Manter alimentação desligada. Soldar fio isolado nos terminais indicados; conferir continuidade de ponta a ponta e ausência de ponte para a ilha vizinha. O traço mostra as pontas, não um percurso físico obrigatório.
#pagebreak()
= Acrescentar: SPI do RC522
#grid(columns:(86mm,1fr),gutter:5mm,image("assets/wire-15.svg",width:86mm),[
#table(columns:(27%,36.5%,36.5%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("N08\nNFC_MOSI"),text("J_ESP_L.15\nC10/R19"),text("J_NFC.4\nC24/R25"),
text("N09\nNFC_MISO"),text("J_ESP_R.3\nC20/R7"),text("J_NFC.5\nC25/R25"),
text("N10\nNFC_SCK"),text("J_ESP_R.5\nC20/R9"),text("J_NFC.3\nC23/R25"),
text("N12\nNFC_RST"),text("J_ESP_R.7\nC20/R11"),text("J_NFC.7\nC27/R25"),
text("N13\nNFC_SS"),text("J_ESP_R.8\nC20/R12"),text("J_NFC.6\nC26/R25"))

*N08:* Dados SPI enviados pela ESP32: GPIO23 → MOSI do leitor.

*N09:* Dados SPI recebidos: MISO do leitor → GPIO13.

*N10:* Clock SPI do RC522: GPIO14 → SCK do leitor.

*N12:* Reset do RC522 comandado pelo GPIO26.

*N13:* Seleção do RC522: GPIO25 → SDA/SS do leitor; não é SDA de I²C.

])

Manter alimentação desligada. Soldar fio isolado nos terminais indicados; conferir continuidade de ponta a ponta e ausência de ponte para a ilha vizinha. O traço mostra as pontas, não um percurso físico obrigatório.
#pagebreak()
= Acrescentar: comando de pulso
#grid(columns:(86mm,1fr),gutter:5mm,image("assets/wire-16.svg",width:86mm),[
#table(columns:(27%,36.5%,36.5%),inset:4pt,text("Fio / rede"),text("Origem"),text("Destino"),
text("N11\nPULSE_CMD"),text("J_ESP_R.6\nC20/R10"),text("J_ROUTER.4\nC5/R25"))

*N11:* Comando de pulso GPIO27 → receptor lógico 3,3 V do roteador. Não fornece 5 V.

])

Manter alimentação desligada. Soldar fio isolado nos terminais indicados; conferir continuidade de ponta a ponta e ausência de ponte para a ilha vizinha. O traço mostra as pontas, não um percurso físico obrigatório.
#pagebreak()
= 5 — Cabos externos: seis telas
== Posição 0 — J_OLED0, linhaR4
#table(columns:(14%,24%,24%,38%),inset:4pt,text("Fio externo"),text("Origem na placa"),text("Destino no OLED"),text("O que transporta"),
text("T0 V"),text("C2/R4"),text("VCC/3V3"),text("Alimentação 3,3 V"),
text("T0G"),text("C3/R4"),text("GND"),text("Retorno comum"),
text("T0C"),text("C4/R4"),text("SCL"),text("Clock comum GPIO22"),
text("T0D"),text("C5/R4"),text("SDA"),text("Dados exclusivos SDA0"))
== Posição 1 — J_OLED1, linhaR7
#table(columns:(14%,24%,24%,38%),inset:4pt,text("Fio externo"),text("Origem na placa"),text("Destino no OLED"),text("O que transporta"),
text("T1V"),text("C2/R7"),text("VCC/3V3"),text("Alimentação 3,3 V"),
text("T1G"),text("C3/R7"),text("GND"),text("Retorno comum"),
text("T1C"),text("C4/R7"),text("SCL"),text("Clock comum GPIO22"),
text("T1D"),text("C5/R7"),text("SDA"),text("Dados exclusivos SDA1"))
== Posição 2 — J_OLED2, linhaR10
#table(columns:(14%,24%,24%,38%),inset:4pt,text("Fio externo"),text("Origem na placa"),text("Destino no OLED"),text("O que transporta"),
text("T2V"),text("C2/R10"),text("VCC/3V3"),text("Alimentação 3,3 V"),
text("T2G"),text("C3/R10"),text("GND"),text("Retorno comum"),
text("T2C"),text("C4/R10"),text("SCL"),text("Clock comum GPIO22"),
text("T2D"),text("C5/R10"),text("SDA"),text("Dados exclusivos SDA2"))
#pagebreak()
= 5 — Cabos externos: telas das posições 3–5
== Posição 3 — J_OLED3, linhaR13
#table(columns:(14%,24%,24%,38%),inset:4pt,text("Fio externo"),text("Origem na placa"),text("Destino no OLED"),text("O que transporta"),
text("T3V"),text("C2/R13"),text("VCC/3V3"),text("Alimentação 3,3 V"),
text("T3G"),text("C3/R13"),text("GND"),text("Retorno comum"),
text("T3C"),text("C4/R13"),text("SCL"),text("Clock comum GPIO22"),
text("T3D"),text("C5/R13"),text("SDA"),text("Dados exclusivos SDA3"))
== Posição 4 — J_OLED4, linhaR16
#table(columns:(14%,24%,24%,38%),inset:4pt,text("Fio externo"),text("Origem na placa"),text("Destino no OLED"),text("O que transporta"),
text("T4V"),text("C2/R16"),text("VCC/3V3"),text("Alimentação 3,3 V"),
text("T4G"),text("C3/R16"),text("GND"),text("Retorno comum"),
text("T4C"),text("C4/R16"),text("SCL"),text("Clock comum GPIO22"),
text("T4D"),text("C5/R16"),text("SDA"),text("Dados exclusivos SDA4"))
== Posição 5 — J_OLED5, linhaR19
#table(columns:(14%,24%,24%,38%),inset:4pt,text("Fio externo"),text("Origem na placa"),text("Destino no OLED"),text("O que transporta"),
text("T5 V"),text("C2/R19"),text("VCC/3V3"),text("Alimentação 3,3 V"),
text("T5G"),text("C3/R19"),text("GND"),text("Retorno comum"),
text("T5C"),text("C4/R19"),text("SCL"),text("Clock comum GPIO22"),
text("T5D"),text("C5/R19"),text("SDA"),text("Dados exclusivos SDA5"))

As seis posições usam módulos intercambiáveis, até três ativos. Seguir os nomes do módulo: não presumir que sua ordem física seja 3V3/GND/SCL/SDA. A alimentação de todas as telas conectadas conta no consumo, mesmo quando não estão sendo atualizadas.
#pagebreak()
= 6 — Cabo externo do RC522: sete jumpers
#table(columns:(9%,25%,22%,44%),inset:4pt,text("Fio"),text("J_NFC / TOP"),text("Nome no RC522"),text("Função e sentido"),
text("E01"),text("1 C21/R25"),text("3.3V"),text("Alimenta o módulo com 3,3 V"),
text("E02"),text("2 C22/R25"),text("GND"),text("Referência comum"),
text("E03"),text("3 C23/R25"),text("SCK"),text("GPIO14 → clock do módulo"),
text("E04"),text("4 C24/R25"),text("MOSI"),text("GPIO23 → dados para o módulo"),
text("E05"),text("5 C25/R25"),text("MISO"),text("Dados do módulo → GPIO13"),
text("E06"),text("6 C26/R25"),text("SDA/SS"),text("GPIO25 → seleção SPI; não é I²C"),
text("E07"),text("7 C27/R25"),text("RST"),text("GPIO26 → reset do módulo"))

IRQ fica desconectado. Não colocar 5 V em VCC ou nos sinais do RC522. Usar sete jumpers identificados nas duas pontas; a ordem do cabeçalho no módulo pode ser diferente. Manter o módulo externo: não há furação ou suporte de fixação liberado neste guia. A antena precisa de espaço e deve ser testada na montagem real.

*Software:* inicializar SPI com SCK14/MISO13/MOSI23/SS25 e reset 26. Não usar simplesmente a pinagem SPI padrão, que conflita com as telas. Ler cartão/chaveiro e transmitir identificação ao Pi; NFC sozinho não autoriza energia no circuito didático.
#pagebreak()
= 7 — Cabos externos: joystick, Pi e alimentação
#table(columns:(9%,27%,29%,35%),inset:4pt,text("Fio"),text("Ponto na placa"),text("Destino"),text("Função"),
text("E08"),text("J_JOY.1 C24/R19"),text("Joystick VCC"),text("3,3 V"),
text("E09"),text("J_JOY.2 C25/R19"),text("Joystick GND"),text("Referência"),
text("E10"),text("J_JOY.3 C26/R19"),text("Joystick VRx"),text("Eixo X → GPIO36"),
text("E11"),text("J_JOY.4 C27/R19"),text("Joystick VRy"),text("Eixo Y → GPIO39"),
text("E12"),text("J_UART.1 C25/R14"),text("Pi pino físico 6"),text("GND comum"),
text("E13"),text("J_UART.2 C26/R14"),text("Pi pino físico 10/RX"),text("GPIO33 transmite ao Pi"),
text("E14"),text("J_UART.3 C27/R14"),text("Pi pino físico 8/TX"),text("GPIO32 recebe do Pi"),
text("E15"),text("J_POWER.1 C25/R3"),text("Saída regulada 3,3 V"),text("Entrada externa da placa"),
text("E16"),text("J_POWER.2 C26/R3"),text("GND da fonte"),text("Retorno de alimentação"))

Não conectar SW do joystick. Não ligar alimentação positiva do Pi a esta placa. Pi e ESP32 devem estar alimentados quando trocam sinais; desligar antes de alterar os cabos. Não escolher pino físico pela posição na foto sem conferir numeração.

JP_EXT é um shunt removível entre C25/R6 e C26/R6. Na operação externa: USB desconectado e shunt instalado. Na programação/teste USB: fonte externa 3,3 V fisicamente desconectada e shunt removido. Desconectar sinais externos que possam alimentar a placa quando ela estiver desligada. Não colocar 5 V no pino 3V3.

C_BULK: positivo C26/R10, negativo C27/R10. Valor nominal 47 µF; a foto sugeria 100 µF/10 V, conferir e registrar sem trocar automaticamente. C_LOCAL100 nF em C24–25/R22. Capacitores não são reguladores.
#pagebreak()
= 8 — Cabo externo do roteador: quatro fios
#table(columns:(9%,28%,31%,32%),inset:4pt,text("Fio"),text("J_ROUTER / TOP"),text("Ligação externa necessária"),text("O que faz"),
text("E17"),text("1 C2/R25 — A_RAW"),text("Saída analógica A selecionada"),text("Traz o primeiro nó; absoluto 0…5,25 V"),
text("E18"),text("2 C3/R25 — GND"),text("GND comum"),text("Referência para sinais analógicos e comando"),
text("E19"),text("3 C4/R25 — B_RAW"),text("Saída analógica B selecionada"),text("Traz o segundo nó; absoluto 0…5,25 V"),
text("E20"),text("4 C5/R25 — PULSE_CMD"),text("Entrada lógica compatível 3,3 V"),text("Envia a temporização do GPIO27; não envia 5 V"))

*Voltímetro:* o roteador selecionaP1/P2 da posição inteligente. O software aguarda confirmação da seleção e estabilização, lê GPIO34/35 e calculaV(A)−V(B) com calibração. A e B não são unidos por este cabo.

*Continuidade:* o roteador confirma circuito desenergizado, prepara um par e aplica estímulo limitado/retorno; a placa inteligente medeA/B e informa o resultado. Após o teste, o roteador retira estímulo e retorno antes de rodar. Não existe resistor de estímulo, chave de retorno ou gerador de teste nesta perfboard. A solicitação/estado do precheck passa pela comunicação existente com o Pi, sem GPIO extra.

*Pulso:* GPIO27 é a forma de onda de comando. Com o modo autorizado, alto pede nível alto e baixo pede nível baixo no P3 escolhido. Fora do modo autorizado, o roteador deve desconectar ambos os caminhos. Apenas soltar 5 V não garante 0 V; P3 pode ficar flutuando. A condição desabilitada deve ser definida pelo protocolo/controle externo, pois um único fio de dados não codifica sozinho alto, baixo e desconectado.

Este guia define os sinais, mas não atribui pinos internos do roteador. Não ligarPULSE_CMD diretamente à linha 5 V,12V ou a uma carga. O receptor deve aceitar lógica 3,3 V e ter estado seguro se o cabo for removido. A limitação de corrente e os níveis reais de saída são responsabilidades do estágio externo, ainda sujeitos a ensaio.
#pagebreak()
= 9 — Como testar a montagem por etapas
1. Com tudo desligado, conferir os 39 fios Sxx, pinagem da ESP32 e as 10 posições verdes. Remover ESP32 dos soquetes antes de soldar nos seus terminais. Não mover a montagem cinza.
2. Soldar/conferir os fios de alimentação e GND novos. Medir continuidade e ausência de curto entre 3,3 V/GND e ilhas vizinhas. Um capacitor pode dar indicação transitória; investigar curto persistente.
3. Conferir os quatro 10k, dois 1k e dois 100 nF antes de ligarA/B. Usar fonte conhecida limitada e multímetro: testar 0,1,2,5 e até 5,25 V em cada entrada. Conferir tensão ADC nominalmente pela metade; trocarA/B e comparar sinal/calibração. Nunca aplicar negativo absoluto ou 5 V direto ao GPIO34/35.
4. Testar cada tela isolada em 100kHz, depois até três ativas. Confirmar que somente a posição selecionada atualiza; medir/qualificar a combinação de pull-ups internos de SCL. Não adicionar pull-ups externos por padrão.
5. Testar joystick no centro e quatro direções. O clique não está conectado.
6. Conectar RC522 com tudo desligado. Confirmar 3,3 V, SS eRST; testar leitura de cartão/chaveiro conhecido e caso sem tag. Rodar telas+NFC juntos para verificar ausência de conflito de pinos e queda de alimentação.
7. Testar UART32/33 com o Pi em 115200 8N1. O teste antigo RX16/TX17 não corresponde a esta placa.
8. Antes de conectarPULSE_CMD ao roteador, testar GPIO27 com instrumento ou receptor 3,3 V apropriado; não usar LED sem resistor. Confirmar 0,5–10 Hz, duty inicial 50% e, quando implementado, faixa 25–75%. Isso só verifica o comando; medir o sinal finalP3 e a proteção no estágio externo depois.
9. Integrar o precheck com curto/resistor conhecido/aberto, registrando a influência da matriz e dos divisores 20k. LED/capacitor/resistor não equivalem a fio. Resultados instáveis ou incertos não liberam o exercício.
#pagebreak()
= 10 — Registro, firmware e limites de aceitação
*Preservação:* o gerador compara os furos existentes com o modelo-base e mantém os 39 fios Sxx. Os 62 fios internos totais correspondem a 39 existentes e 23 novos; a lista Nxx não acrescenta circuitos de proteção de 60 peças.

*Firmware:* o sketch perfboard_stage 1_test cobre telas/joystick/UART. Ele não testa automaticamente o RC522, não implementa o protocolo do pulso nem a calibração dos dois canais desta versão. Usar a pinagem completa deste guia na integração. O teste antigo de ADC no GPIO4 conflita com SDA0; o antigo teste de continuidade no GPIO27 não deve ser usado com o comando de pulso conectado.

*Precisão:* converterVbruto≈2×Vadc não elimina erro do ADC, tolerância dos resistores ou carregamento. Exemplo: um divisor didático 10k/10k a 5 V produziria 2,5 V, mas a carga adicional de 20k desta entrada reduz para aproximadamente 2,0 V. Não declarar conformidade≥1MΩ nem continuidade≤20Ω/≥100Ω sem circuito/medição de incerteza adequados.

*Condição física:* conferir alimentação sob carga, ruído e tempo de estabilização após seleção. Durante diagnóstico, garantir que o circuito esteja sem energia e capacitores descarregados conforme procedimento externo. Não aplicar sinais a placas desenergizadas nem fazer hot-plug dos módulos.

*Preencher após bancada:* valor/polaridade C_BULK: __________  tensão 3,3 V sem/com carga: __________  canaisA/B calibrados: __________  telas 0…5: __________  joystick: __________  RC522: __________  UART: __________  comando de pulso: __________  responsável/data: __________

Documentos anteriores com placa complementar, reguladores locais, buffers ou 69 peças novas ficam como histórico. Este guia é a referência atual para a montagem simplificada em uma única placa; a aceitação física continua dependente dos testes registrados.
