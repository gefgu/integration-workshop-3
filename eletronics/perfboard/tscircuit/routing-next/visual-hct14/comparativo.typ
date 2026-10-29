#set page(paper: "a4", flipped: true, margin: 12mm, numbering: "1")
#set text(font: "DejaVu Sans", size: 10pt, lang: "pt")
#set par(leading: .5em)
= Distribuição conceitual — perfboard e PCB de 10 × 20 cm
#align(center, image("comparativo.svg", height: 165mm))
#pagebreak()
= Perfboard: alimentação nas bordas, sinais por fios
#grid(columns: (92mm, 1fr), gutter: 10mm,
 [#image("perf.svg", height: 165mm)],
 [
 A placa fotografada tem quatro bordas separadas e ilhas centrais individuais, conforme verificado pelo usuário. A distribuição proposta usa esquerda para GND, direita para 5 V, inferior para 12 V e superior como reserva.

 A borda de 5 V é alimentação do circuito de controle e do estágio de saída. O experimento só recebe tensão depois dos transistores e resistores limitadores. Nunca ligar o nó do experimento diretamente à borda de 5 V.

 ESP32 junto à borda superior para acesso ao USB; HCT14 entre ESP32 e registradores; MT8816 próximos dos conectores dos 11 nós de cada metade. RESET e estágios de saída ficam em blocos separados.

 As regiões ALTO, BAIXO e TESTE representam grupos de componentes, não uma peça nem uma posição final para cada resistor/transistor. Os fios e os furos individuais ainda não foram definidos.

 As dimensões desenhadas são aproximadas. A malha de furos é ilustrativa: o usuário ainda não informou a quantidade real de linhas/colunas. Conferir também os corpos e espaçamentos dos soquetes comprados.

 Com HCT14, a análise elétrica preliminar contou 152 ligações internas: 97 de sinais e 55 de alimentação/GND. Isso não é uma contagem de fios cortados; bordas, pontes locais e barramentos mudam a montagem física.
 ])
#pagebreak()
= PCB corroída: cobre em uma face, pontes por cima
#grid(columns: (92mm, 1fr), gutter: 10mm,
 [#image("pcb.svg", height: 165mm)],
 [
 A mesma distribuição pode orientar uma PCB de 100 × 200 mm. Em vez de furar toda a malha, haverá ilhas apenas nos terminais dos componentes, soquetes, conectores e pontes.

 O desenho mostra a face dos componentes. O cobre ficará na face inferior. A orientação do fotolito deve ser conferida pelo profissional, com pino 1 e conectores; não usar esta imagem como máscara de corrosão.

 As faixas douradas são corredores reservados, não trilhas nem redes eletricamente conectadas. Nenhum roteamento foi resolvido por este desenho.

 Regra acordada: trilhas de redes diferentes não podem se cruzar na mesma face. Quando necessário, usar pontes de fio isolado no lado dos componentes, numeradas JP01, JP02 etc., com dois terminais e origem/destino no guia final.

 Antes da corrosão, faltam: transferir o esquema com HCT14 para o projeto, fechar todas as trilhas e pontes, verificar ERC/DRC, comparar com o netlist e imprimir prova de encaixe 1:1. O candidato anterior sem HCT14 também não tinha roteamento completo liberado.

 As limitações elétricas anteriores permanecem: divisores simples de 20 kΩ de entrada, saída limitada por resistores com queda sob carga e proteção contra travamento ainda pendente. Esta comparação não substitui o dimensionamento nem ensaios de bancada.
 ])
