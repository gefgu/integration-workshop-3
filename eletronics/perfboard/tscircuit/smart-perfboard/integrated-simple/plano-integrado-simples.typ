#set page(width:240mm,height:180mm,margin:9mm,footer:context [Reorganização na mesma placa · 27/10/2026 · #counter(page).display()])
#set text(font:"DejaVu Sans",size:9pt)
= Placa inteligente — plano integrado simplificado
*Uma única perfboard30×45. Nenhuma posição já soldada é alterada.* Reorganização para revisão e dry-fit; o projeto interno do roteador não faz parte desta entrega.

A área cinza do desenho é a montagem informada como concluída pelo usuário. Verde: dois canais simples de medição. Laranja: proposta para pulso, continuidade e habilitação.

*Simplificação solicitada:* cada entrada usa10kΩ/10kΩ, resistor série1kΩ e capacitor100nF no ADC. São oito peças, sem buffer e sem ADC externo. Somado ao conector de sinais, o primeiro acréscimo tem9 peças.

*Transparência sobre o restante:* a versão completa ainda propõe60 peças adicionais para pulso/diagnóstico/proteção,69 novas no total. Trocar o divisor não elimina o limitador da saída, as chaves de isolamento e o controle de habilitação. Essas60 peças são uma etapa posterior, não instrução para soldar tudo agora.

*Como a proposta ocupa menos espaço:* resistores novos em pé, com terminais em dois furos adjacentes e a perna de retorno isolada. Confirmar diâmetro, altura e folga dos corpos, soquetes, plugs e fios. O modelo passa na grade nominal; não é medição de encaixe nem liberação para soldagem. Não comprimir componentes para fazer caber.

*Limitação aceita nesta revisão:* cada entrada carrega o ponto medido com aproximadamente20kΩ até GND. Não atende ao voltímetro de≥1MΩ do Notion. Sob tensão externa quando a bancada está desligada, essa ligação também não garante alta impedância/fuga≤10µA. Usar como protótipo supervisionado, entradas0…5,25V apenas com receptor alimentado e cabos desligados antes de programar/desenergizar. Não apresentar a revisão simplificada como conformidade integral.
#pagebreak()
= 1 — Todas as posições: soldadas e propostas
#grid(columns:(1fr,1fr),image("assets/top-review.svg",width:105mm),image("assets/underside-review.svg",width:105mm))
#pagebreak()
= 2 — Primeiro acréscimo: medição simples
#table(columns:(6%,21%,18%,55%),inset:4pt,text("#"),text("Peça nova"),text("Valor"),text("Terminais TOP"),
text("1"),text("J_SIGNALS"),text("7 pins"),text("1:C12/R33 · 2:C13/R33 · 3:C14/R33 · 4:C15/R33 · 5:C16/R33 · 6:C17/R33 · 7:C18/R33"),
text("62"),text("R_A_TOP"),text("10k"),text("1:C2/R2 · 2:C3/R2"),
text("63"),text("R_A_BOT"),text("10k"),text("1:C5/R2 · 2:C6/R2"),
text("64"),text("R_A_ADC"),text("1k"),text("1:C28/R2 · 2:C29/R2"),
text("65"),text("C_A_ADC"),text("100nF"),text("1:C2/R36 · 2:C3/R36"),
text("66"),text("R_B_TOP"),text("10k"),text("1:C28/R4 · 2:C29/R4"),
text("67"),text("R_B_BOT"),text("10k"),text("1:C29/R6 · 2:C28/R6"),
text("68"),text("R_B_ADC"),text("1k"),text("1:C29/R13 · 2:C30/R13"),
text("69"),text("C_B_ADC"),text("100nF"),text("1:C6/R37 · 2:C7/R37"))

Por canal: sinal bruto →10k→junção→1k→ADC. Junção→10k→GND; ADC→100nF→GND. CanalA chega ao GPIO34, canalB ao GPIO35. Nominalmente Vbruto≈2×Vadc; leitura diferencial≈2×(ADC_A−ADC_B), após calibração por canal. Não unir A com B.

No J_SIGNALS, inicialmente ligar somente1=A,2=GND,3=B e5=GND. Deixar4=PULSE,6=EDU_ON e7=OFF_OK sem fios externos nesta etapa. Não instalar J_AUX_PWR nem conectar5V por enquanto.
#pagebreak()
= 3 — Fios somente da etapa de medição
#table(columns:(8%,16%,38%,38%),inset:4pt,text("Fio"),text("Rede"),text("Origem"),text("Destino"),
text("M01"),text("SENSE_A"),text("J_SIGNALS.1 C12/R33"),text("R_A_TOP.1 C2/R2"),
text("M02"),text("GND"),text("J_ESP_L.2 C10/R6"),text("J_SIGNALS.2 C13/R33"),
text("M03"),text("GND"),text("J_SIGNALS.2 C13/R33"),text("J_SIGNALS.5 C16/R33"),
text("M04"),text("GND"),text("J_SIGNALS.5 C16/R33"),text("R_A_BOT.2 C6/R2"),
text("M05"),text("GND"),text("R_A_BOT.2 C6/R2"),text("C_A_ADC.2 C3/R36"),
text("M06"),text("GND"),text("C_A_ADC.2 C3/R36"),text("R_B_BOT.2 C28/R6"),
text("M07"),text("GND"),text("R_B_BOT.2 C28/R6"),text("C_B_ADC.2 C7/R37"),
text("M08"),text("SENSE_B"),text("J_SIGNALS.3 C14/R33"),text("R_B_TOP.1 C28/R4"),
text("M09"),text("DIV_A"),text("R_A_TOP.2 C3/R2"),text("R_A_BOT.1 C5/R2"),
text("M10"),text("DIV_A"),text("R_A_BOT.1 C5/R2"),text("R_A_ADC.1 C28/R2"),
text("M11"),text("ADC_A"),text("J_ESP_R.12 C20/R16"),text("R_A_ADC.2 C29/R2"),
text("M12"),text("ADC_A"),text("R_A_ADC.2 C29/R2"),text("C_A_ADC.1 C2/R36"),
text("M13"),text("DIV_B"),text("R_B_TOP.2 C29/R4"),text("R_B_BOT.1 C29/R6"),
text("M14"),text("DIV_B"),text("R_B_BOT.1 C29/R6"),text("R_B_ADC.1 C29/R13"),
text("M15"),text("ADC_B"),text("J_ESP_R.11 C20/R15"),text("R_B_ADC.2 C30/R13"),
text("M16"),text("ADC_B"),text("R_B_ADC.2 C30/R13"),text("C_B_ADC.1 C6/R37"))

Esta lista Mxx é independente: não usa nenhum componente laranja como ponto intermediário de GND. A lista Nxxx descreve a proposta completa e não deve ser misturada com Mxx. Os39 fios Sxx já soldados permanecem. Antes de iniciar uma etapa posterior, conciliar as conexões de GND já instaladas; não duplicar automaticamente as duas listas.
#pagebreak()
= 4 — O que fica para as etapas seguintes
#table(columns:(20%,13%,67%),inset:4pt,text("Bloco"),text("Peças novas"),text("Função"),
text("Interfaces"),text("2"),text("Entrada5V e cabo externo; sem circuito interno do roteador"),
text("Voltage"),text("8"),text("Dois divisores10k/10k e filtros ADC"),
text("Watchdog"),text("11"),text("Liberação e expiração do heartbeat; entradas com estado definido"),
text("Mode"),text("4"),text("Uma função ativa: alta, baixa ou diagnóstico"),
text("Limits"),text("22"),text("Limitação analógica de corrente SOURCE/SINK; MCP6002 aqui é do pulso, não da medição"),
text("Pulse"),text("10"),text("Chaves PhotoMOS que ligam fonte/retorno ao único PULSE_OUT"),
text("Diagnostic"),text("12"),text("Estímulo limitado e retorno removível durante o precheck"))

*Plano de montagem:* A) conferir preservação dos soquetes/ESP32, telas, joystick, UART, alimentação e capacitores. B) dry-fit do conjunto para confirmar a reserva de espaço. C) soldar somente as9 peças verdes e os fios Mxx; comparar tensões com multímetro. D) revisar as peças laranja com o montador antes de compra/solda. E) montar/testar habilitação e saída protegida, depois estímulo/retorno; só integrar após qualificar os estados de falha e os sinais externos.

Não simplificar a saída de5V ligando GPIO diretamente ao P3. O divisor de tensão protege a faixa de leitura do ADC, mas não limita a corrente que um gerador pode entregar ao aluno.
#pagebreak()
= 5 — Todas as peças ainda não soldadas: restante 1–15
#table(columns:(9%,24%,29%,16%,22%),inset:4pt,text("# no desenho"),text("Ref"),text("Valor / peça"),text("Bloco"),text("Furos extremos"),
text("2"),text("J_AUX_PWR"),text("4 pins"),text("Interfaces"),text("1:C2/R34; 4:C5/R34"),
text("3"),text("U_WATCH"),text("CD74HC123E"),text("Watchdog"),text("1:C2/R25; 16:C5/R25"),
text("4"),text("R_WATCH"),text("680k"),text("Watchdog"),text("1:C22/R38; 2:C23/R38"),
text("5"),text("C_WATCH"),text("1uF"),text("Watchdog"),text("1:C27/R25; 2:C28/R25"),
text("6"),text("C_WATCH_VCC"),text("100nF"),text("Watchdog"),text("1:C27/R28; 2:C28/R28"),
text("7"),text("R_PD_ARM"),text("100k"),text("Watchdog"),text("1:C25/R38; 2:C26/R38"),
text("8"),text("R_PD_HB"),text("100k"),text("Watchdog"),text("1:C28/R38; 2:C29/R38"),
text("9"),text("R_PD_MODE_A"),text("100k"),text("Watchdog"),text("1:C6/R39; 2:C7/R39"),
text("10"),text("R_PD_MODE_B"),text("100k"),text("Watchdog"),text("1:C9/R39; 2:C10/R39"),
text("11"),text("R_PD_MODE_C"),text("100k"),text("Watchdog"),text("1:C12/R39; 2:C13/R39"),
text("12"),text("R_PD_EDU_ON"),text("100k"),text("Watchdog"),text("1:C2/R40; 2:C3/R40"),
text("13"),text("R_PD_EDU_OFF_OK"),text("100k"),text("Watchdog"),text("1:C16/R40; 2:C15/R40"),
text("14"),text("U_MODE"),text("CD74HC238E"),text("Mode"),text("1:C7/R25; 16:C10/R25"),
text("15"),text("C_MODE"),text("100nF"),text("Mode"),text("1:C27/R31; 2:C28/R31"),
text("16"),text("U_GATE"),text("CD74HC08E"),text("Mode"),text("1:C12/R25; 14:C15/R25"))
#pagebreak()
= 5 — Todas as peças ainda não soldadas: restante 16–30
#table(columns:(9%,24%,29%,16%,22%),inset:4pt,text("# no desenho"),text("Ref"),text("Valor / peça"),text("Bloco"),text("Furos extremos"),
text("17"),text("C_GATE"),text("100nF"),text("Mode"),text("1:C7/R34; 2:C8/R34"),
text("18"),text("R_REF_H_TOP"),text("1k"),text("Limits"),text("1:C18/R40; 2:C19/R40"),
text("19"),text("R_REF_H_BOT"),text("49.9k"),text("Limits"),text("1:C21/R40; 2:C22/R40"),
text("20"),text("R_REF_L_TOP"),text("49.9k"),text("Limits"),text("1:C24/R40; 2:C25/R40"),
text("21"),text("R_REF_L_BOT"),text("1k"),text("Limits"),text("1:C27/R40; 2:C28/R40"),
text("22"),text("C_REF_H"),text("100nF"),text("Limits"),text("1:C20/R34; 2:C21/R34"),
text("23"),text("C_REF_L"),text("100nF"),text("Limits"),text("1:C24/R34; 2:C25/R34"),
text("24"),text("R_H_SENSE"),text("10"),text("Limits"),text("1:C5/R41; 2:C6/R41"),
text("25"),text("R_L_SENSE"),text("10"),text("Limits"),text("1:C8/R41; 2:C9/R41"),
text("26"),text("R_IN_H_N"),text("47k"),text("Limits"),text("1:C11/R41; 2:C12/R41"),
text("27"),text("R_IN_H_P"),text("47k"),text("Limits"),text("1:C2/R42; 2:C3/R42"),
text("28"),text("R_IN_L_P"),text("47k"),text("Limits"),text("1:C14/R42; 2:C15/R42"),
text("29"),text("R_IN_L_N"),text("47k"),text("Limits"),text("1:C17/R42; 2:C18/R42"),
text("30"),text("U_LIMIT"),text("MCP6002-I/P"),text("Limits"),text("1:C17/R25; 8:C20/R25"),
text("31"),text("C_LIMIT"),text("100nF"),text("Limits"),text("1:C28/R34; 2:C29/R34"))
#pagebreak()
= 5 — Todas as peças ainda não soldadas: restante 31–45
#table(columns:(9%,24%,29%,16%,22%),inset:4pt,text("# no desenho"),text("Ref"),text("Valor / peça"),text("Bloco"),text("Furos extremos"),
text("32"),text("R_H_GATE"),text("1k"),text("Limits"),text("1:C20/R42; 2:C21/R42"),
text("33"),text("R_L_GATE"),text("1k"),text("Limits"),text("1:C23/R42; 2:C24/R42"),
text("34"),text("R_H_OFF"),text("100k"),text("Limits"),text("1:C26/R42; 2:C27/R42"),
text("35"),text("R_L_OFF"),text("100k"),text("Limits"),text("1:C29/R42; 2:C30/R42"),
text("36"),text("C_H_COMP"),text("1nF"),text("Limits"),text("1:C12/R35; 2:C11/R35"),
text("37"),text("C_L_COMP"),text("1nF"),text("Limits"),text("1:C15/R35; 2:C16/R35"),
text("38"),text("Q_H_ADAPTER"),text("BSS84 on D-S-G adapter"),text("Limits"),text("1:C18/R36; 3:C20/R36"),
text("39"),text("Q_LOW"),text("2N7000 on D-S-G adapter"),text("Limits"),text("1:C22/R36; 3:C24/R36"),
text("40"),text("U_SSR_HIGH"),text("AQY212EH"),text("Pulse"),text("1:C22/R25; 4:C25/R25"),
text("41"),text("R_U_SSR_HIGH_LED"),text("270"),text("Pulse"),text("1:C5/R43; 2:C6/R43"),
text("42"),text("R_U_SSR_HIGH_BASE"),text("4.7k"),text("Pulse"),text("1:C8/R43; 2:C9/R43"),
text("43"),text("R_U_SSR_HIGH_OFF"),text("100k"),text("Pulse"),text("1:C11/R43; 2:C12/R43"),
text("44"),text("Q_U_SSR_HIGH"),text("BC548B"),text("Pulse"),text("1:C26/R36; 3:C28/R36"),
text("45"),text("U_SSR_LOW"),text("AQY212EH"),text("Pulse"),text("1:C22/R28; 4:C25/R28"),
text("46"),text("R_U_SSR_LOW_LED"),text("270"),text("Pulse"),text("1:C2/R44; 2:C3/R44"))
#pagebreak()
= 5 — Todas as peças ainda não soldadas: restante 46–60
#table(columns:(9%,24%,29%,16%,22%),inset:4pt,text("# no desenho"),text("Ref"),text("Valor / peça"),text("Bloco"),text("Furos extremos"),
text("47"),text("R_U_SSR_LOW_BASE"),text("4.7k"),text("Pulse"),text("1:C14/R44; 2:C15/R44"),
text("48"),text("R_U_SSR_LOW_OFF"),text("100k"),text("Pulse"),text("1:C17/R44; 2:C18/R44"),
text("49"),text("Q_U_SSR_LOW"),text("BC548B"),text("Pulse"),text("1:C9/R37; 3:C11/R37"),
text("50"),text("D_STIM"),text("1N4148"),text("Diagnostic"),text("1:C17/R38; 2:C20/R38"),
text("51"),text("R_STIM"),text("11k"),text("Diagnostic"),text("1:C20/R44; 2:C21/R44"),
text("52"),text("U_SSR_STIM"),text("AQY212EH"),text("Diagnostic"),text("1:C17/R30; 4:C20/R30"),
text("53"),text("R_U_SSR_STIM_LED"),text("270"),text("Diagnostic"),text("1:C23/R44; 2:C24/R44"),
text("54"),text("R_U_SSR_STIM_BASE"),text("4.7k"),text("Diagnostic"),text("1:C26/R44; 2:C27/R44"),
text("55"),text("R_U_SSR_STIM_OFF"),text("100k"),text("Diagnostic"),text("1:C29/R44; 2:C30/R44"),
text("56"),text("Q_U_SSR_STIM"),text("BC548B"),text("Diagnostic"),text("1:C13/R37; 3:C15/R37"),
text("57"),text("U_SSR_RETURN"),text("AQY212EH"),text("Diagnostic"),text("1:C22/R31; 4:C25/R31"),
text("58"),text("R_U_SSR_RETURN_LED"),text("270"),text("Diagnostic"),text("1:C5/R45; 2:C6/R45"),
text("59"),text("R_U_SSR_RETURN_BASE"),text("4.7k"),text("Diagnostic"),text("1:C8/R45; 2:C9/R45"),
text("60"),text("R_U_SSR_RETURN_OFF"),text("100k"),text("Diagnostic"),text("1:C11/R45; 2:C12/R45"),
text("61"),text("Q_U_SSR_RETURN"),text("BC548B"),text("Diagnostic"),text("1:C2/R38; 3:C4/R38"))
#pagebreak()
= 6 — Esquema dos dois canais simples
#image("assets/Voltage.svg",width:100%,height:140mm,fit:"contain")
#pagebreak()
= 7 — Verificações e limites da proposta
- Partes cinzas preservam exatamente os furos do guia simplificado. Para soldar fios em soquetes, retirar primeiro a ESP32. Confirmar C_BULK real: previsto47µF, fotografia sugeria100µF/10V.
- Todos os resistores novos são propostos em pé. Insular a perna longa; não deixar metal exposto encostando em outro terminal. Altura/largura ainda precisam de dry-fit; a representação PCB usa um envelope de dois terminais e não mede o corpo real.
- Verificar ausência de curto e continuidade do GND antes de alimentar. Alimentar pelo USB com fonte externa3,3V fisicamente desconectada, ou externamente com USB desconectado.
- Com entradas conhecidas, verificar0V, aproximadamente1V,2,5V e até5,25V em cada canal, comparar com multímetro e registrar ganho/offset. O capacitor pode exigir espera após mudar seleção.
- Exemplo da carga: um divisor didático10k/10k a5V teria2,5V no meio; conectar a entrada de20k desta placa reduz para aproximadamente2,0V. A correção de escala do software não desfaz essa interferência.
- O teste simples de continuidade serve à classificação ampla com calibração de curto/1k/aberto e resultado inconclusivo. Não declarar≤20Ω/≥100Ω sem incerteza e aceitação próprias; a resistência da matriz e o ADC entram no resultado.
- Nas etapas laranja: confirmar corrente SOURCE/SINK≤12mA, níveis P3 sob carga, estabilidade do regulador de corrente, watchdog e isolação antes de ligar ao circuito didático. Sem amperímetro; os resistores10Ω pertencem ao limitador, não a instrumento de corrente.
- Sinais externos EDU_ON/OFF_OK são0/3,3V e precisam de origem validada; nunca substituir OFF_OK por jumper permanente. Ainda não foram identificados na placa de energia real. O desenho não pressupõe que já existam.
- O gerador continua único e selecionado externamente. A placa recebeA/B selecionados e enviaPULSE_OUT; nenhum dos18 terminais das seis posições é ligado permanentemente em comum.
- Não reutilizar o teste ADC antigo no GPIO4: agora ele é SDA0. Medição usaGPIO34/35. O sketch da etapa1 testa telas/joystick/UART; ainda não é firmware de operação das etapas laranja.

*Resultado da revisão:* espaço nominal modelado, fios antigos preservados e lista completa das peças novas para você avaliar. O passo imediato recomendado é o dry-fit do conjunto e, depois, a medição simples. A bancada não fica automaticamente homologada por esse PDF.
