#set page(width:240mm,height:180mm,margin:10mm,footer:context [TedTronics · planejamento v01 · #counter(page).display()])
#set text(font:"DejaVu Sans",size:9pt)
#set heading(numbering:none)
#let tbl(rows,widths) = table(columns:widths,inset:5pt,..rows.flatten())
= Roteamento dos 22 nós — planejamento v01
25/10/2026 · Proposta independente, baseada nos dois PDFs recebidos e na placa inteligente simplificada.

#block(fill:rgb("fff1cc"),inset:8pt)[*Documento de decisões, não mapa de soldagem.* Dimensões, componentes de proteção, pinagem e aceitação elétrica ainda serão fechados com o usuário. Preserva o hardware montado e as revisões anteriores.]

== Mudança de escopo solicitada
Retirar a função de resistor variável/selecionável por software do novo projeto. Hipótese inicial: retirar todo banco de resistores didáticos roteáveis e o quarto MT dedicado a ele; confirmar se o pedido se refere somente a um potenciômetro. Resistores físicos encaixados pelos alunos continuam no circuito. Resistores de limitação, divisores, polarização e calibração NÃO são removidos por essa mudança. PDFs recebidos são mantidos como fontes históricas.

== O que está conhecido
#tbl((([Item],[Informação],[Evidência/limite]),([Energia],[Placa construída pelo amigo; usuário relata saída de 5 V.],[PDFs citam 5,01 V e 3,32 V; confirmar versão atual e proteção do ramo didático.]),([Roteador atual],[Um MT8816, ESP32 e interface com dois BC548.],[PDFs registram LED apagado e somente logs; aguarda atualização do ensaio físico.]),([Campo],[22 nós, 11 por metade; proposta de seis pogos comuns por nó.],[Confirmar continuidade real e identificação de cada coluna.]),([Inteligentes],[6 portas SSD1306, no máximo 3 ativas; joystick e UART.],[Placa simplificada já possui guia/código; estado real de soldagem/testes pendente.]),([Medição futura],[Duas entradas ADC1 com divisores 10k/10k, série 1k e 100nF.],[Parte adiada na montagem; não é entrada de alta impedância nem prova de continuidade de precisão.])),(19%,43%,38%))

*Fontes locais:* Oficinas3_Relatorio_Tecnico_Placa_Roteamento_MT8816AE.pdf (20 páginas); TedTronics_Placa_Roteamento_Final_3_ou_4_MT8816AE.pdf (18 páginas). Estado relatado nesses documentos não substitui o estado atual informado pelo montador.
#pagebreak()
= Arquiteturas a decidir
#tbl((([Opção],[Distribuição],[Capacidade e consequência]),([1 MT atual],[Protótipo com bits de endereço fixos e AX0/AY0 unidos.],[Não oferece endereçamento geral; confirmar cada caminho antes de expandir.]),([2 MT],[11 nós em X por chip; Y0…Y7 comuns.],[22 nós / 8 barramentos totais. Fontes e diagnóstico reduzem os barramentos livres. Menos fiação; capacidade deve ser validada com os exercícios.]),([3 MT — proposta-base],[Y de U1=8 nós; U2=8; U3=6. X0…X15 comuns.],[22 nós / 16 barramentos totais; Y6/Y7 de U3 ficam livres. Candidatos a duas portas de medição, sem resistor entre elas.]),([4 MT],[Ampliação com bloco extra.],[Não necessário apenas para retirar o banco de resistores; só acrescentar se outra função justificar.])),(19%,39%,42%))

== Proposta-base para discussão: três MT
#tbl((([Chip],[Terminais],[Nós ou função candidata]),([U1],[Y0…Y7],[NODE00…NODE07]),([U2],[Y0…Y7],[NODE08…NODE15]),([U3],[Y0…Y5],[NODE16…NODE21]),([U3],[Y6 / Y7],[SENSE_A / SENSE_B — reserva proposta, ainda sem circuito fechado]),([U1/U2/U3],[X0…X15],[16 barramentos compartilhados; funções de energia/diagnóstico a decidir.])),(15%,25%,60%))

Exemplo de uma net: NODE02 → chave U1/Y2-X5 → BUS05 → chave U3/X5-Y3 → NODE19. Cada net elétrica independente recebe barramento exclusivo; nós da mesma net compartilham esse barramento. Não unir barramentos de nets diferentes.

*Quantidade de chips não é a única decisão:* uma porta de medição deve poder observar uma net sem unir as duas pontas do componente medido. Barramentos de teste de A e B devem permanecer distintos. O cálculo de capacidade deve incluir fontes, nets simultâneas, diagnóstico e os terminais dos componentes reais.

O MT8816 é uma matriz de chaves resistivas, não um fio ideal. Datasheet: 8×16; R_ON típico 120 Ω a 5 V e 45 Ω a 12 V nas condições especificadas. Alimentar o CI a 12 V exige revisão do controle e do reset; não mudar o protótipo por simples troca de alimentação. Nenhum nó didático ou entrada ESP32 pode receber 12 V.
#pagebreak()
= Medição e continuidade: três problemas diferentes
#tbl((([Teste],[O que demonstra],[O que não demonstra]),([Autoteste do roteador],[Uma chave abre/fecha; endereço e chip corretos; ausência de ligações indevidas.],[Contato físico de cada pogo com o componente.]),([Contato/continuidade],[Com estímulo limitado e alimentação didática desligada, observar resposta elétrica entre pontos acessíveis.],[Identidade do componente ou contato individual quando existem caminhos paralelos.]),([Componente inteligente],[ADC observa duas nets selecionadas; OLED recebe leitura com validade/posição.],[Uma leitura zero não prova componente presente; ACK do OLED não prova contato dos terminais didáticos.])),(22%,39%,39%))

== Limite de observabilidade dos pogos
Se seis pogos de uma coluna estão eletricamente unidos e chegam à matriz por um único fio, a matriz vê somente o nó comum. Não consegue separar um pogo individual nem distinguir contato direto de um caminho alternativo sem isolamento adicional ou procedimento de teste. Para verificar um componente específico, abrir as rotas alternativas, definir os dois pontos acessíveis e considerar seus caminhos internos. Capacitores e LEDs não têm a mesma resposta de um fio.

== Duas alternativas de medição
- *Detecção simples:* reaproveitar ADC do ESP32 e divisores da placa inteligente, para contato aberto/fechado em faixas amplas, com calibração, repetição e resultado inconclusivo. A carga de aproximadamente 20kΩ e R_ON da matriz entram no circuito. Não prometer discriminar 20Ω de 100Ω.
- *Continuidade de precisão:* preservar o objetivo herdado (≤20Ω passa; ≥100Ω rejeita; zona intermediária inconclusiva). Precisa de circuito de estímulo/medição, isolamento e análise de incerteza próprios; simples ADC e subtração fixa de R_ON não bastam.

*Proposta de transação:* cortar alimentação didática → confirmar condição desenergizada e tratar carga em capacitores → abrir rotas alternativas → selecionar A/B sem uni-los → aplicar estímulo limitado, desligado por padrão → aguardar estabilização → medir/calibrar → retirar estímulo → abrir portas de diagnóstico → reconstruir apenas o circuito autorizado. Falha ou leitura inconclusiva mantém alimentação didática desligada.

*Decisões pendentes:* contato específico versus caminho entre nós; faixas de resistência; tempo máximo; presença de LEDs/capacitores; necessidade de dois pontos adicionais de teste; quantidade de componentes inteligentes simultâneos.
#pagebreak()
= Controle e integração propostos
#tbl((([Parte],[Responsabilidade],[Interface a fechar]),([Raspberry Pi],[Visão, tipo/posição dos componentes, grafo-alvo e sessão.],[Como comunicar com duas ESP32 sem ligar dois TX na mesma entrada. Opções: USB serial, segundo UART, ou barramento com transceptores.]),([ESP1 — roteador],[Alocar barramentos, aplicar/remover chaves, espelho de estado e controle da energia didática.],[Controle completo AX0…3, AY0…2, DATA, CS, STROBE e RESET. Dois BC548 do protótipo não expandem sozinhos para isso.]),([Lógica de controle],[Possível uso de dois 74HCT595 e buffer HCT para sinais 5 V.],[Confirmar componentes reais, níveis lógicos, estado de boot, temporização e comando seguro de reset.]),([ESP2 — inteligentes],[Seis SDAs independentes, SCL comum; joystick; ADC de dois canais; no máximo três posições ativas.],[RX32/TX33 atuais; ADC34/35 futuros; associar amostra à geração de rota e à posição solicitada.]),([Energia],[Separar lógica/telas do ramo acessível ao aluno.],[Buck regulado não comprova limitação/corte seguro por ramo; inventariar proteção e habilitação existentes.])),(22%,40%,38%))

== Roteamento inteligente no firmware
1. Validar componentes, terminais e netlist, incluindo conflitos entre fontes.
2. Calcular as nets elétricas e reservar barramentos sem misturar redes.
3. Antes de mudar a topologia, desabilitar energia/estímulos e remover ligações incompatíveis; aplicar break-before-make.
4. Programar cruzamentos com tradução do código AX conforme datasheet; a sequência X6…X13 não é código binário crescente simples.
5. Enviar confirmação com identificação da rota, sessão e geração. Espelho de software não é medição física.
6. ESP2 só publica amostras frescas da mesma geração confirmada. Comunicação perdida, reset e erro de rota invalidam a leitura.
7. Só habilitar o ramo didático após as verificações e intertravamentos definidos. Nenhum comando de tela ou ADC autoriza energia sozinho.

== Preservar o trabalho já soldado
Fotografar as duas faces e registrar o netlist real do protótipo. Modificações de bits fixos, DATA/CS e reset exigem mapa específico de retrabalho. Não instruir remoção de componentes permanentes sem identificar os fios existentes e o ensaio intermediário. Hardware de versões anteriores permanece como referência, sem edição retroativa.
#pagebreak()
= Perguntas e sequência até o PDF de soldagem
== Rodada 1 — responder primeiro
1. Retirar todo banco de resistores selecionáveis ou apenas o potenciômetro? Manter resistores didáticos encaixáveis?
2. Quantos MT8816 estão disponíveis? O LED já acendeu e a abertura/fechamento foi medida?
3. Continuidade: contato pogo/componente, qualquer par de nós, ou os dois? Com circuito desenergizado?
4. Quais placas estão soldadas/testadas, quais saídas/proteções a energia possui e qual o espaço disponível?

== Rodada 2 — após as respostas
- Máximo de componentes/redes e exemplos dos exercícios que precisam funcionar.
- Lista de funções dos inteligentes no encerramento: voltímetro, continuidade, pulso e/ou corrente. Frequências, correntes e precisão exigidas.
- Posição física e terminais dos inteligentes; os cabos de medição saem diretamente dos pogos ou passam pelo roteador?
- Seis pogos por coluna já unidos? Cabos e conectores prontos? Fotos/medidas da placa de contatos.
- Quais peças já existem: buffers, ADC, multiplexador de 16 canais, chaves/relés, registradores, resistores e limitadores.
- Como o Pi se comunica com as duas ESP32; boot do Pi resolvido? USB ou UART físico disponível?

== Próximos entregáveis
#tbl((([Marco],[Conteúdo],[Critério]),([A — inventário],[Fotos, medições, mapa do chip atual e teste de uma chave.],[Separar fato medido, relato e proposta.]),([B — arquitetura],[Escolher 2/3 chips, barramentos e interfaces de diagnóstico.],[Casos de exercício cabem; contato/continuidade é observável.]),([C — esquema],[tscircuit; uma página 4:3 colorida por sinais, sem caixas de seção; detalhes quando necessários.],[Pinagem/netlist/estados de boot e falha revisados.]),([D — montagem],[Grade real, soquetes, cabos, fiação por etapa, pontos de medida e BOM.],[Encaixe real confirmado; preservar placas já montadas.]),([E — firmware e bancada],[Autoteste de chaves, 22 nós, medições, comunicação e falhas.],[Evidência física por etapa, não apenas geração de PDF ou logs.])),(20%,47%,33%))

*Referências técnicas consultadas:* MT8816, datasheet Zarlink/Microchip, setembro/2011 (hospedado pela Mouser): https://www.mouser.com/datasheet/2/268/Microchip_06182024_MT8816AE1-3459976.pdf. SN74HCT595, TI: https://www.ti.com/lit/ds/symlink/sn74hct595.pdf. Não houve seleção final de encapsulamentos nem compra nesta etapa.
