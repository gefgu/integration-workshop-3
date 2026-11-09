#set page(paper:"a4",flipped:true,margin:12mm,footer:context [Roteador • PCB de uma face • candidato V2 • 30/10/2026 • #counter(page).display()])
#set text(font:"DejaVu Sans",size:10pt,lang:"pt")
#set par(leading:.6em)
= Nova placa de roteamento — PCB de uma face
*100 × 200 mm • dois MT8816 em 12 V • dois 74HC595 + 74HCT14 em 5 V*

Este candidato tem *uma única face de cobre e 59 pontes de fio isolado* no lado dos componentes. Não há uma segunda camada de cobre escondida: cada JP é um fio a instalar entre duas ilhas WP dedicadas. São 106 ilhas WP reservadas; parte delas fica vazia no resultado final.

O esquema elétrico simplificado foi preservado. O posicionamento mudou: matrizes horizontais, uma acima da outra; saídas de cada banco em um conector de 6 pinos e outro de 5 pinos; RESET junto da área superior direita. A placa inteligente já soldada não muda.

*Resultado em software:* pinos, redes, posicionamento, afastamentos, sobreposição de trilhas e continuidade dos trechos passaram. A conectividade montada inclui explicitamente as pontes. O check independente de curtos sobre cobre exportado e o check de estilo também passaram.

*Estado físico:* protótipo para revisão. Encaixe dos componentes comprados, orientação da transferência, tolerância de furação e funcionamento energizado ainda não foram medidos. Conferir as provas 1:1 antes da corrosão. As limitações elétricas da simplificação permanecem.

Não confundir os números: há 50 referências funcionais, o módulo ESP32 e seus soquetes, 106 características de PCB para fios e 59 fios JP. As ilhas WP não são 106 componentes a comprar.

#pagebreak()
= 1 — O que está no cobre e o que é fio
As 198 polilinhas de cobre incluem as ligações principais e os pequenos acessos às ilhas WP. São trilhas com largura nominal de 0,5 mm; o roteador solicitou 0,35 mm de margem e a verificação do modelo usa seus limites mínimos de folga. Trilhas da mesma rede podem se encontrar; redes diferentes não podem se cruzar em cobre.

As pontes JP ficam acima da placa, com isolamento em toda a extensão e apenas as pontas desencapadas. A furação WP é nominalmente 0,8 mm e sua ilha circular tem 1,8 mm. Usar fio fino compatível com o furo e com a quantidade de pontas no mesmo ponto; conferir no encaixe real. Não substituir pontes que se cruzam por arames nus.

O total geométrico dos percursos dos fios é aproximadamente 3.38 m. Isso não é quantidade de compra nem lista de corte: acrescentar folga para curvas, passagem por cima de outros fios e soldagem. Cortar e ajustar um fio por vez.

As coordenadas X/Y das tabelas são em milímetros a partir do canto superior esquerdo na vista dos componentes. A vista inferior é espelhada, mas as coordenadas continuam identificando a posição TOP. Os últimos desenhos são provas 1:1 e não devem ser ajustados ao tamanho da página.

O motor representa a única face por “top” no Circuit JSON. A montagem física proposta tem componentes de um lado e cobre do outro. Usar a vista inferior espelhada para conferir o lado do cobre e validar a inversão com o profissional conforme o processo de transferência; não presumir a orientação pela palavra “top” do arquivo.

#pagebreak()
= 2 — Distribuição dos componentes e vista do cobre
#grid(columns:(86mm,86mm,1fr),gutter:5mm,image("assets/assembly-top.svg",height:167mm),image("assets/copper-bottom.svg",height:167mm),[
À esquerda: componentes vistos de cima, com cobre em transparência. No centro: face do cobre vista por baixo.

O retângulo azul indica envelope conservador de 33 × 55 mm do ESP32, ainda sem medição da peça. O módulo/USB pode avançar cerca de 7,5 mm além da borda superior; conferir o suporte e o gabinete. Os soquetes permanecem dentro do contorno.

MT8816 A: U1. MT8816 B: U2. Registradores: U5/U6. Adaptador: U\_LEVEL. Q6: RESET em 12 V. Os demais transistores ficam nos blocos ALTO/BAIXO/TESTE.

O círculo marca pino 1. Confirmar entalhes e a pinagem C/B/E das peças compradas. Não usar apenas o desenho externo do transistor para identificar seus terminais.
])

#pagebreak()
= 3 — Visão das pontes no lado dos componentes
#grid(columns:(90mm,1fr),gutter:8mm,image("assets/all-bridges.svg",height:169mm),[
São *59 pontes*, instaladas por grupos nas páginas seguintes. As linhas coloridas são fios isolados; as cinzas são trilhas na face oposta.

Os percursos dos fios foram calculados pelo motor nativo contornando os envelopes dos componentes e o espaço previsto do ESP32. Cruzamentos entre os fios continuam possíveis e exigem isolamento; não são junções elétricas.

As ilhas WP sem ponte permanecem sem fio. Elas são acessos reservados no projeto, não jumpers a fechar automaticamente. A lista JP é a referência para saber o que conectar.

Depois da furação e antes da solda, imprimir as provas 1:1 e conferir soquetes, capacitores e conectores reais. Inspecionar também os anéis de cobre dos furos de 1 mm, cuja margem é menor em alguns footprints originais.

*Não são 59 pedaços de trilha cruzando:* há somente cobre planar. Cada travessia que não coube é uma conexão externa de fio, com duas ilhas e identificação próprias.
])

#pagebreak()
= 4 — Componentes e materiais
#table(columns:(27%,15%,58%),inset:5pt,stroke:.4pt+rgb("b7c5cd"),[Grupo],[Quantidade],[Observação],[MT8816],[2],[U1/U2, DIP40 assumido; confirmar o encapsulamento comprado.],[74HC595],[2],[U5/U6; conservar esta família em 5 V com o adaptador.],[74HCT14],[1],[U\_LEVEL; não trocar por 74HC14 sem rever os limiares.],[Transistores],[6],[BC548B/BC557B conforme BOM; conferir C/B/E.],[Resistores],[24],[Inclui cinco pull-downs e limitadores de saída; valores na BOM.],[Capacitores],[7],[Cinco de 100 nF e dois eletrolíticos de 47 µF.],[Conectores / soquetes do ESP32],[8],[Inclui os quatro conectores de nós e duas fileiras do ESP32.],[Soquetes DIP],[5],[Dois DIP40, dois DIP16 e um DIP14, além das referências funcionais.],[Pontes isoladas],[59],[Fio fino para furos WP de 0,8 mm; deixar folga para montagem.])

Capacitores eletrolíticos: positivo no pino 1. Usar tensão nominal acima da alimentação: por exemplo 16 V no barramento de 5 V e 25 V no de 12 V. Os resistores de 470 Ω e o limitador de teste de 10 kΩ devem ser 1%. Os conectores não têm MPN de compra definido. Os TO-92 usam padrão triangular de 1,27 mm com ilhas redondas de 1,4 mm e furos de 0,8 mm; conferir C/B/E e a formação das pernas antes da corrosão. Os furos não exigem metalização: terminais e fios são soldados na única face de cobre; não há vias entre camadas.

#pagebreak()
= BOM e posicionamento — 1
#table(columns:(20%,35%,30%,15%),inset:5pt,stroke:.4pt+rgb("b7c5cd"),[Ref],[Valor],[Centro X/Y TOP (mm)],[Rotação CAD],[J\_ESP\_L],[Conector sem modelo comprado],[37.30 / 20.00],[270°],[J\_ESP\_R],[Conector sem modelo comprado],[62.70 / 20.00],[270°],[Q6],[BC548B],[85.00 / 18.00],[0°],[R6],[10k],[85.00 / 23.00],[0°],[R12],[100k],[85.00 / 28.00],[0°],[R7],[47k],[88.00 / 33.00],[0°],[U5],[74HC595],[27.00 / 65.00],[0°],[U6],[74HC595],[73.00 / 65.00],[0°],[C4],[100nF],[15.00 / 65.00],[0°],[C5],[100nF],[85.00 / 78.00],[0°],[R8],[10k],[41.00 / 70.00],[0°],[R9],[10k],[59.00 / 70.00],[0°],[U1],[MT8816AE1],[50.00 / 93.00],[90°],[C1],[100nF],[15.00 / 93.00],[0°],[H1],[Conector sem modelo comprado],[50.00 / 80.00],[0°],[U2],[MT8816AE1],[50.00 / 125.00],[90°],[C2],[100nF],[85.00 / 125.00],[0°])

Centro é referência de posicionamento do footprint. Não confundir com coordenada do pino 1. Conferir a numeração nos esquemas e nas provas 1:1.

#pagebreak()
= BOM e posicionamento — 2
#table(columns:(20%,35%,30%,15%),inset:5pt,stroke:.4pt+rgb("b7c5cd"),[Ref],[Valor],[Centro X/Y TOP (mm)],[Rotação CAD],[H3],[Conector sem modelo comprado],[50.00 / 112.00],[0°],[Q7],[BC557B],[16.00 / 164.00],[0°],[Q8],[BC548B],[30.00 / 164.00],[0°],[R21],[47k],[16.00 / 172.00],[0°],[R30],[4.7k],[30.00 / 172.00],[0°],[R13],[10k],[30.00 / 180.00],[180°],[R14],[100k],[30.00 / 188.00],[0°],[R17],[470],[16.00 / 188.00],[0°],[Q11],[BC548B],[84.00 / 164.00],[0°],[R\_LOW\_BASE],[4.7k],[84.00 / 172.00],[0°],[R\_LOW\_PD],[100k],[84.00 / 180.00],[0°],[R\_LOW\_LIMIT],[470],[84.00 / 188.00],[0°],[Q9],[BC557B],[46.00 / 164.00],[0°],[Q10],[BC548B],[60.00 / 164.00],[0°],[R24],[47k],[46.00 / 172.00],[0°],[R27],[10k],[60.00 / 172.00],[0°],[R15],[10k],[60.00 / 180.00],[180°])

Centro é referência de posicionamento do footprint. Não confundir com coordenada do pino 1. Conferir a numeração nos esquemas e nas provas 1:1.

#pagebreak()
= BOM e posicionamento — 3
#table(columns:(20%,35%,30%,15%),inset:5pt,stroke:.4pt+rgb("b7c5cd"),[Ref],[Valor],[Centro X/Y TOP (mm)],[Rotação CAD],[R16],[100k],[60.00 / 188.00],[0°],[R18],[10k],[46.00 / 188.00],[0°],[H2],[Conector sem modelo comprado],[6.00 / 174.00],[270°],[J\_SMART],[Conector sem modelo comprado],[94.00 / 174.00],[270°],[R\_PULSE\_IN],[47k],[50.00 / 151.00],[0°],[C\_BULK5],[47uF],[23.00 / 34.00],[0°],[C\_BULK12],[47uF],[77.00 / 34.00],[180°],[U\_LEVEL],[74HCT14],[50.00 / 53.00],[0°],[R\_PD\_23],[47k],[22.00 / 45.00],[0°],[R\_PD\_18],[47k],[36.00 / 47.00],[0°],[R\_PD\_22],[47k],[36.00 / 43.00],[0°],[R\_PD\_19],[47k],[64.00 / 47.00],[0°],[R\_PD\_21],[47k],[78.00 / 45.00],[0°],[C\_LEVEL],[100nF],[62.00 / 53.00],[0°],[H1B],[Conector sem modelo comprado],[48.73 / 106.00],[0°],[H3B],[Conector sem modelo comprado],[48.73 / 138.00],[0°])

Centro é referência de posicionamento do footprint. Não confundir com coordenada do pino 1. Conferir a numeração nos esquemas e nas provas 1:1.

#pagebreak()
= 5 — Saídas dos 22 nós: quatro conectores
#table(columns:(18%,12%,35%,35%),inset:5pt,stroke:.4pt+rgb("b7c5cd"),[Conector],[Pinos],[Nós em ordem],[Destino na matriz],[H1],[6],[NODE00 a NODE05],[U1: X0 a X5],[H1B],[5],[NODE06 a NODE10],[U1: X6 a X10],[H3],[6],[NODE11 a NODE16],[U2: X0 a X5],[H3B],[5],[NODE17 a NODE21],[U2: X6 a X10])

O chicote muda em relação aos dois conectores antigos de 11 pinos: antigos H1.1–6 → H1.1–6; antigos H1.7–11 → H1B.1–5. O mesmo vale para H3/H3B. Etiquetar ambas as pontas e testar cada nó antes de conectar aos pogos.

Y0 = GND; Y1 = PULSE\_BUS; Y2 = TEST\_BUS; Y3 = SENSE\_A; Y4 = SENSE\_B. Y5/Y6/Y7 permanecem privados de cada metade, sem união física entre A e B. As metades compartilham serviços/GND e não são galvanicamente isoladas. Um par é medido e uma saída é estimulada por vez.

#pagebreak()
= 6 — Alimentação e placa inteligente
#table(columns:(23%,42%,35%),inset:5pt,stroke:.4pt+rgb("b7c5cd"),[Conector / pino],[O que ligar],[Função],[H2.1],[12 V regulados da fonte],[VDD dos MT8816 e pull-up do RESET.],[H2.2],[5 V regulados da fonte],[Lógica e estágios de saída/teste.],[H2.3],[NC — manter sem fio],[Não conectar a antiga alimentação de 3,3 V.],[H2.4],[GND da fonte],[Referência comum.],[J\_SMART.1],[J\_ROUTER.1 / A\_RAW da placa inteligente],[Primeiro sinal selecionado para medição.],[J\_SMART.2],[J\_ROUTER.2 / GND],[Referência comum entre as placas.],[J\_SMART.3],[J\_ROUTER.3 / B\_RAW],[Segundo sinal selecionado para medição.],[J\_SMART.4],[J\_ROUTER.4 / GPIO27 da placa inteligente],[Pedido de pulso 3,3 V → GPIO34 do roteador.])

A/B precisam dos divisores antes do ADC da placa inteligente; não levar 5 V direto a GPIO. O ESP32 roteador é alimentado pelo USB, sem ligar VIN/5 V à fonte externa em paralelo. Confirmar os 12 V disponíveis na placa de energia. Os cabos OLED, NFC, joystick e UART da placa inteligente não mudam.

#pagebreak()
= 7 — Ordem de montagem e testes
+ Conferir dimensões reais e prova 1:1. Validar lado de transferência, pino 1 e ordem dos conectores com o profissional. Confirmar diâmetros de furo antes de corroer.
+ Depois da corrosão/furação, inspecionar e medir trilhas antes de montar. Redes interrompidas por pontes estarão abertas até a instalação dos JP; não improvisar fechamentos pelo nome da rede.
+ Soldar soquetes, conectores e passivos com tudo desligado, mantendo os CIs e ESP32 fora dos soquetes. Identificar positivo/negativo dos capacitores e terminais dos transistores.
+ Instalar as pontes JP por grupos, usando as ilhas WP e os percursos das páginas seguintes. Manter isolamento nos cruzamentos e passagem livre para inserir/remover os CIs.
+ Sem CIs, conferir curto persistente entre GND/5 V/12 V. Medir a fonte nos soquetes: MT8816 pino 40 recebe 12 V; HC595 pino 16 e HCT14 pino 14 recebem 5 V. Desligar e descarregar antes de inserir componentes.
+ Testar RESET e registradores com firmware específico. O sketch de telas/joystick não controla este roteador. Confirmar que as saídas ficam desligadas no boot e que OE/RESET respeitam o estado seguro.
+ Testar cada nó e seleção da matriz com estímulo limitado e instrumento. Qualificar ALTO, BAIXO e TESTE antes de conectar aos pogos; não ativar ALTO e BAIXO simultaneamente.
+ Calibrar SENSE\_A/B com a placa inteligente; testar aberto, curto e resistência conhecida com o experimento desenergizado. Retirar o estímulo antes da autorização de operação.
+ Registrar tensões, correntes, firmware, instrumentos e resultado. Reinício/falha não pode energizar automaticamente. O desligamento em ESP32 travado exige watchdog físico, ainda pendente neste candidato.

#pagebreak()
= Instalar pontes — grupo 01
#grid(columns:(86mm,1fr),gutter:7mm,image("assets/bridges-01.svg",height:169mm),[
#table(columns:(19%,28%,28%,25%),inset:5pt,stroke:.4pt+rgb("b7c5cd"),[Ponte / rede],[Primeira ilha],[Segunda ilha],[Comprimento plano],[JP01 / GND],[WP062
X=31.4; Y=4.8 mm],[WP103
X=57.0; Y=48.8 mm],[91.6 mm],[JP02 / GND],[WP103
X=57.0; Y=48.8 mm],[WP100
X=44.8; Y=66.8 mm],[27.2 mm],[JP03 / GND],[WP100
X=44.8; Y=66.8 mm],[WP102
X=20.0; Y=73.8 mm],[34.8 mm],[JP04 / GPIO18],[WP063
X=31.4; Y=22.6 mm],[WP104
X=30.2; Y=43.6 mm],[21.5 mm],[JP05 / GPIO18],[WP104
X=30.2; Y=43.6 mm],[WP002
X=43.0; Y=50.4 mm],[18.7 mm],[JP06 / GPIO19],[WP064
X=32.2; Y=25.0 mm],[WP087
X=60.2; Y=49.4 mm],[73.1 mm])

As coordenadas são TOP a partir do canto superior esquerdo. Desencapar apenas as pontas, passar o fio isolado pelo lado dos componentes e soldar nas ilhas WP. As linhas não são trilhas adicionais. Comprimento é referência geométrica; acrescentar folga e ajustar na montagem.

Conferido por/data: …………………………  Continuidade medida: …………………………
])

#pagebreak()
= Instalar pontes — grupo 02
#grid(columns:(86mm,1fr),gutter:7mm,image("assets/bridges-02.svg",height:169mm),[
#table(columns:(19%,28%,28%,25%),inset:5pt,stroke:.4pt+rgb("b7c5cd"),[Ponte / rede],[Primeira ilha],[Segunda ilha],[Comprimento plano],[JP07 / GPIO21],[WP065
X=32.2; Y=27.6 mm],[WP009
X=57.0; Y=53.0 mm],[63.9 mm],[JP08 / GPIO21],[WP009
X=57.0; Y=53.0 mm],[WP088
X=74.2; Y=41.8 mm],[24.1 mm],[JP09 / GPIO22],[WP089
X=32.2; Y=35.0 mm],[WP004
X=43.0; Y=55.6 mm],[30.2 mm],[JP10 / GPIO14],[WP067
X=67.8; Y=12.4 mm],[WP093
X=63.8; Y=176.8 mm],[180.0 mm],[JP11 / GPIO27],[WP068
X=67.8; Y=15.0 mm],[WP084
X=80.2; Y=168.8 mm],[161.9 mm],[JP12 / GPIO26],[WP069
X=67.8; Y=17.4 mm],[WP092
X=33.8; Y=176.8 mm],[184.9 mm])

As coordenadas são TOP a partir do canto superior esquerdo. Desencapar apenas as pontas, passar o fio isolado pelo lado dos componentes e soldar nas ilhas WP. As linhas não são trilhas adicionais. Comprimento é referência geométrica; acrescentar folga e ajustar na montagem.

Conferido por/data: …………………………  Continuidade medida: …………………………
])

#pagebreak()
= Instalar pontes — grupo 03
#grid(columns:(86mm,1fr),gutter:7mm,image("assets/bridges-03.svg",height:169mm),[
#table(columns:(19%,28%,28%,25%),inset:5pt,stroke:.4pt+rgb("b7c5cd"),[Ponte / rede],[Primeira ilha],[Segunda ilha],[Comprimento plano],[JP13 / GPIO25],[WP070
X=67.8; Y=20.0 mm],[WP096
X=81.2; Y=19.8 mm],[13.5 mm],[JP14 / GPIO34],[WP071
X=68.6; Y=30.2 mm],[WP091
X=46.2; Y=147.8 mm],[146.3 mm],[JP15 / GPIO34],[WP091
X=46.2; Y=147.8 mm],[WP080
X=90.8; Y=177.8 mm],[60.8 mm],[JP16 / RESET12],[WP082
X=83.8; Y=20.2 mm],[WP098
X=91.8; Y=29.8 mm],[16.3 mm],[JP17 / RESET12],[WP098
X=91.8; Y=29.8 mm],[WP013
X=31.0; Y=103.8 mm],[127.1 mm],[JP18 / RESET12],[WP013
X=31.0; Y=103.8 mm],[WP105
X=31.0; Y=135.8 mm],[41.9 mm])

As coordenadas são TOP a partir do canto superior esquerdo. Desencapar apenas as pontas, passar o fio isolado pelo lado dos componentes e soldar nas ilhas WP. As linhas não são trilhas adicionais. Comprimento é referência geométrica; acrescentar folga e ajustar na montagem.

Conferido por/data: …………………………  Continuidade medida: …………………………
])

#pagebreak()
= Instalar pontes — grupo 04
#grid(columns:(86mm,1fr),gutter:7mm,image("assets/bridges-04.svg",height:169mm),[
#table(columns:(19%,28%,28%,25%),inset:5pt,stroke:.4pt+rgb("b7c5cd"),[Ponte / rede],[Primeira ilha],[Segunda ilha],[Comprimento plano],[JP19 / V12],[WP072
X=78.6; Y=29.6 mm],[WP026
X=25.8; Y=82.2 mm],[86.0 mm],[JP20 / V12],[WP041
X=25.8; Y=114.2 mm],[WP077
X=9.2; Y=170.2 mm],[63.5 mm],[JP21 / V12],[WP041
X=25.8; Y=114.2 mm],[WP075
X=84.0; Y=121.0 mm],[61.0 mm],[JP22 / AX1],[WP042
X=20.0; Y=56.2 mm],[WP018
X=71.6; Y=82.2 mm],[69.9 mm],[JP23 / AX2],[WP043
X=20.0; Y=58.6 mm],[WP019
X=69.0; Y=82.2 mm],[68.2 mm],[JP24 / AX2],[WP019
X=69.0; Y=82.2 mm],[WP034
X=69.0; Y=114.2 mm],[41.9 mm])

As coordenadas são TOP a partir do canto superior esquerdo. Desencapar apenas as pontas, passar o fio isolado pelo lado dos componentes e soldar nas ilhas WP. As linhas não são trilhas adicionais. Comprimento é referência geométrica; acrescentar folga e ajustar na montagem.

Conferido por/data: …………………………  Continuidade medida: …………………………
])

#pagebreak()
= Instalar pontes — grupo 05
#grid(columns:(86mm,1fr),gutter:7mm,image("assets/bridges-05.svg",height:169mm),[
#table(columns:(19%,28%,28%,25%),inset:5pt,stroke:.4pt+rgb("b7c5cd"),[Ponte / rede],[Primeira ilha],[Segunda ilha],[Comprimento plano],[JP25 / AX3],[WP044
X=20.0; Y=61.2 mm],[WP014
X=33.4; Y=103.8 mm],[53.2 mm],[JP26 / AX3],[WP014
X=33.4; Y=103.8 mm],[WP029
X=33.4; Y=135.8 mm],[45.3 mm],[JP27 / AY0],[WP045
X=20.0; Y=63.8 mm],[WP020
X=66.6; Y=82.2 mm],[61.1 mm],[JP28 / AY0],[WP020
X=66.6; Y=82.2 mm],[WP035
X=66.6; Y=114.2 mm],[45.3 mm],[JP29 / AY1],[WP046
X=20.0; Y=66.2 mm],[WP021
X=64.0; Y=82.2 mm],[56.1 mm],[JP30 / AY1],[WP021
X=64.0; Y=82.2 mm],[WP036
X=64.0; Y=114.2 mm],[49.5 mm])

As coordenadas são TOP a partir do canto superior esquerdo. Desencapar apenas as pontas, passar o fio isolado pelo lado dos componentes e soldar nas ilhas WP. As linhas não são trilhas adicionais. Comprimento é referência geométrica; acrescentar folga e ajustar na montagem.

Conferido por/data: …………………………  Continuidade medida: …………………………
])

#pagebreak()
= Instalar pontes — grupo 06
#grid(columns:(86mm,1fr),gutter:7mm,image("assets/bridges-06.svg",height:169mm),[
#table(columns:(19%,28%,28%,25%),inset:5pt,stroke:.4pt+rgb("b7c5cd"),[Ponte / rede],[Primeira ilha],[Segunda ilha],[Comprimento plano],[JP31 / AY2],[WP047
X=20.0; Y=68.8 mm],[WP012
X=28.4; Y=103.8 mm],[40.6 mm],[JP32 / AY2],[WP012
X=28.4; Y=103.8 mm],[WP028
X=28.4; Y=135.8 mm],[38.3 mm],[JP33 / DATA],[WP048
X=20.0; Y=71.4 mm],[WP024
X=31.0; Y=82.2 mm],[17.6 mm],[JP34 / CHAIN],[WP049
X=34.0; Y=73.8 mm],[WP060
X=80.0; Y=61.2 mm],[63.0 mm],[JP35 / V5],[WP055
X=34.0; Y=56.2 mm],[WP106
X=14.0; Y=61.0 mm],[24.8 mm],[JP36 / V5],[WP055
X=34.0; Y=56.2 mm],[WP073
X=22.8; Y=27.4 mm],[34.4 mm])

As coordenadas são TOP a partir do canto superior esquerdo. Desencapar apenas as pontas, passar o fio isolado pelo lado dos componentes e soldar nas ilhas WP. As linhas não são trilhas adicionais. Comprimento é referência geométrica; acrescentar folga e ajustar na montagem.

Conferido por/data: …………………………  Continuidade medida: …………………………
])

#pagebreak()
= Instalar pontes — grupo 07
#grid(columns:(86mm,1fr),gutter:7mm,image("assets/bridges-07.svg",height:169mm),[
#table(columns:(19%,28%,28%,25%),inset:5pt,stroke:.4pt+rgb("b7c5cd"),[Ponte / rede],[Primeira ilha],[Segunda ilha],[Comprimento plano],[JP37 / V5],[WP055
X=34.0; Y=56.2 mm],[WP010
X=69.8; Y=45.4 mm],[49.2 mm],[JP38 / V5],[WP076
X=84.0; Y=74.0 mm],[WP083
X=47.2; Y=166.2 mm],[109.2 mm],[JP39 / CLK5],[WP050
X=34.0; Y=68.8 mm],[WP003
X=43.0; Y=53.0 mm],[19.5 mm],[JP40 / CLK5],[WP003
X=43.0; Y=53.0 mm],[WP057
X=80.0; Y=68.8 mm],[58.5 mm],[JP41 / LATCH5],[WP051
X=34.0; Y=66.2 mm],[WP005
X=43.0; Y=58.0 mm],[12.4 mm],[JP42 / LATCH5],[WP005
X=43.0; Y=58.0 mm],[WP058
X=80.0; Y=66.2 mm],[56.1 mm])

As coordenadas são TOP a partir do canto superior esquerdo. Desencapar apenas as pontas, passar o fio isolado pelo lado dos componentes e soldar nas ilhas WP. As linhas não são trilhas adicionais. Comprimento é referência geométrica; acrescentar folga e ajustar na montagem.

Conferido por/data: …………………………  Continuidade medida: …………………………
])

#pagebreak()
= Instalar pontes — grupo 08
#grid(columns:(86mm,1fr),gutter:7mm,image("assets/bridges-08.svg",height:169mm),[
#table(columns:(19%,28%,28%,25%),inset:5pt,stroke:.4pt+rgb("b7c5cd"),[Ponte / rede],[Primeira ilha],[Segunda ilha],[Comprimento plano],[JP43 / OE\_N5],[WP052
X=34.0; Y=63.8 mm],[WP008
X=57.0; Y=55.6 mm],[29.9 mm],[JP44 / OE\_N5],[WP008
X=57.0; Y=55.6 mm],[WP059
X=80.0; Y=63.8 mm],[36.0 mm],[JP45 / SER5],[WP053
X=34.0; Y=61.2 mm],[WP001
X=30.2; Y=48.0 mm],[15.2 mm],[JP46 / AX0],[WP054
X=34.0; Y=58.6 mm],[WP015
X=36.0; Y=103.8 mm],[64.2 mm],[JP47 / AX0],[WP015
X=36.0; Y=103.8 mm],[WP030
X=36.0; Y=135.8 mm],[49.5 mm],[JP48 / CS\_B],[WP101
X=55.2; Y=66.8 mm],[WP037
X=36.0; Y=114.2 mm],[75.0 mm])

As coordenadas são TOP a partir do canto superior esquerdo. Desencapar apenas as pontas, passar o fio isolado pelo lado dos componentes e soldar nas ilhas WP. As linhas não são trilhas adicionais. Comprimento é referência geométrica; acrescentar folga e ajustar na montagem.

Conferido por/data: …………………………  Continuidade medida: …………………………
])

#pagebreak()
= Instalar pontes — grupo 09
#grid(columns:(86mm,1fr),gutter:7mm,image("assets/bridges-09.svg",height:169mm),[
#table(columns:(19%,28%,28%,25%),inset:5pt,stroke:.4pt+rgb("b7c5cd"),[Ponte / rede],[Primeira ilha],[Segunda ilha],[Comprimento plano],[JP49 / CS\_A],[WP061
X=80.0; Y=58.6 mm],[WP099
X=37.2; Y=66.8 mm],[52.8 mm],[JP50 / CS\_A],[WP099
X=37.2; Y=66.8 mm],[WP022
X=36.0; Y=82.2 mm],[16.9 mm],[JP51 / SENSE\_A],[WP011
X=25.8; Y=103.8 mm],[WP027
X=25.8; Y=135.8 mm],[34.6 mm],[JP52 / SENSE\_A],[WP027
X=25.8; Y=135.8 mm],[WP078
X=90.8; Y=170.2 mm],[82.2 mm],[JP53 / STROBE5],[WP016
X=69.0; Y=103.8 mm],[WP031
X=69.0; Y=135.8 mm],[41.9 mm],[JP54 / STROBE5],[WP016
X=69.0; Y=103.8 mm],[WP006
X=57.0; Y=60.6 mm],[61.4 mm])

As coordenadas são TOP a partir do canto superior esquerdo. Desencapar apenas as pontas, passar o fio isolado pelo lado dos componentes e soldar nas ilhas WP. As linhas não são trilhas adicionais. Comprimento é referência geométrica; acrescentar folga e ajustar na montagem.

Conferido por/data: …………………………  Continuidade medida: …………………………
])

#pagebreak()
= Instalar pontes — grupo 10
#grid(columns:(86mm,1fr),gutter:7mm,image("assets/bridges-10.svg",height:169mm),[
#table(columns:(19%,28%,28%,25%),inset:5pt,stroke:.4pt+rgb("b7c5cd"),[Ponte / rede],[Primeira ilha],[Segunda ilha],[Comprimento plano],[JP55 / SENSE\_B],[WP017
X=74.2; Y=82.2 mm],[WP032
X=74.2; Y=114.2 mm],[34.6 mm],[JP56 / SENSE\_B],[WP032
X=74.2; Y=114.2 mm],[WP079
X=90.8; Y=175.2 mm],[71.7 mm],[JP57 / PULSE\_BUS],[WP023
X=33.4; Y=82.2 mm],[WP038
X=33.4; Y=114.2 mm],[45.3 mm],[JP58 / TEST\_BUS],[WP025
X=28.4; Y=82.2 mm],[WP040
X=28.4; Y=114.2 mm],[38.3 mm],[JP59 / TEST\_BUS],[WP040
X=28.4; Y=114.2 mm],[WP095
X=49.8; Y=184.8 mm],[87.9 mm])

As coordenadas são TOP a partir do canto superior esquerdo. Desencapar apenas as pontas, passar o fio isolado pelo lado dos componentes e soldar nas ilhas WP. As linhas não são trilhas adicionais. Comprimento é referência geométrica; acrescentar folga e ajustar na montagem.

Conferido por/data: …………………………  Continuidade medida: …………………………
])

#pagebreak()
= 8 — Controle e limites elétricos preservados
#table(columns:(30%,20%,30%,20%),inset:5pt,stroke:.4pt+rgb("b7c5cd"),[Função],[GPIO roteador],[Função],[GPIO roteador],[SER],[23],[CLK],[18],[LATCH],[22],[STROBE],[19],[OE\_ENABLE],[21],[RESET\_RELEASE],[25],[ALTO],[26],[BAIXO],[27],[TESTE],[14],[PULSE\_IN],[34])

O HCT14 inverte SER/CLK/LATCH/STROBE; o firmware precisa compensar essas polaridades. OE\_ENABLE alto habilita as saídas dos registradores através de OE\_N baixo. Q6 mantém o RESET da matriz ativo em 12 V sem liberação do ESP32. Conferir a tabela de endereços físicos X do MT8816; ela não é linear em toda a faixa.

A PCB não corrige as limitações do esquema simplificado: divisor 10 kΩ/10 kΩ com entrada de aproximadamente 20 kΩ; perda de tensão na saída de 470 Ω sob carga; continuidade sem qualificação dos limiares finais; desligamento por watchdog físico ainda pendente. Os 470 Ω limitam idealmente o curto a cerca de 11,29 mA com 5,25 V e resistor −1%; isso não comprova transientes ou níveis lógicos sob 2 mA.

O pedido de pulso é um dado lógico, não a própria energia de 5 V. O roteador só aciona a saída quando o modo está autorizado; fora dele, ambos os estágios ficam desligados. O firmware integrado e os testes energizados não são entregues nem declarados aprovados por este desenho.

#pagebreak()
= 9 — Verificações e arquivos de revisão
#table(columns:(52%,48%),inset:5pt,stroke:.4pt+rgb("b7c5cd"),[Verificação],[Resultado],[Esquema, pinos e redes funcionais],[Passou no build nativo tscircuit.],[Posicionamento, incluindo ilhas WP],[Passou, usando os envelopes de referência.],[Afastamentos / sobreposições / borda / continuidade do cobre],[Sem erros nos checks registrados.],[Curto independente sobre cobre exportado],[Passou: tsci check shorts, resolução 20 pixels/mm.],[Estilo das trilhas],[Passou: tsci check pcb-style.],[Conectividade após instalar todos os JP],[Todas as redes fechadas; auditoria independente pela geometria detecta ponte ausente e ponte na rede errada.],[Medições de encaixe e bancada],[Pendentes; software não substitui medidas.],[Liberação para fabricação],[Pendente da prova física e revisão profissional.])

Arquivos: copper.circuit.json (uma face), final-plan.json, wire-bridges.csv, wire-pads.csv, drill-table.csv, bom-functional.csv, copper-checks.json, candidate-status.json, shorts-check.txt e pcb-style-check.txt. A fonte é model.mjs/circuit.tsx; o caminho é calculado pelo motor nativo do tscircuit, sem um roteador próprio.

Os SVGs de cobre são provas vetoriais do candidato. Não foi liberado fotolito/Gerber de fabricação nem validada uma PCB física. O projeto EasyEDA recebido e as placas já soldadas foram preservados.

#pagebreak()
= Esquema elétrico — ESP32
Esquema nativo do candidato; rótulos iguais unem redes entre folhas. As ilhas WP e pontes são características físicas descritas nas tabelas; o esquema funcional não conta 106 componentes adicionais.
#align(center,image("assets/ESP32-cropped.svg",width:265mm,height:150mm,fit:"contain"))

#pagebreak()
= Esquema elétrico — AdaptacaoControle
Esquema nativo do candidato; rótulos iguais unem redes entre folhas. As ilhas WP e pontes são características físicas descritas nas tabelas; o esquema funcional não conta 106 componentes adicionais.
#align(center,image("assets/AdaptacaoControle-cropped.svg",width:265mm,height:150mm,fit:"contain"))

#pagebreak()
= Esquema elétrico — Registros
Esquema nativo do candidato; rótulos iguais unem redes entre folhas. As ilhas WP e pontes são características físicas descritas nas tabelas; o esquema funcional não conta 106 componentes adicionais.
#align(center,image("assets/Registros-cropped.svg",width:265mm,height:150mm,fit:"contain"))

#pagebreak()
= Esquema elétrico — MatrizA
Esquema nativo do candidato; rótulos iguais unem redes entre folhas. As ilhas WP e pontes são características físicas descritas nas tabelas; o esquema funcional não conta 106 componentes adicionais.
#align(center,image("assets/MatrizA-cropped.svg",width:265mm,height:150mm,fit:"contain"))

#pagebreak()
= Esquema elétrico — MatrizB
Esquema nativo do candidato; rótulos iguais unem redes entre folhas. As ilhas WP e pontes são características físicas descritas nas tabelas; o esquema funcional não conta 106 componentes adicionais.
#align(center,image("assets/MatrizB-cropped.svg",width:265mm,height:150mm,fit:"contain"))

#pagebreak()
= Esquema elétrico — Pulso
Esquema nativo do candidato; rótulos iguais unem redes entre folhas. As ilhas WP e pontes são características físicas descritas nas tabelas; o esquema funcional não conta 106 componentes adicionais.
#align(center,image("assets/Pulso-cropped.svg",width:265mm,height:150mm,fit:"contain"))

#pagebreak()
= Esquema elétrico — Continuidade
Esquema nativo do candidato; rótulos iguais unem redes entre folhas. As ilhas WP e pontes são características físicas descritas nas tabelas; o esquema funcional não conta 106 componentes adicionais.
#align(center,image("assets/Continuidade-cropped.svg",width:265mm,height:150mm,fit:"contain"))

#pagebreak()
= Esquema elétrico — Interfaces
Esquema nativo do candidato; rótulos iguais unem redes entre folhas. As ilhas WP e pontes são características físicas descritas nas tabelas; o esquema funcional não conta 106 componentes adicionais.
#align(center,image("assets/Interfaces-cropped.svg",width:265mm,height:150mm,fit:"contain"))

#pagebreak()
= Esquema elétrico — AdaptadorHCT
Esquema nativo do candidato; rótulos iguais unem redes entre folhas. As ilhas WP e pontes são características físicas descritas nas tabelas; o esquema funcional não conta 106 componentes adicionais.
#align(center,image("assets/AdaptadorHCT-cropped.svg",width:265mm,height:150mm,fit:"contain"))

#set page(paper:"a4",flipped:false,margin:15mm)

#pagebreak()
= Prova 1:1 — componentes
Imprimir a 100%. Conferir a régua de 80 mm e o contorno de 100 × 200 mm. Esta prova é para encaixe e revisão, com envelope do ESP32 ainda não medido.
#align(center,image("assets/proof-top.svg",width:120mm))

#pagebreak()
= Prova 1:1 — cobre visto por baixo
Imprimir a 100%. A vista está espelhada em relação aos componentes. O profissional deve validar a inversão necessária no seu método de transferência. Ainda não é liberação de corrosão.
#align(center,image("assets/proof-bottom.svg",width:120mm))
