#set page(paper:"a4",flipped:true,margin:12mm,footer:context [Roteador 2 MT8816 + HC595 + HCT14 · guia provisório · 30/10/2026 · #counter(page).display()])
#set text(font:"DejaVu Sans",size:9pt,lang:"pt")
#set par(leading:.5em)
= Guia de montagem — nova placa de roteamento
*Perfboard de 10 × 20 cm • dois MT8816 • dois 74HC595 • um 74HCT14*

Guia de preparação, posicionamento provisório e fiação por terminais, derivado do candidato elétrico existente. Preserva a placa inteligente e as demais revisões. Não é o projeto de PCB corroída e não contém as trilhas reprovadas.

*Malha assumida por solicitação do usuário:* 37 colunas × 75 linhas, passo de 2,54 mm. O retângulo entre furos extremos mede 91,44 × 187,96 mm. Os quatro barramentos de borda são separados. Confirmar quantidade real, margens, montagem dos soquetes e largura do ESP32 antes de usar as coordenadas.

*Use agora:* separar peças, identificar pinos, fazer encaixe a seco, etiquetar conectores e revisar o circuito com quem vai soldar. *Antes de soldar:* conferir as coordenadas na placa comprada e registrar o encaixe. Os retângulos dos desenhos ligam furos; não são medidas completas dos corpos reais.

As linhas pontilhadas das páginas de fiação mostram somente as duas pontas de cada ligação. O caminho do fio isolado é manual; cruzamento no desenho não significa junção. Não há roteamento físico validado, comprimentos de corte ou autorização de corrosão.

São 48 referências e 152 ligações internas de terminais. Barramentos e emendas podem reduzir fios cortados, mas todas as pontas elétricas precisam ser mantidas. Este guia verifica a equivalência da lista de ligações com o modelo; não verifica solda, corrente ou funcionamento em bancada.

#pagebreak()
= 1 — Como orientar a placa e ler os pinos
Vista TOP: componentes voltados para você, USB do ESP32 para cima. Colunas C1–C37 da esquerda para a direita; linhas R1–R75 de cima para baixo. Na vista inferior espelhada, os nomes C/R continuam identificando os mesmos furos TOP. Não renumerar pinos ao virar a placa.

Nos CIs DIP, entalhe voltado para cima: pino 1 no canto superior esquerdo, números descem pela esquerda e sobem pela direita. O círculo marca pino 1. U1/U2 são DIP40, U5/U6 DIP16 e U\_LEVEL DIP14. Soquetes são recomendados; não inserir os CIs durante a soldagem.

Resistores: terminal 1 é a ponta esquerda no TOP, terminal 2 a direita; normalmente sem polaridade. Os dois 470 Ω e o 10 kΩ limitador de teste devem ser 1%. Capacitores de 100 nF não têm polaridade. Nos eletrolíticos: terminal 1 positivo, terminal 2 negativo; usar tensão nominal acima da alimentação, por exemplo 16 V para 5 V e 25 V para 12 V.

Transistores no modelo: 1 = coletor, 2 = base, 3 = emissor. A sequência real depende da peça comprada: conferir datasheet/encapsulamento antes de dobrar as pernas. Não assumir que qualquer BC548/BC557 tem a mesma orientação de corpo.

Cores: preto = GND; vermelho = alimentação positiva, com etiquetas distintas “5 V”/“12 V”; azul, verde, amarelo e branco para sinais. Nunca usar o barramento de 5 V como saída direta para um nó de experimento.

#pagebreak()
= 2 — Encaixe a seco: TOP e inferior espelhada
#grid(columns:(90mm,90mm,1fr),gutter:5mm,image("assets/top.svg",height:166mm),image("assets/underside.svg",height:166mm),[
*Antes da solda:*

+ Conferir a malha real; não forçar terminais para cumprir o desenho.
+ Posicionar os dois soquetes do ESP32 e verificar acesso ao USB/EN/BOOT.
+ Posicionar cinco soquetes de CI e todos os conectores.
+ Colocar passivos e transistores sem cortar pernas.
+ Verificar largura dos corpos, capacitores, área para os cabos e parafusos.
+ Fotografar TOP e inferior e marcar C1/R1 permanentemente.

*Bordas propostas:* esquerda GND, direita 5 V, inferior 12 V, superior livre. As tabelas elétricas usam H2 como origem das alimentações; as bordas só podem substituir trechos se forem ligadas à rede correta e verificadas.

Não há ligação implícita entre furos vizinhos. Um barramento contínuo de cobre pode distribuir uma única rede; não soldar redes diferentes na mesma borda.
])

#pagebreak()
= 3 — Peças e posições provisórias
#table(columns:(18%,27%,55%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Referência],[Valor / peça],[Terminais TOP (C/R)],[J\_ESP\_L],[Conector sem modelo comprado],[P1=C14/R3; demais: tabela completa de pinos (pins.csv)],[J\_ESP\_R],[Conector sem modelo comprado],[P1=C24/R3; demais: tabela completa de pinos (pins.csv)],[Q6],[BC548B],[1=C31/R31 · 2=C32/R31 · 3=C33/R31],[R6],[10k],[1=C29/R33 · 2=C32/R33],[R12],[100k],[1=C31/R35 · 2=C34/R35],[R7],[47k],[1=C31/R37 · 2=C34/R37],[U5],[74HC595],[P1=C6/R33; demais: tabela completa de pinos (pins.csv)],[U6],[74HC595],[P1=C24/R33; demais: tabela completa de pinos (pins.csv)],[C4],[100nF],[1=C3/R34 · 2=C4/R34],[C5],[100nF],[1=C29/R39 · 2=C30/R39],[R8],[10k],[1=C12/R35 · 2=C15/R35],[R9],[10k],[1=C12/R38 · 2=C15/R38],[U1],[MT8816AE1],[P1=C6/R45; demais: tabela completa de pinos (pins.csv)],[C1],[100nF],[1=C8/R42 · 2=C9/R42],[H1],[Conector sem modelo comprado],[P1=C2/R47; demais: tabela completa de pinos (pins.csv)],[U2],[MT8816AE1],[P1=C26/R45; demais: tabela completa de pinos (pins.csv)])

#pagebreak()
= 3 — Peças e posições — continuação
#table(columns:(18%,27%,55%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Referência],[Valor / peça],[Terminais TOP (C/R)],[C2],[100nF],[1=C28/R42 · 2=C29/R42],[H3],[Conector sem modelo comprado],[P1=C36/R47; demais: tabela completa de pinos (pins.csv)],[Q7],[BC557B],[1=C16/R45 · 2=C17/R45 · 3=C18/R45],[Q8],[BC548B],[1=C21/R45 · 2=C22/R45 · 3=C23/R45],[R21],[47k],[1=C15/R48 · 2=C18/R48],[R30],[4.7k],[1=C20/R48 · 2=C23/R48],[R13],[10k],[1=C20/R51 · 2=C23/R51],[R14],[100k],[1=C20/R54 · 2=C23/R54],[R17],[470],[1=C15/R54 · 2=C18/R54],[Q11],[BC548B],[1=C16/R61 · 2=C17/R61 · 3=C18/R61],[R\_LOW\_BASE],[4.7k],[1=C20/R59 · 2=C23/R59],[R\_LOW\_PD],[100k],[1=C20/R62 · 2=C23/R62],[R\_LOW\_LIMIT],[470],[1=C15/R64 · 2=C18/R64],[Q9],[BC557B],[1=C16/R69 · 2=C17/R69 · 3=C18/R69],[Q10],[BC548B],[1=C21/R69 · 2=C22/R69 · 3=C23/R69],[R24],[47k],[1=C14/R72 · 2=C17/R72])

#pagebreak()
= 3 — Peças e posições — continuação
#table(columns:(18%,27%,55%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Referência],[Valor / peça],[Terminais TOP (C/R)],[R27],[10k],[1=C21/R72 · 2=C24/R72],[R15],[10k],[1=C21/R74 · 2=C24/R74],[R16],[100k],[1=C26/R72 · 2=C29/R72],[R18],[10k],[1=C8/R72 · 2=C11/R72],[H2],[Conector sem modelo comprado],[1=C3/R3 · 2=C4/R3 · 3=C5/R3 · 4=C6/R3],[J\_SMART],[Conector sem modelo comprado],[1=C31/R3 · 2=C32/R3 · 3=C33/R3 · 4=C34/R3],[R\_PULSE\_IN],[47k],[1=C31/R7 · 2=C34/R7],[C\_BULK5],[47uF],[1=C6/R20 · 2=C7/R20],[C\_BULK12],[47uF],[1=C31/R20 · 2=C32/R20],[U\_LEVEL],[74HCT14],[P1=C18/R23; demais: tabela completa de pinos (pins.csv)],[R\_PD\_23],[47k],[1=C2/R24 · 2=C5/R24],[R\_PD\_18],[47k],[1=C2/R26 · 2=C5/R26],[R\_PD\_22],[47k],[1=C2/R28 · 2=C5/R28],[R\_PD\_19],[47k],[1=C32/R24 · 2=C35/R24],[R\_PD\_21],[47k],[1=C32/R26 · 2=C35/R26],[C\_LEVEL],[100nF],[1=C23/R26 · 2=C24/R26])

#pagebreak()
= Pinos sem fio — conferir antes da solda
Os terminais abaixo não recebem ligação externa neste candidato. Não unir pinos NC entre si e não aterrar X não utilizados da matriz. A entrada não usada do HCT14 é exceção explícita: pino 13 está em GND e aparece nas páginas W.

#table(columns:(20%,80%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Componente],[Pinos sem conexão no modelo],[J\_ESP\_L],[1 (3V3), 3 (GPIO15), 4 (GPIO2), 5 (GPIO4), 6 (GPIO16), 7 (GPIO17), 8 (GPIO5), 12 (GPIO3\_RX0), 13 (GPIO1\_TX0)],[J\_ESP\_R],[1 (VIN), 3 (GPIO13), 4 (GPIO12), 9 (GPIO33), 10 (GPIO32), 11 (GPIO35), 13 (GPIO39\_VN), 14 (GPIO36\_VP), 15 (EN)],[U6],[2 (QC), 3 (QD), 4 (QE), 5 (QF), 6 (QG), 7 (QH), 9 (QH\_SER)],[U1],[6 (X14), 7 (X15), 13 (X11), 14 (NC), 26 (X13), 27 (X12), 34 (NC)],[U2],[6 (X14), 7 (X15), 13 (X11), 14 (NC), 26 (X13), 27 (X12), 34 (NC)],[H2],[3 (NC)],[U\_LEVEL],[12 (6Y)])

U1/U2: pinos 19 (Y5), 17 (Y6) e 15 (Y7) são barramentos privados. Não recebem fio externo neste candidato, mas podem unir X por chaves internas. Não conectar aos Y da outra metade.

Não conectar o pino 3V3 do ESP32 à rede de 5 V; os soquetes mostram vários pinos sem uso porque este roteador recebe alimentação própria por USB. Manter acesso a VIN e demais pinos sem criar derivações improvisadas.

#pagebreak()
= 4 — Ordem de montagem e auditoria por bloco
As etapas M abaixo pertencem a este candidato independente; não são aprovações dos checkpoints CP00–CP36 do projeto. Não transferir resultados de outra revisão. Dentro de cada etapa, conferir peça, solda e continuidade; só depois prosseguir. Não alimentar montagens parciais sem um procedimento específico revisado.

#table(columns:(10%,40%,50%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Etapa],[Instalar/conferir],[Critério antes de avançar],[M00],[Encaixe a seco, pinagem e conectores],[Malha e corpos reais conferidos; fotos TOP/inferior; nenhum componente permanente anterior alterado.],[M01],[Soquetes, H2, GND, 5 V, 12 V e capacitores],[Sem curtos persistentes entre alimentações; polaridades e pinos de alimentação corretos. Sem ESP32/CIs, verificar fonte regulada nos soquetes, desligar e descarregar.],[M02],[Q6, R6/R12/R7 e 74HCT14 com pull-downs],[RESET ativo sem liberação; cinco entradas em nível baixo sem comandos. Revisar antes de energizar.],[M03],[U5/U6, encadeamento, CS, endereço e STROBE],[Firmware específico deve verificar cada bit/endereço. Não usar o sketch dos OLEDs para este teste.],[M04],[Soquetes U1/U2, 22 nós e barramentos],[Conferência terminal a terminal sem CIs; depois testar todas as seleções com estímulo limitado.],[M05],[Transistores ALTO/BAIXO/TESTE],[Comandos desligados na inicialização. Medir saída em aberto, carga conhecida e curto controlado; nunca energizar ALTO e BAIXO juntos.],[M06],[J\_SMART e cabos externos],[GND comum; entradas A/B com divisores na placa inteligente; pedido de pulso em 3,3 V.],[M07],[Integração supervisionada],[Precheck conhecido passa/rejeita/inconclusivo; desligamento por falha; nenhuma autorização automática após reset.])

#pagebreak()
= 5 — Como executar as páginas de fios
Cada Wxxx identifica uma ligação elétrica. A origem/destino informa referência, pino, nome e furo TOP. Marcar a ligação como instalada somente depois da inspeção; marcar “medida” em separado. Trabalhar com as duas fontes e o USB desconectados.

As redes com várias pontas aparecem em estrela no documento para facilitar auditoria. Você pode usar a borda correta ou derivações locais para GND/5 V/12 V, sem acumular muitos fios num terminal de soquete. Não trocar a topologia elétrica: todas as pontas de uma rede precisam permanecer unidas. Definir e registrar o ponto físico de distribuição antes de soldar.

Nas páginas seguintes, a montagem completa aparece em cinza e até oito ligações são destacadas. Os traços são guias de pontas e podem atravessar componentes no papel; não indicam que se deve passar fio desprotegido por ali. Usar fio isolado e aliviar esforço mecânico junto aos conectores.

Depois de cada grupo: conferir continuidade com pontas de prova na origem e no destino; inspecionar ilhas vizinhas. Resistores e transistores fazem redes distintas se relacionarem eletricamente: ausência de “bip” não é um teste universal de isolamento. Para conferência do cobre/fios, manter ESP32 e CIs removidos dos soquetes quando necessário.

*Estado das verificações:* a lista W foi comparada às redes do modelo. Os pinos sem conexão não recebem fios. Os barramentos privados Y5/Y6/Y7 têm apenas um terminal externo cada; suas interligações aos X são internas aos MT8816 e configuradas por firmware.

#pagebreak()
= Fiação 01 — W001 a W008
#grid(columns:(85mm,85mm,1fr),gutter:4mm,image("assets/w01-top.svg",height:164mm),image("assets/w01-bottom.svg",height:164mm),[
#table(columns:(33%,67%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio / rede],[Origem → destino],[W001 / GND],[H2.4 (GND)
C6/R3
→ J\_ESP\_L.2 (GND)
C14/R4],[W002 / GND],[H2.4 (GND)
C6/R3
→ J\_ESP\_R.2 (GND)
C24/R4],[W003 / GND],[H2.4 (GND)
C6/R3
→ J\_SMART.2 (GND)
C32/R3],[W004 / GND],[H2.4 (GND)
C6/R3
→ U\_LEVEL.7 (GND)
C18/R29],[W005 / GND],[H2.4 (GND)
C6/R3
→ U\_LEVEL.13 (6A)
C21/R24],[W006 / GND],[H2.4 (GND)
C6/R3
→ U5.8 (GND)
C6/R40],[W007 / GND],[H2.4 (GND)
C6/R3
→ U6.8 (GND)
C24/R40],[W008 / GND],[H2.4 (GND)
C6/R3
→ U1.16 (VSS)
C6/R60])

TOP à esquerda; inferior espelhada no centro. Coordenadas provisórias. Todos os fios deste grupo devem ser conferidos antes do próximo.
])

#pagebreak()
= Função dos fios — grupo 01
#table(columns:(10%,20%,70%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio],[Rede],[O que faz / por que existe],[W001],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W002],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W003],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W004],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W005],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W006],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W007],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W008],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.])

Registro: instalado por/data: ……………………  continuidade medida por/data: ……………………  observações: ……………………

#pagebreak()
= Fiação 02 — W009 a W016
#grid(columns:(85mm,85mm,1fr),gutter:4mm,image("assets/w02-top.svg",height:164mm),image("assets/w02-bottom.svg",height:164mm),[
#table(columns:(33%,67%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio / rede],[Origem → destino],[W009 / GND],[H2.4 (GND)
C6/R3
→ U1.20 (VEE)
C6/R64],[W010 / GND],[H2.4 (GND)
C6/R3
→ U1.35 (Y0)
C12/R50],[W011 / GND],[H2.4 (GND)
C6/R3
→ U2.16 (VSS)
C26/R60],[W012 / GND],[H2.4 (GND)
C6/R3
→ U2.20 (VEE)
C26/R64],[W013 / GND],[H2.4 (GND)
C6/R3
→ U2.35 (Y0)
C32/R50],[W014 / GND],[H2.4 (GND)
C6/R3
→ Q6.3 (E)
C33/R31],[W015 / GND],[H2.4 (GND)
C6/R3
→ Q8.3 (E)
C23/R45],[W016 / GND],[H2.4 (GND)
C6/R3
→ Q11.3 (E)
C18/R61])

TOP à esquerda; inferior espelhada no centro. Coordenadas provisórias. Todos os fios deste grupo devem ser conferidos antes do próximo.
])

#pagebreak()
= Função dos fios — grupo 02
#table(columns:(10%,20%,70%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio],[Rede],[O que faz / por que existe],[W009],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W010],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W011],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W012],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W013],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W014],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W015],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W016],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.])

Registro: instalado por/data: ……………………  continuidade medida por/data: ……………………  observações: ……………………

#pagebreak()
= Fiação 03 — W017 a W024
#grid(columns:(85mm,85mm,1fr),gutter:4mm,image("assets/w03-top.svg",height:164mm),image("assets/w03-bottom.svg",height:164mm),[
#table(columns:(33%,67%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio / rede],[Origem → destino],[W017 / GND],[H2.4 (GND)
C6/R3
→ Q10.3 (E)
C23/R69],[W018 / GND],[H2.4 (GND)
C6/R3
→ R12.2 (B)
C34/R35],[W019 / GND],[H2.4 (GND)
C6/R3
→ R8.2 (B)
C15/R35],[W020 / GND],[H2.4 (GND)
C6/R3
→ R9.2 (B)
C15/R38],[W021 / GND],[H2.4 (GND)
C6/R3
→ R14.2 (B)
C23/R54],[W022 / GND],[H2.4 (GND)
C6/R3
→ R\_LOW\_PD.2 (B)
C23/R62],[W023 / GND],[H2.4 (GND)
C6/R3
→ R16.2 (B)
C29/R72],[W024 / GND],[H2.4 (GND)
C6/R3
→ R\_PULSE\_IN.2 (B)
C34/R7])

TOP à esquerda; inferior espelhada no centro. Coordenadas provisórias. Todos os fios deste grupo devem ser conferidos antes do próximo.
])

#pagebreak()
= Função dos fios — grupo 03
#table(columns:(10%,20%,70%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio],[Rede],[O que faz / por que existe],[W017],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W018],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W019],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W020],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W021],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W022],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W023],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W024],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.])

Registro: instalado por/data: ……………………  continuidade medida por/data: ……………………  observações: ……………………

#pagebreak()
= Fiação 04 — W025 a W032
#grid(columns:(85mm,85mm,1fr),gutter:4mm,image("assets/w04-top.svg",height:164mm),image("assets/w04-bottom.svg",height:164mm),[
#table(columns:(33%,67%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio / rede],[Origem → destino],[W025 / GND],[H2.4 (GND)
C6/R3
→ R\_PD\_23.2 (B)
C5/R24],[W026 / GND],[H2.4 (GND)
C6/R3
→ R\_PD\_18.2 (B)
C5/R26],[W027 / GND],[H2.4 (GND)
C6/R3
→ R\_PD\_22.2 (B)
C5/R28],[W028 / GND],[H2.4 (GND)
C6/R3
→ R\_PD\_19.2 (B)
C35/R24],[W029 / GND],[H2.4 (GND)
C6/R3
→ R\_PD\_21.2 (B)
C35/R26],[W030 / GND],[H2.4 (GND)
C6/R3
→ C\_BULK5.2 (-)
C7/R20],[W031 / GND],[H2.4 (GND)
C6/R3
→ C\_BULK12.2 (-)
C32/R20],[W032 / GND],[H2.4 (GND)
C6/R3
→ C\_LEVEL.2 (B)
C24/R26])

TOP à esquerda; inferior espelhada no centro. Coordenadas provisórias. Todos os fios deste grupo devem ser conferidos antes do próximo.
])

#pagebreak()
= Função dos fios — grupo 04
#table(columns:(10%,20%,70%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio],[Rede],[O que faz / por que existe],[W025],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W026],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W027],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W028],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W029],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W030],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W031],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W032],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.])

Registro: instalado por/data: ……………………  continuidade medida por/data: ……………………  observações: ……………………

#pagebreak()
= Fiação 05 — W033 a W040
#grid(columns:(85mm,85mm,1fr),gutter:4mm,image("assets/w05-top.svg",height:164mm),image("assets/w05-bottom.svg",height:164mm),[
#table(columns:(33%,67%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio / rede],[Origem → destino],[W033 / GND],[H2.4 (GND)
C6/R3
→ C4.2 (B)
C4/R34],[W034 / GND],[H2.4 (GND)
C6/R3
→ C5.2 (B)
C30/R39],[W035 / GND],[H2.4 (GND)
C6/R3
→ C1.2 (B)
C9/R42],[W036 / GND],[H2.4 (GND)
C6/R3
→ C2.2 (B)
C29/R42],[W037 / V5],[H2.2 (V5)
C4/R3
→ U\_LEVEL.14 (VCC)
C21/R23],[W038 / V5],[H2.2 (V5)
C4/R3
→ U5.10 (SRCLR\_N)
C9/R39],[W039 / V5],[H2.2 (V5)
C4/R3
→ U5.16 (VCC)
C9/R33],[W040 / V5],[H2.2 (V5)
C4/R3
→ U6.10 (SRCLR\_N)
C27/R39])

TOP à esquerda; inferior espelhada no centro. Coordenadas provisórias. Todos os fios deste grupo devem ser conferidos antes do próximo.
])

#pagebreak()
= Função dos fios — grupo 05
#table(columns:(10%,20%,70%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio],[Rede],[O que faz / por que existe],[W033],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W034],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W035],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W036],[GND],[Referência e retorno comum. Não unir a 5 V ou 12 V.],[W037],[V5],[Alimentação de controle/saídas em 5 V; não é saída limitada do experimento.],[W038],[V5],[Alimentação de controle/saídas em 5 V; não é saída limitada do experimento.],[W039],[V5],[Alimentação de controle/saídas em 5 V; não é saída limitada do experimento.],[W040],[V5],[Alimentação de controle/saídas em 5 V; não é saída limitada do experimento.])

Registro: instalado por/data: ……………………  continuidade medida por/data: ……………………  observações: ……………………

#pagebreak()
= Fiação 06 — W041 a W048
#grid(columns:(85mm,85mm,1fr),gutter:4mm,image("assets/w06-top.svg",height:164mm),image("assets/w06-bottom.svg",height:164mm),[
#table(columns:(33%,67%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio / rede],[Origem → destino],[W041 / V5],[H2.2 (V5)
C4/R3
→ U6.16 (VCC)
C27/R33],[W042 / V5],[H2.2 (V5)
C4/R3
→ Q7.3 (E)
C18/R45],[W043 / V5],[H2.2 (V5)
C4/R3
→ Q9.3 (E)
C18/R69],[W044 / V5],[H2.2 (V5)
C4/R3
→ R21.1 (A)
C15/R48],[W045 / V5],[H2.2 (V5)
C4/R3
→ R24.1 (A)
C14/R72],[W046 / V5],[H2.2 (V5)
C4/R3
→ C\_BULK5.1 (+)
C6/R20],[W047 / V5],[H2.2 (V5)
C4/R3
→ C\_LEVEL.1 (A)
C23/R26],[W048 / V5],[H2.2 (V5)
C4/R3
→ C4.1 (A)
C3/R34])

TOP à esquerda; inferior espelhada no centro. Coordenadas provisórias. Todos os fios deste grupo devem ser conferidos antes do próximo.
])

#pagebreak()
= Função dos fios — grupo 06
#table(columns:(10%,20%,70%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio],[Rede],[O que faz / por que existe],[W041],[V5],[Alimentação de controle/saídas em 5 V; não é saída limitada do experimento.],[W042],[V5],[Alimentação de controle/saídas em 5 V; não é saída limitada do experimento.],[W043],[V5],[Alimentação de controle/saídas em 5 V; não é saída limitada do experimento.],[W044],[V5],[Alimentação de controle/saídas em 5 V; não é saída limitada do experimento.],[W045],[V5],[Alimentação de controle/saídas em 5 V; não é saída limitada do experimento.],[W046],[V5],[Alimentação de controle/saídas em 5 V; não é saída limitada do experimento.],[W047],[V5],[Alimentação de controle/saídas em 5 V; não é saída limitada do experimento.],[W048],[V5],[Alimentação de controle/saídas em 5 V; não é saída limitada do experimento.])

Registro: instalado por/data: ……………………  continuidade medida por/data: ……………………  observações: ……………………

#pagebreak()
= Fiação 07 — W049 a W056
#grid(columns:(85mm,85mm,1fr),gutter:4mm,image("assets/w07-top.svg",height:164mm),image("assets/w07-bottom.svg",height:164mm),[
#table(columns:(33%,67%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio / rede],[Origem → destino],[W049 / V5],[H2.2 (V5)
C4/R3
→ C5.1 (A)
C29/R39],[W050 / V12],[H2.1 (V12)
C3/R3
→ U1.40 (VDD)
C12/R45],[W051 / V12],[H2.1 (V12)
C3/R3
→ U2.40 (VDD)
C32/R45],[W052 / V12],[H2.1 (V12)
C3/R3
→ R7.1 (A)
C31/R37],[W053 / V12],[H2.1 (V12)
C3/R3
→ C\_BULK12.1 (+)
C31/R20],[W054 / V12],[H2.1 (V12)
C3/R3
→ C1.1 (A)
C8/R42],[W055 / V12],[H2.1 (V12)
C3/R3
→ C2.1 (A)
C28/R42],[W056 / AX0],[U5.15 (QA)
C9/R34
→ U1.5 (AX0)
C6/R49])

TOP à esquerda; inferior espelhada no centro. Coordenadas provisórias. Todos os fios deste grupo devem ser conferidos antes do próximo.
])

#pagebreak()
= Função dos fios — grupo 07
#table(columns:(10%,20%,70%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio],[Rede],[O que faz / por que existe],[W049],[V5],[Alimentação de controle/saídas em 5 V; não é saída limitada do experimento.],[W050],[V12],[Alimentação dos MT8816 e pull-up do RESET; nunca levar a um GPIO.],[W051],[V12],[Alimentação dos MT8816 e pull-up do RESET; nunca levar a um GPIO.],[W052],[V12],[Alimentação dos MT8816 e pull-up do RESET; nunca levar a um GPIO.],[W053],[V12],[Alimentação dos MT8816 e pull-up do RESET; nunca levar a um GPIO.],[W054],[V12],[Alimentação dos MT8816 e pull-up do RESET; nunca levar a um GPIO.],[W055],[V12],[Alimentação dos MT8816 e pull-up do RESET; nunca levar a um GPIO.],[W056],[AX0],[Bit de endereço X compartilhado entre as duas matrizes.])

Registro: instalado por/data: ……………………  continuidade medida por/data: ……………………  observações: ……………………

#pagebreak()
= Fiação 08 — W057 a W064
#grid(columns:(85mm,85mm,1fr),gutter:4mm,image("assets/w08-top.svg",height:164mm),image("assets/w08-bottom.svg",height:164mm),[
#table(columns:(33%,67%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio / rede],[Origem → destino],[W057 / AX0],[U5.15 (QA)
C9/R34
→ U2.5 (AX0)
C26/R49],[W058 / AX1],[U5.1 (QB)
C6/R33
→ U1.22 (AX1)
C12/R63],[W059 / AX1],[U5.1 (QB)
C6/R33
→ U2.22 (AX1)
C32/R63],[W060 / AX2],[U5.2 (QC)
C6/R34
→ U1.23 (AX2)
C12/R62],[W061 / AX2],[U5.2 (QC)
C6/R34
→ U2.23 (AX2)
C32/R62],[W062 / AX3],[U5.3 (QD)
C6/R35
→ U1.4 (AX3)
C6/R48],[W063 / AX3],[U5.3 (QD)
C6/R35
→ U2.4 (AX3)
C26/R48],[W064 / AY0],[U5.4 (QE)
C6/R36
→ U1.24 (AY0)
C12/R61])

TOP à esquerda; inferior espelhada no centro. Coordenadas provisórias. Todos os fios deste grupo devem ser conferidos antes do próximo.
])

#pagebreak()
= Função dos fios — grupo 08
#table(columns:(10%,20%,70%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio],[Rede],[O que faz / por que existe],[W057],[AX0],[Bit de endereço X compartilhado entre as duas matrizes.],[W058],[AX1],[Bit de endereço X compartilhado entre as duas matrizes.],[W059],[AX1],[Bit de endereço X compartilhado entre as duas matrizes.],[W060],[AX2],[Bit de endereço X compartilhado entre as duas matrizes.],[W061],[AX2],[Bit de endereço X compartilhado entre as duas matrizes.],[W062],[AX3],[Bit de endereço X compartilhado entre as duas matrizes.],[W063],[AX3],[Bit de endereço X compartilhado entre as duas matrizes.],[W064],[AY0],[Bit de endereço Y compartilhado entre as duas matrizes.])

Registro: instalado por/data: ……………………  continuidade medida por/data: ……………………  observações: ……………………

#pagebreak()
= Fiação 09 — W065 a W072
#grid(columns:(85mm,85mm,1fr),gutter:4mm,image("assets/w09-top.svg",height:164mm),image("assets/w09-bottom.svg",height:164mm),[
#table(columns:(33%,67%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio / rede],[Origem → destino],[W065 / AY0],[U5.4 (QE)
C6/R36
→ U2.24 (AY0)
C32/R61],[W066 / AY1],[U5.5 (QF)
C6/R37
→ U1.25 (AY1)
C12/R60],[W067 / AY1],[U5.5 (QF)
C6/R37
→ U2.25 (AY1)
C32/R60],[W068 / AY2],[U5.6 (QG)
C6/R38
→ U1.2 (AY2)
C6/R46],[W069 / AY2],[U5.6 (QG)
C6/R38
→ U2.2 (AY2)
C26/R46],[W070 / CHAIN],[U5.9 (QH\_SER)
C9/R40
→ U6.14 (SER)
C27/R35],[W071 / CLK5],[U\_LEVEL.4 (2Y)
C18/R26
→ U5.11 (SRCLK)
C9/R38],[W072 / CLK5],[U\_LEVEL.4 (2Y)
C18/R26
→ U6.11 (SRCLK)
C27/R38])

TOP à esquerda; inferior espelhada no centro. Coordenadas provisórias. Todos os fios deste grupo devem ser conferidos antes do próximo.
])

#pagebreak()
= Função dos fios — grupo 09
#table(columns:(10%,20%,70%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio],[Rede],[O que faz / por que existe],[W065],[AY0],[Bit de endereço Y compartilhado entre as duas matrizes.],[W066],[AY1],[Bit de endereço Y compartilhado entre as duas matrizes.],[W067],[AY1],[Bit de endereço Y compartilhado entre as duas matrizes.],[W068],[AY2],[Bit de endereço Y compartilhado entre as duas matrizes.],[W069],[AY2],[Bit de endereço Y compartilhado entre as duas matrizes.],[W070],[CHAIN],[Encadeamento serial QH\_SER de U5 → SER de U6.],[W071],[CLK5],[Clock serial invertido; o firmware compensa a polaridade.],[W072],[CLK5],[Clock serial invertido; o firmware compensa a polaridade.])

Registro: instalado por/data: ……………………  continuidade medida por/data: ……………………  observações: ……………………

#pagebreak()
= Fiação 10 — W073 a W080
#grid(columns:(85mm,85mm,1fr),gutter:4mm,image("assets/w10-top.svg",height:164mm),image("assets/w10-bottom.svg",height:164mm),[
#table(columns:(33%,67%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio / rede],[Origem → destino],[W073 / CS\_A],[U6.15 (QA)
C27/R34
→ U1.36 (CS)
C12/R49],[W074 / CS\_A],[U6.15 (QA)
C27/R34
→ R8.1 (A)
C12/R35],[W075 / CS\_B],[U6.1 (QB)
C24/R33
→ U2.36 (CS)
C32/R49],[W076 / CS\_B],[U6.1 (QB)
C24/R33
→ R9.1 (A)
C12/R38],[W077 / DATA],[U5.7 (QH)
C6/R39
→ U1.38 (DATA)
C12/R47],[W078 / DATA],[U5.7 (QH)
C6/R39
→ U2.38 (DATA)
C32/R47],[W079 / GPIO14],[J\_ESP\_R.5 (GPIO14)
C24/R7
→ R15.1 (A)
C21/R74],[W080 / GPIO18],[J\_ESP\_L.9 (GPIO18)
C14/R11
→ U\_LEVEL.3 (2A)
C18/R25])

TOP à esquerda; inferior espelhada no centro. Coordenadas provisórias. Todos os fios deste grupo devem ser conferidos antes do próximo.
])

#pagebreak()
= Função dos fios — grupo 10
#table(columns:(10%,20%,70%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio],[Rede],[O que faz / por que existe],[W073],[CS\_A],[Seleção ativa alta do MT8816 A; pull-down mantém inativo.],[W074],[CS\_A],[Seleção ativa alta do MT8816 A; pull-down mantém inativo.],[W075],[CS\_B],[Seleção ativa alta do MT8816 B; pull-down mantém inativo.],[W076],[CS\_B],[Seleção ativa alta do MT8816 B; pull-down mantém inativo.],[W077],[DATA],[Valor escrito no crosspoint: conectar ou desconectar.],[W078],[DATA],[Valor escrito no crosspoint: conectar ou desconectar.],[W079],[GPIO14],[Comando lógico de 3,3 V do ESP32; não ligar diretamente a 5 V/12 V.],[W080],[GPIO18],[Comando lógico de 3,3 V do ESP32; não ligar diretamente a 5 V/12 V.])

Registro: instalado por/data: ……………………  continuidade medida por/data: ……………………  observações: ……………………

#pagebreak()
= Fiação 11 — W081 a W088
#grid(columns:(85mm,85mm,1fr),gutter:4mm,image("assets/w11-top.svg",height:164mm),image("assets/w11-bottom.svg",height:164mm),[
#table(columns:(33%,67%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio / rede],[Origem → destino],[W081 / GPIO18],[J\_ESP\_L.9 (GPIO18)
C14/R11
→ R\_PD\_18.1 (A)
C2/R26],[W082 / GPIO19],[J\_ESP\_L.10 (GPIO19)
C14/R12
→ U\_LEVEL.9 (4A)
C21/R28],[W083 / GPIO19],[J\_ESP\_L.10 (GPIO19)
C14/R12
→ R\_PD\_19.1 (A)
C32/R24],[W084 / GPIO21],[J\_ESP\_L.11 (GPIO21)
C14/R13
→ U\_LEVEL.11 (5A)
C21/R26],[W085 / GPIO21],[J\_ESP\_L.11 (GPIO21)
C14/R13
→ R\_PD\_21.1 (A)
C32/R26],[W086 / GPIO22],[J\_ESP\_L.14 (GPIO22)
C14/R16
→ U\_LEVEL.5 (3A)
C18/R27],[W087 / GPIO22],[J\_ESP\_L.14 (GPIO22)
C14/R16
→ R\_PD\_22.1 (A)
C2/R28],[W088 / GPIO23],[J\_ESP\_L.15 (GPIO23)
C14/R17
→ U\_LEVEL.1 (1A)
C18/R23])

TOP à esquerda; inferior espelhada no centro. Coordenadas provisórias. Todos os fios deste grupo devem ser conferidos antes do próximo.
])

#pagebreak()
= Função dos fios — grupo 11
#table(columns:(10%,20%,70%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio],[Rede],[O que faz / por que existe],[W081],[GPIO18],[Comando lógico de 3,3 V do ESP32; não ligar diretamente a 5 V/12 V.],[W082],[GPIO19],[Comando lógico de 3,3 V do ESP32; não ligar diretamente a 5 V/12 V.],[W083],[GPIO19],[Comando lógico de 3,3 V do ESP32; não ligar diretamente a 5 V/12 V.],[W084],[GPIO21],[Comando lógico de 3,3 V do ESP32; não ligar diretamente a 5 V/12 V.],[W085],[GPIO21],[Comando lógico de 3,3 V do ESP32; não ligar diretamente a 5 V/12 V.],[W086],[GPIO22],[Comando lógico de 3,3 V do ESP32; não ligar diretamente a 5 V/12 V.],[W087],[GPIO22],[Comando lógico de 3,3 V do ESP32; não ligar diretamente a 5 V/12 V.],[W088],[GPIO23],[Comando lógico de 3,3 V do ESP32; não ligar diretamente a 5 V/12 V.])

Registro: instalado por/data: ……………………  continuidade medida por/data: ……………………  observações: ……………………

#pagebreak()
= Fiação 12 — W089 a W096
#grid(columns:(85mm,85mm,1fr),gutter:4mm,image("assets/w12-top.svg",height:164mm),image("assets/w12-bottom.svg",height:164mm),[
#table(columns:(33%,67%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio / rede],[Origem → destino],[W089 / GPIO23],[J\_ESP\_L.15 (GPIO23)
C14/R17
→ R\_PD\_23.1 (A)
C2/R24],[W090 / GPIO25],[J\_ESP\_R.8 (GPIO25)
C24/R10
→ R6.1 (A)
C29/R33],[W091 / GPIO26],[J\_ESP\_R.7 (GPIO26)
C24/R9
→ R13.1 (A)
C20/R51],[W092 / GPIO27],[J\_ESP\_R.6 (GPIO27)
C24/R8
→ R\_LOW\_BASE.1 (A)
C20/R59],[W093 / GPIO34],[J\_ESP\_R.12 (GPIO34)
C24/R14
→ J\_SMART.4 (GPIO34)
C34/R3],[W094 / GPIO34],[J\_ESP\_R.12 (GPIO34)
C24/R14
→ R\_PULSE\_IN.1 (A)
C31/R7],[W095 / HIGH\_B],[Q7.2 (B)
C17/R45
→ R21.2 (B)
C18/R48],[W096 / HIGH\_B],[Q7.2 (B)
C17/R45
→ R30.1 (A)
C20/R48])

TOP à esquerda; inferior espelhada no centro. Coordenadas provisórias. Todos os fios deste grupo devem ser conferidos antes do próximo.
])

#pagebreak()
= Função dos fios — grupo 12
#table(columns:(10%,20%,70%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio],[Rede],[O que faz / por que existe],[W089],[GPIO23],[Comando lógico de 3,3 V do ESP32; não ligar diretamente a 5 V/12 V.],[W090],[GPIO25],[Comando lógico de 3,3 V do ESP32; não ligar diretamente a 5 V/12 V.],[W091],[GPIO26],[Comando lógico de 3,3 V do ESP32; não ligar diretamente a 5 V/12 V.],[W092],[GPIO27],[Comando lógico de 3,3 V do ESP32; não ligar diretamente a 5 V/12 V.],[W093],[GPIO34],[Comando lógico de 3,3 V do ESP32; não ligar diretamente a 5 V/12 V.],[W094],[GPIO34],[Comando lógico de 3,3 V do ESP32; não ligar diretamente a 5 V/12 V.],[W095],[HIGH\_B],[Ligação local do estágio discreto; respeitar base, coletor e emissor conforme esquema.],[W096],[HIGH\_B],[Ligação local do estágio discreto; respeitar base, coletor e emissor conforme esquema.])

Registro: instalado por/data: ……………………  continuidade medida por/data: ……………………  observações: ……………………

#pagebreak()
= Fiação 13 — W097 a W104
#grid(columns:(85mm,85mm,1fr),gutter:4mm,image("assets/w13-top.svg",height:164mm),image("assets/w13-bottom.svg",height:164mm),[
#table(columns:(33%,67%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio / rede],[Origem → destino],[W097 / HIGH\_C],[Q7.1 (C)
C16/R45
→ R17.1 (A)
C15/R54],[W098 / HIGH\_DRV],[Q8.1 (C)
C21/R45
→ R30.2 (B)
C23/R48],[W099 / LATCH5],[U\_LEVEL.6 (3Y)
C18/R28
→ U5.12 (RCLK)
C9/R37],[W100 / LATCH5],[U\_LEVEL.6 (3Y)
C18/R28
→ U6.12 (RCLK)
C27/R37],[W101 / LOW\_C],[Q11.1 (C)
C16/R61
→ R\_LOW\_LIMIT.2 (B)
C18/R64],[W102 / NODE00],[H1.1 (NODE00)
C2/R47
→ U1.33 (X0)
C12/R52],[W103 / NODE01],[H1.2 (NODE01)
C2/R48
→ U1.32 (X1)
C12/R53],[W104 / NODE02],[H1.3 (NODE02)
C2/R49
→ U1.31 (X2)
C12/R54])

TOP à esquerda; inferior espelhada no centro. Coordenadas provisórias. Todos os fios deste grupo devem ser conferidos antes do próximo.
])

#pagebreak()
= Função dos fios — grupo 13
#table(columns:(10%,20%,70%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio],[Rede],[O que faz / por que existe],[W097],[HIGH\_C],[Ligação local do estágio discreto; respeitar base, coletor e emissor conforme esquema.],[W098],[HIGH\_DRV],[Ligação local do estágio discreto; respeitar base, coletor e emissor conforme esquema.],[W099],[LATCH5],[Latch dos registradores, invertido pelo HCT14.],[W100],[LATCH5],[Latch dos registradores, invertido pelo HCT14.],[W101],[LOW\_C],[Ligação local do estágio discreto; respeitar base, coletor e emissor conforme esquema.],[W102],[NODE00],[Liga um nó físico ao X correspondente da matriz; manter sua identidade no cabo.],[W103],[NODE01],[Liga um nó físico ao X correspondente da matriz; manter sua identidade no cabo.],[W104],[NODE02],[Liga um nó físico ao X correspondente da matriz; manter sua identidade no cabo.])

Registro: instalado por/data: ……………………  continuidade medida por/data: ……………………  observações: ……………………

#pagebreak()
= Fiação 14 — W105 a W112
#grid(columns:(85mm,85mm,1fr),gutter:4mm,image("assets/w14-top.svg",height:164mm),image("assets/w14-bottom.svg",height:164mm),[
#table(columns:(33%,67%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio / rede],[Origem → destino],[W105 / NODE03],[H1.4 (NODE03)
C2/R50
→ U1.30 (X3)
C12/R55],[W106 / NODE04],[H1.5 (NODE04)
C2/R51
→ U1.29 (X4)
C12/R56],[W107 / NODE05],[H1.6 (NODE05)
C2/R52
→ U1.28 (X5)
C12/R57],[W108 / NODE06],[H1.7 (NODE06)
C2/R53
→ U1.8 (X6)
C6/R52],[W109 / NODE07],[H1.8 (NODE07)
C2/R54
→ U1.9 (X7)
C6/R53],[W110 / NODE08],[H1.9 (NODE08)
C2/R55
→ U1.10 (X8)
C6/R54],[W111 / NODE09],[H1.10 (NODE09)
C2/R56
→ U1.11 (X9)
C6/R55],[W112 / NODE10],[H1.11 (NODE10)
C2/R57
→ U1.12 (X10)
C6/R56])

TOP à esquerda; inferior espelhada no centro. Coordenadas provisórias. Todos os fios deste grupo devem ser conferidos antes do próximo.
])

#pagebreak()
= Função dos fios — grupo 14
#table(columns:(10%,20%,70%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio],[Rede],[O que faz / por que existe],[W105],[NODE03],[Liga um nó físico ao X correspondente da matriz; manter sua identidade no cabo.],[W106],[NODE04],[Liga um nó físico ao X correspondente da matriz; manter sua identidade no cabo.],[W107],[NODE05],[Liga um nó físico ao X correspondente da matriz; manter sua identidade no cabo.],[W108],[NODE06],[Liga um nó físico ao X correspondente da matriz; manter sua identidade no cabo.],[W109],[NODE07],[Liga um nó físico ao X correspondente da matriz; manter sua identidade no cabo.],[W110],[NODE08],[Liga um nó físico ao X correspondente da matriz; manter sua identidade no cabo.],[W111],[NODE09],[Liga um nó físico ao X correspondente da matriz; manter sua identidade no cabo.],[W112],[NODE10],[Liga um nó físico ao X correspondente da matriz; manter sua identidade no cabo.])

Registro: instalado por/data: ……………………  continuidade medida por/data: ……………………  observações: ……………………

#pagebreak()
= Fiação 15 — W113 a W120
#grid(columns:(85mm,85mm,1fr),gutter:4mm,image("assets/w15-top.svg",height:164mm),image("assets/w15-bottom.svg",height:164mm),[
#table(columns:(33%,67%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio / rede],[Origem → destino],[W113 / NODE11],[H3.1 (NODE11)
C36/R47
→ U2.33 (X0)
C32/R52],[W114 / NODE12],[H3.2 (NODE12)
C36/R48
→ U2.32 (X1)
C32/R53],[W115 / NODE13],[H3.3 (NODE13)
C36/R49
→ U2.31 (X2)
C32/R54],[W116 / NODE14],[H3.4 (NODE14)
C36/R50
→ U2.30 (X3)
C32/R55],[W117 / NODE15],[H3.5 (NODE15)
C36/R51
→ U2.29 (X4)
C32/R56],[W118 / NODE16],[H3.6 (NODE16)
C36/R52
→ U2.28 (X5)
C32/R57],[W119 / NODE17],[H3.7 (NODE17)
C36/R53
→ U2.8 (X6)
C26/R52],[W120 / NODE18],[H3.8 (NODE18)
C36/R54
→ U2.9 (X7)
C26/R53])

TOP à esquerda; inferior espelhada no centro. Coordenadas provisórias. Todos os fios deste grupo devem ser conferidos antes do próximo.
])

#pagebreak()
= Função dos fios — grupo 15
#table(columns:(10%,20%,70%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio],[Rede],[O que faz / por que existe],[W113],[NODE11],[Liga um nó físico ao X correspondente da matriz; manter sua identidade no cabo.],[W114],[NODE12],[Liga um nó físico ao X correspondente da matriz; manter sua identidade no cabo.],[W115],[NODE13],[Liga um nó físico ao X correspondente da matriz; manter sua identidade no cabo.],[W116],[NODE14],[Liga um nó físico ao X correspondente da matriz; manter sua identidade no cabo.],[W117],[NODE15],[Liga um nó físico ao X correspondente da matriz; manter sua identidade no cabo.],[W118],[NODE16],[Liga um nó físico ao X correspondente da matriz; manter sua identidade no cabo.],[W119],[NODE17],[Liga um nó físico ao X correspondente da matriz; manter sua identidade no cabo.],[W120],[NODE18],[Liga um nó físico ao X correspondente da matriz; manter sua identidade no cabo.])

Registro: instalado por/data: ……………………  continuidade medida por/data: ……………………  observações: ……………………

#pagebreak()
= Fiação 16 — W121 a W128
#grid(columns:(85mm,85mm,1fr),gutter:4mm,image("assets/w16-top.svg",height:164mm),image("assets/w16-bottom.svg",height:164mm),[
#table(columns:(33%,67%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio / rede],[Origem → destino],[W121 / NODE19],[H3.9 (NODE19)
C36/R55
→ U2.10 (X8)
C26/R54],[W122 / NODE20],[H3.10 (NODE20)
C36/R56
→ U2.11 (X9)
C26/R55],[W123 / NODE21],[H3.11 (NODE21)
C36/R57
→ U2.12 (X10)
C26/R56],[W124 / OE\_N5],[U\_LEVEL.10 (5Y)
C21/R27
→ U5.13 (OE\_N)
C9/R36],[W125 / OE\_N5],[U\_LEVEL.10 (5Y)
C21/R27
→ U6.13 (OE\_N)
C27/R36],[W126 / PULSE\_BUS],[U1.37 (Y1)
C12/R48
→ U2.37 (Y1)
C32/R48],[W127 / PULSE\_BUS],[U1.37 (Y1)
C12/R48
→ R17.2 (B)
C18/R54],[W128 / PULSE\_BUS],[U1.37 (Y1)
C12/R48
→ R\_LOW\_LIMIT.1 (A)
C15/R64])

TOP à esquerda; inferior espelhada no centro. Coordenadas provisórias. Todos os fios deste grupo devem ser conferidos antes do próximo.
])

#pagebreak()
= Função dos fios — grupo 16
#table(columns:(10%,20%,70%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio],[Rede],[O que faz / por que existe],[W121],[NODE19],[Liga um nó físico ao X correspondente da matriz; manter sua identidade no cabo.],[W122],[NODE20],[Liga um nó físico ao X correspondente da matriz; manter sua identidade no cabo.],[W123],[NODE21],[Liga um nó físico ao X correspondente da matriz; manter sua identidade no cabo.],[W124],[OE\_N5],[Habilitação ativa baixa das saídas dos registradores.],[W125],[OE\_N5],[Habilitação ativa baixa das saídas dos registradores.],[W126],[PULSE\_BUS],[Serviço de saída ALTO/BAIXO; sempre após os resistores de 470 Ω.],[W127],[PULSE\_BUS],[Serviço de saída ALTO/BAIXO; sempre após os resistores de 470 Ω.],[W128],[PULSE\_BUS],[Serviço de saída ALTO/BAIXO; sempre após os resistores de 470 Ω.])

Registro: instalado por/data: ……………………  continuidade medida por/data: ……………………  observações: ……………………

#pagebreak()
= Fiação 17 — W129 a W136
#grid(columns:(85mm,85mm,1fr),gutter:4mm,image("assets/w17-top.svg",height:164mm),image("assets/w17-bottom.svg",height:164mm),[
#table(columns:(33%,67%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio / rede],[Origem → destino],[W129 / Q10\_B],[Q10.2 (B)
C22/R69
→ R15.2 (B)
C24/R74],[W130 / Q10\_B],[Q10.2 (B)
C22/R69
→ R16.1 (A)
C26/R72],[W131 / Q11\_B],[Q11.2 (B)
C17/R61
→ R\_LOW\_BASE.2 (B)
C23/R59],[W132 / Q11\_B],[Q11.2 (B)
C17/R61
→ R\_LOW\_PD.1 (A)
C20/R62],[W133 / Q6\_B],[Q6.2 (B)
C32/R31
→ R6.2 (B)
C32/R33],[W134 / Q6\_B],[Q6.2 (B)
C32/R31
→ R12.1 (A)
C31/R35],[W135 / Q8\_B],[Q8.2 (B)
C22/R45
→ R13.2 (B)
C23/R51],[W136 / Q8\_B],[Q8.2 (B)
C22/R45
→ R14.1 (A)
C20/R54])

TOP à esquerda; inferior espelhada no centro. Coordenadas provisórias. Todos os fios deste grupo devem ser conferidos antes do próximo.
])

#pagebreak()
= Função dos fios — grupo 17
#table(columns:(10%,20%,70%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio],[Rede],[O que faz / por que existe],[W129],[Q10\_B],[Ligação local do estágio discreto; respeitar base, coletor e emissor conforme esquema.],[W130],[Q10\_B],[Ligação local do estágio discreto; respeitar base, coletor e emissor conforme esquema.],[W131],[Q11\_B],[Ligação local do estágio discreto; respeitar base, coletor e emissor conforme esquema.],[W132],[Q11\_B],[Ligação local do estágio discreto; respeitar base, coletor e emissor conforme esquema.],[W133],[Q6\_B],[Ligação local do estágio discreto; respeitar base, coletor e emissor conforme esquema.],[W134],[Q6\_B],[Ligação local do estágio discreto; respeitar base, coletor e emissor conforme esquema.],[W135],[Q8\_B],[Ligação local do estágio discreto; respeitar base, coletor e emissor conforme esquema.],[W136],[Q8\_B],[Ligação local do estágio discreto; respeitar base, coletor e emissor conforme esquema.])

Registro: instalado por/data: ……………………  continuidade medida por/data: ……………………  observações: ……………………

#pagebreak()
= Fiação 18 — W137 a W144
#grid(columns:(85mm,85mm,1fr),gutter:4mm,image("assets/w18-top.svg",height:164mm),image("assets/w18-bottom.svg",height:164mm),[
#table(columns:(33%,67%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio / rede],[Origem → destino],[W137 / RESET12],[U1.3 (RESET)
C6/R47
→ U2.3 (RESET)
C26/R47],[W138 / RESET12],[U1.3 (RESET)
C6/R47
→ Q6.1 (C)
C31/R31],[W139 / RESET12],[U1.3 (RESET)
C6/R47
→ R7.2 (B)
C34/R37],[W140 / SENSE\_A],[J\_SMART.1 (SENSE\_A)
C31/R3
→ U1.1 (Y3)
C6/R45],[W141 / SENSE\_A],[J\_SMART.1 (SENSE\_A)
C31/R3
→ U2.1 (Y3)
C26/R45],[W142 / SENSE\_B],[J\_SMART.3 (SENSE\_B)
C33/R3
→ U1.21 (Y4)
C12/R64],[W143 / SENSE\_B],[J\_SMART.3 (SENSE\_B)
C33/R3
→ U2.21 (Y4)
C32/R64],[W144 / SER5],[U\_LEVEL.2 (1Y)
C18/R24
→ U5.14 (SER)
C9/R35])

TOP à esquerda; inferior espelhada no centro. Coordenadas provisórias. Todos os fios deste grupo devem ser conferidos antes do próximo.
])

#pagebreak()
= Função dos fios — grupo 18
#table(columns:(10%,20%,70%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio],[Rede],[O que faz / por que existe],[W137],[RESET12],[RESET ativo alto da matriz; Q6 libera ao puxar para GND.],[W138],[RESET12],[RESET ativo alto da matriz; Q6 libera ao puxar para GND.],[W139],[RESET12],[RESET ativo alto da matriz; Q6 libera ao puxar para GND.],[W140],[SENSE\_A],[Primeiro nó selecionado para medição externa com divisor.],[W141],[SENSE\_A],[Primeiro nó selecionado para medição externa com divisor.],[W142],[SENSE\_B],[Segundo nó selecionado para medição externa com divisor.],[W143],[SENSE\_B],[Segundo nó selecionado para medição externa com divisor.],[W144],[SER5],[Dados seriais invertidos pelo HCT14 para o primeiro registrador.])

Registro: instalado por/data: ……………………  continuidade medida por/data: ……………………  observações: ……………………

#pagebreak()
= Fiação 19 — W145 a W152
#grid(columns:(85mm,85mm,1fr),gutter:4mm,image("assets/w19-top.svg",height:164mm),image("assets/w19-bottom.svg",height:164mm),[
#table(columns:(33%,67%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio / rede],[Origem → destino],[W145 / STROBE5],[U\_LEVEL.8 (4Y)
C21/R29
→ U1.18 (STROBE)
C6/R62],[W146 / STROBE5],[U\_LEVEL.8 (4Y)
C21/R29
→ U2.18 (STROBE)
C26/R62],[W147 / TEST\_B],[Q9.2 (B)
C17/R69
→ R24.2 (B)
C17/R72],[W148 / TEST\_B],[Q9.2 (B)
C17/R69
→ R27.1 (A)
C21/R72],[W149 / TEST\_BUS],[U1.39 (Y2)
C12/R46
→ U2.39 (Y2)
C32/R46],[W150 / TEST\_BUS],[U1.39 (Y2)
C12/R46
→ R18.2 (B)
C11/R72],[W151 / TEST\_C],[Q9.1 (C)
C16/R69
→ R18.1 (A)
C8/R72],[W152 / TEST\_DRV],[Q10.1 (C)
C21/R69
→ R27.2 (B)
C24/R72])

TOP à esquerda; inferior espelhada no centro. Coordenadas provisórias. Todos os fios deste grupo devem ser conferidos antes do próximo.
])

#pagebreak()
= Função dos fios — grupo 19
#table(columns:(10%,20%,70%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Fio],[Rede],[O que faz / por que existe],[W145],[STROBE5],[Escrita da matriz, compartilhada; CS escolhe o chip.],[W146],[STROBE5],[Escrita da matriz, compartilhada; CS escolhe o chip.],[W147],[TEST\_B],[Ligação local do estágio discreto; respeitar base, coletor e emissor conforme esquema.],[W148],[TEST\_B],[Ligação local do estágio discreto; respeitar base, coletor e emissor conforme esquema.],[W149],[TEST\_BUS],[Estímulo de continuidade após resistor de 10 kΩ.],[W150],[TEST\_BUS],[Estímulo de continuidade após resistor de 10 kΩ.],[W151],[TEST\_C],[Ligação local do estágio discreto; respeitar base, coletor e emissor conforme esquema.],[W152],[TEST\_DRV],[Ligação local do estágio discreto; respeitar base, coletor e emissor conforme esquema.])

Registro: instalado por/data: ……………………  continuidade medida por/data: ……………………  observações: ……………………

#pagebreak()
= 6 — Conectores externos: alimentação e placa inteligente
#table(columns:(17%,45%,38%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Cabo],[Origem/destino],[Função],[H2.1],[Saída regulada 12 V da fonte → roteador],[Alimenta MT8816 e RESET. Confirmar que a fonte existente disponibiliza 12 V.],[H2.2],[Saída regulada 5 V da fonte → roteador],[Alimenta lógica HCT/HC e estágios de saída.],[H2.3],[NC],[Manter vazio; não conectar o antigo fio de 3,3 V.],[H2.4],[GND da fonte → roteador],[Retorno comum.],[J\_SMART.1],[SENSE\_A → entrada A\_RAW/J\_ROUTER.1 da placa inteligente],[Primeiro nó analógico selecionado; precisa de divisor antes do ADC.],[J\_SMART.2],[GND → J\_ROUTER.2 da placa inteligente],[Referência comum entre placas.],[J\_SMART.3],[SENSE\_B → B\_RAW/J\_ROUTER.3 da placa inteligente],[Segundo nó selecionado; precisa de divisor antes do ADC.],[J\_SMART.4],[GPIO27 da placa inteligente → GPIO34 do roteador],[Pedido de pulso de 3,3 V. Pull-down R\_PULSE\_IN no receptor.])

Os números são por função elétrica; conferir a posição física do conector comprado e etiquetar o pino 1. Não ligar 5 V/12 V ao J\_SMART. A placa inteligente e o roteador usam ESP32 distintos: ADC34 da inteligente não é PULSE\_IN34 do roteador.

O ESP32 roteador é USB no candidato. Não ligar VIN/5 V dele em paralelo à alimentação externa. Conectar sinais entre placas somente com ambas alimentadas corretamente; não aplicar sinais a um ESP32 desligado. Conectores das telas, joystick, NFC e Pi continuam na placa inteligente.

#pagebreak()
= 7 — Nós da bancada e barramentos internos
#table(columns:(20%,40%,40%),inset:4pt,stroke:.4pt+rgb("aabbc7"),[Pino dos conectores],[H1 / MT A],[H3 / MT B],[1],[NODE00 → X0],[NODE11 → X0],[2],[NODE01 → X1],[NODE12 → X1],[3],[NODE02 → X2],[NODE13 → X2],[4],[NODE03 → X3],[NODE14 → X3],[5],[NODE04 → X4],[NODE15 → X4],[6],[NODE05 → X5],[NODE16 → X5],[7],[NODE06 → X6],[NODE17 → X6],[8],[NODE07 → X7],[NODE18 → X7],[9],[NODE08 → X8],[NODE19 → X8],[10],[NODE09 → X9],[NODE20 → X9],[11],[NODE10 → X10],[NODE21 → X10])

Y0 = GND; Y1 = PULSE\_BUS; Y2 = TEST\_BUS; Y3 = SENSE\_A; Y4 = SENSE\_B. Y5/Y6/Y7 são privados de cada metade e ficam sem fio externo neste candidato. Não unir Y5 de A a Y5 de B etc.

Para ligar dois nós de uma mesma metade, o firmware fecha seus X no mesmo Y privado. Há três barramentos privados por metade. As metades compartilham serviços e GND; não são galvanicamente isoladas. Serviços compartilhados não podem conectar acidentalmente dois circuitos ativos. Um par é medido por vez e apenas uma saída é estimulada por vez.

#pagebreak()
= 8 — Testes antes de conectar a bancada
+ Com tudo desligado e CIs/ESP32 fora dos soquetes: comparar todas as Wxxx com a lista, verificar pinos NC, medir bordas isoladas e ausência de ligação direta 12 V–5 V–GND.
+ Conferir as fontes em separado com multímetro. Capacitores podem causar indicação transitória de continuidade; curto persistente precisa ser resolvido. Não inserir chips com energia ligada.
+ Validar RESET e adaptação antes da matriz. HCT14 alimentado em 5 V, entradas de 3,3 V. Não substituir por HC14. Confirmar RESET em 12 V sem comando de liberação e próximo de GND quando Q6 conduz, antes de conectar à matriz.
+ Executar firmware específico de roteamento para verificar registradores e endereços. Ele ainda não foi entregue com este guia. O teste dos OLEDs/joystick não controla esta placa.
+ Testar cada X0–X10 de A e B com carga/estímulo limitados e instrumento; verificar seleção correta e ausência de rotas indesejadas. Verificar a codificação física de X, que não é linear em toda a faixa do MT8816.
+ Qualificar os estágios ALTO/BAIXO/TESTE com fonte limitada e carga conhecida antes de ligá-los aos pogos. Medir corrente e tensão sob carga e registrar quedas de RON e resistores.
+ Conectar a placa inteligente: medir SENSE\_A/B com 0 V, tensão intermediária conhecida e 5 V dentro do limite do divisor; conferir ADC sem ultrapassar 3,3 V. Calibrar os dois canais.
+ Testar continuidade em circuito desenergizado com aberto, curto e resistor conhecidos. Resultado incerto não libera operação; retirar estímulo antes da autorização de energia.
+ Testar reset, cabo removido e perda de comunicação. A saída deve voltar a desligado; não assumir proteção contra ESP32 travado sem watchdog físico.

#pagebreak()
= 9 — Limites que não desaparecem com a montagem
*Medição:* o divisor 10 kΩ/10 kΩ tem entrada de aproximadamente 20 kΩ e carrega o circuito. Não atende ao requisito final de pelo menos 1 MΩ. Não garante continuidade de 20 Ω/100 Ω nem identifica isoladamente um pogo quando há caminhos paralelos.

*Saída:* dois resistores separados de 470 Ω limitam a corrente de ALTO/BAIXO. Sob carga de 2 mA, só o resistor causa cerca de 0,94 V de queda; portanto os níveis finais exigidos não estão garantidos. A corrente ideal com 5,25 V/470 Ω a −1% é aproximadamente 11,29 mA; isso não qualifica transientes nem corrente agregada num pino compartilhado de matriz. O estímulo de 10 kΩ fica em torno de 0,531 mA nesse mesmo limite de fonte.

*Proteção:* proteção da fonte não substitui limitação local, intertravamentos e watchdog. Manter ALTO, BAIXO e TESTE desligados no boot. O fio PULSE\_IN não representa sozinho os três estados alto, baixo e desconectado; o modo autorizado do roteador define quando a saída existe.

*Fabricação:* este guia é de perfboard. O candidato de PCB corroída em uma face teve tentativas de roteamento reprovadas; não usar estes desenhos como fotolito. Furos, corpos e cabos precisam de dry-fit; a quantidade real de linhas/colunas permanece pendente.

*Aceitação:* registrar tensões, correntes, cargas, instrumentos, firmware e fotos. Nenhum check de software deste documento representa medida ou liberação de um checkpoint físico.

#pagebreak()
= Esquema elétrico — ESP32
Rótulos iguais unem redes entre folhas. Exportação nativa tscircuit do candidato existente; o esquema não representa fios por baixo da perfboard.
#align(center,image("assets/ESP32.svg",width:265mm,height:150mm,fit:"contain"))

#pagebreak()
= Esquema elétrico — AdaptacaoControle
Rótulos iguais unem redes entre folhas. Exportação nativa tscircuit do candidato existente; o esquema não representa fios por baixo da perfboard.
#align(center,image("assets/AdaptacaoControle.svg",width:265mm,height:150mm,fit:"contain"))

#pagebreak()
= Esquema elétrico — Registros
Rótulos iguais unem redes entre folhas. Exportação nativa tscircuit do candidato existente; o esquema não representa fios por baixo da perfboard.
#align(center,image("assets/Registros.svg",width:265mm,height:150mm,fit:"contain"))

#pagebreak()
= Esquema elétrico — MatrizA
Rótulos iguais unem redes entre folhas. Exportação nativa tscircuit do candidato existente; o esquema não representa fios por baixo da perfboard.
#align(center,image("assets/MatrizA.svg",width:265mm,height:150mm,fit:"contain"))

#pagebreak()
= Esquema elétrico — MatrizB
Rótulos iguais unem redes entre folhas. Exportação nativa tscircuit do candidato existente; o esquema não representa fios por baixo da perfboard.
#align(center,image("assets/MatrizB.svg",width:265mm,height:150mm,fit:"contain"))

#pagebreak()
= Esquema elétrico — Pulso
Rótulos iguais unem redes entre folhas. Exportação nativa tscircuit do candidato existente; o esquema não representa fios por baixo da perfboard.
#align(center,image("assets/Pulso.svg",width:265mm,height:150mm,fit:"contain"))

#pagebreak()
= Esquema elétrico — Continuidade
Rótulos iguais unem redes entre folhas. Exportação nativa tscircuit do candidato existente; o esquema não representa fios por baixo da perfboard.
#align(center,image("assets/Continuidade.svg",width:265mm,height:150mm,fit:"contain"))

#pagebreak()
= Esquema elétrico — Interfaces
Rótulos iguais unem redes entre folhas. Exportação nativa tscircuit do candidato existente; o esquema não representa fios por baixo da perfboard.
#align(center,image("assets/Interfaces.svg",width:265mm,height:150mm,fit:"contain"))

#pagebreak()
= Esquema elétrico — AdaptadorHCT
Rótulos iguais unem redes entre folhas. Exportação nativa tscircuit do candidato existente; o esquema não representa fios por baixo da perfboard.
#align(center,image("assets/AdaptadorHCT.svg",width:265mm,height:150mm,fit:"contain"))
