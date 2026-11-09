from pathlib import Path
import json,csv,html,math,collections,xml.etree.ElementTree as ET,shutil,re
D=Path(__file__).resolve().parent
plan=json.loads((D/'final-plan.json').read_text());j=json.loads((D/'copper.circuit.json').read_text());parts=json.loads((D/'parts.json').read_text());status=json.loads((D/'candidate-status.json').read_text())
anchors={a['name']:a for a in plan['anchors']};sources={p['source_component_id']:p for p in j if p['type']=='source_component'};comps=[p for p in j if p['type']=='pcb_component'and not p['pcb_component_id'].startswith('pcb_component_WP')]
ports={p['source_port_id']:p for p in j if p['type']=='source_port'};eps={}
for p in j:
 if p['type']=='pcb_port':
  s=ports[p['source_port_id']];ref=sources[s['source_component_id']]['name'];eps[f'{ref}.{s["pin_number"]}']={**p,'label':s['name']}
pads=[p for p in j if p['type']=='pcb_plated_hole'];holes=[p for p in j if p['type']=='pcb_hole'];tracks=[p for p in j if p['type']=='pcb_trace']
def xy(x,y,mirror=False):return (50-x if mirror else 50+x,100-y)
def e(s):return html.escape(str(s))
def col(net):return'#111111'if net=='GND'else'#c42626'if net in['V5','V12']else'#2175b6'if net.startswith(('AX','AY','DATA','NODE'))else'#00825a'if net.startswith('GPIO')else'#a552a0'
def svg(mirror=False,mask=False,selected=(),overview=False,proof=False):
 view='-10 -15 120 225'if proof else'0 -10 100 215';w,h=(120,225)if proof else(100,215)
 s=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}mm" height="{h}mm" viewBox="{view}">',f'<rect x="-10" y="-15" width="120" height="225" fill="white"/>','<rect x="0" y="0" width="100" height="200" fill="white" stroke="#777" stroke-width=".12"/>']
 for t in tracks:
  route=[p for p in t['route']if p['route_type']=='wire'];points=' '.join(f'{xy(p["x"],p["y"],mirror)[0]:.4f},{xy(p["x"],p["y"],mirror)[1]:.4f}'for p in route)
  s.append(f'<polyline points="{points}" fill="none" stroke="{"black"if mask else"#a4a4a4"}" stroke-width="{route[0]["width"]}" stroke-linejoin="round" stroke-linecap="round"/>')
 for p in pads:
  x,y=xy(p['x'],p['y'],mirror);color='black'if mask else'#777'
  if p['shape']=='circle':s.append(f'<circle cx="{x}" cy="{y}" r="{p["outer_diameter"]/2}" fill="{color}"/>')
  else:
   pw,ph=p['rect_pad_width'],p['rect_pad_height'];s.append(f'<rect x="{x-pw/2}" y="{y-ph/2}" width="{pw}" height="{ph}" fill="{color}"/>')
  s.append(f'<circle cx="{x}" cy="{y}" r="{p["hole_diameter"]/2}" fill="white"/>')
 for hole in holes:
  x,y=xy(hole['x'],hole['y'],mirror);s.append(f'<circle cx="{x}" cy="{y}" r="{hole["hole_diameter"]/2}" fill="white" stroke="#777" stroke-width=".1"/>')
 if not mask:
  x,y=xy(0,80,mirror);s.append(f'<rect x="{x-16.5}" y="{y-27.5}" width="33" height="55" fill="#c5dbef" fill-opacity=".18" stroke="#789" stroke-width=".15" stroke-dasharray=".6 .4"/>')
  for c in comps:
   ref=sources[c['source_component_id']]['name'];x,y=xy(c['center']['x'],c['center']['y'],mirror)
   s.append(f'<rect x="{x-c["width"]/2}" y="{y-c["height"]/2}" width="{c["width"]}" height="{c["height"]}" fill="#e5edf2" fill-opacity=".55" stroke="#567" stroke-width=".15"/>')
   label=ref.replace('R_LOW_','RL_').replace('R_PD_','RP').replace('C_BULK','CB').replace('R_PULSE_IN','RPI')
   s.append(f'<text x="{x}" y="{y-1}" font-family="sans-serif" font-size="1.25" text-anchor="middle">{e(label)}</text>')
   p=eps.get(ref+'.1')
   if p:
    px,py=xy(p['x'],p['y'],mirror);s.append(f'<circle cx="{px}" cy="{py}" r="1.1" fill="none" stroke="#1b526b" stroke-width=".2"/>')
  for a in anchors.values():
   x,y=xy(a['x'],a['y'],mirror);shift=-.8 if x>85 else .8;align='end'if x>85 else'start';s.append(f'<text x="{x+shift}" y="{y-1}" font-family="sans-serif" font-size=".9" text-anchor="{align}" fill="#535353">{a["name"]}</text>')
  for b in (plan['bridges']if overview else selected):
   route=[p for p in b['route']if p['route_type']=='wire'];ps=' '.join(f'{xy(p["x"],p["y"],mirror)[0]:.4f},{xy(p["x"],p["y"],mirror)[1]:.4f}'for p in route)
   s.append(f'<polyline points="{ps}" fill="none" stroke="{col(b["net"])}" stroke-width=".5" stroke-linejoin="round" stroke-linecap="round"/>')
   for name in[b['a'],b['b']]:
    a=anchors[name];x,y=xy(a['x'],a['y'],mirror);s.append(f'<circle cx="{x}" cy="{y}" r="1.15" fill="none" stroke="{col(b["net"])}" stroke-width=".3"/>')
    dx=-1 if x>80 else 1;s.append(f'<text x="{x+dx}" y="{y+2}" font-family="sans-serif" font-size="1.5" text-anchor="{"end"if dx<0 else"start"}">{name}</text>'.replace('dx<0','dx<0'))
   mid=route[len(route)//2];x,y=xy(mid['x'],mid['y'],mirror);s.append(f'<text x="{x}" y="{y-1}" font-family="sans-serif" font-size="1.5" fill="{col(b["net"])}">{b["id"]}</text>')
 if proof:
  s.append('<line x1="10" y1="205" x2="90" y2="205" stroke="#111" stroke-width=".2"/><text x="50" y="209" text-anchor="middle" font-family="sans-serif" font-size="2">80 mm — conferir régua; não usar Ajustar à página</text>')
 s.append('</svg>');return''.join(s)
# Fix Python-only comparison in the SVG string builder before rendering.
for file,kwargs in [('assembly-top.svg',{}),('assembly-bottom.svg',{'mirror':True}),('copper-top.svg',{'mask':True}),('copper-bottom.svg',{'mask':True,'mirror':True}),('all-bridges.svg',{'overview':True}),('proof-top.svg',{'proof':True}),('proof-bottom.svg',{'proof':True,'mask':True,'mirror':True})]:
 (D/'assets'/file).write_text(svg(**kwargs))
ET.register_namespace('','http://www.w3.org/2000/svg')
for section in dict.fromkeys(p['section']for p in parts):
 root=ET.fromstring((D/'assets'/f'{section}.svg').read_text())
 for child in list(root):
  if child.attrib.get('class')in['boundary','schematic-sheet']:root.remove(child)
 ET.ElementTree(root).write(D/'assets'/f'{section}-cropped.svg',encoding='unicode')
# CSVs are complete, including copper-only branches and unused reserved wire pads.
def csvfile(name,rows):
 with(D/name).open('w',newline='')as f:csv.writer(f).writerows(rows)
def pt(name):a=anchors[name];return f'{name}\nX={50+a["x"]:.1f}; Y={100-a["y"]:.1f} mm'
csvfile('wire-bridges.csv',[['Ponte','Rede','Ilha_A','Ilha_B','Origem_A','Origem_B','Comprimento_planejado_mm','Percurso_TOP_X_Y_mm']]+[[b['id'],b['net'],b['a'],b['b'],anchors[b['a']]['endpoint'],anchors[b['b']]['endpoint'],round(b['lengthPlanMm'],1),' → '.join(f'{50+p["x"]:.1f}/{100-p["y"]:.1f}'for p in b['route']if p['route_type']=='wire')]for b in plan['bridges']])
csvfile('wire-pads.csv',[['Ilha','Rede','Terminal_de_origem','X_TOP_mm','Y_TOP_mm','Furo_mm','Pad_mm']]+[[a['name'],a['net'],a['endpoint'],round(50+a['x'],2),round(100-a['y'],2),.8,1.8]for a in anchors.values()])
csvfile('drill-table.csv',[['ID','X_TOP_mm','Y_TOP_mm','Diametro_mm']]+[[p.get('pcb_plated_hole_id')or p['pcb_hole_id'],round(50+p['x'],3),round(100-p['y'],3),p['hole_diameter']]for p in pads+holes])
csvfile('bom-functional.csv',[['Ref','Valor','Tipo','X_CAD_mm','Y_CAD_mm','Rotacao']]+[[p['ref'],p['value'],p['kind'],p['x'],p['y'],p.get('rotation',0)]for p in parts])
def table(rows,cols):return '#table(columns:('+cols+'),inset:5pt,stroke:.4pt+rgb("b7c5cd"),'+','.join('['+str(v).replace('_','\\_').replace('#','\\#')+']'for row in rows for v in row)+')\n'
def page(t):return '\n#pagebreak()\n= '+t+'\n'
N=len(plan['bridges']);A=len(anchors)
doc='''#set page(paper:"a4",flipped:true,margin:12mm,footer:context [Roteador • PCB de uma face • candidato V2 • 30/10/2026 • #counter(page).display()])
#set text(font:"DejaVu Sans",size:10pt,lang:"pt")
#set par(leading:.6em)
= Nova placa de roteamento — PCB de uma face
*100 × 200 mm • dois MT8816 em 12 V • dois 74HC595 + 74HCT14 em 5 V*

'''
doc+=f'''Este candidato tem *uma única face de cobre e {N} pontes de fio isolado* no lado dos componentes. Não há uma segunda camada de cobre escondida: cada JP é um fio a instalar entre duas ilhas WP dedicadas. São {A} ilhas WP reservadas; parte delas fica vazia no resultado final.

O esquema elétrico simplificado foi preservado. O posicionamento mudou: matrizes horizontais, uma acima da outra; saídas de cada banco em um conector de 6 pinos e outro de 5 pinos; RESET junto da área superior direita. A placa inteligente já soldada não muda.

*Resultado em software:* pinos, redes, posicionamento, afastamentos, sobreposição de trilhas e continuidade dos trechos passaram. A conectividade montada inclui explicitamente as pontes. O check independente de curtos sobre cobre exportado e o check de estilo também passaram.

*Estado físico:* protótipo para revisão. Encaixe dos componentes comprados, orientação da transferência, tolerância de furação e funcionamento energizado ainda não foram medidos. Conferir as provas 1:1 antes da corrosão. As limitações elétricas da simplificação permanecem.

Não confundir os números: há 50 referências funcionais, o módulo ESP32 e seus soquetes, {A} características de PCB para fios e {N} fios JP. As ilhas WP não são {A} componentes a comprar.
'''
doc+=page('1 — O que está no cobre e o que é fio')
doc+=f'''As {len(plan['traces'])} polilinhas de cobre incluem as ligações principais e os pequenos acessos às ilhas WP. São trilhas com largura nominal de 0,5 mm; o roteador solicitou 0,35 mm de margem e a verificação do modelo usa seus limites mínimos de folga. Trilhas da mesma rede podem se encontrar; redes diferentes não podem se cruzar em cobre.

As pontes JP ficam acima da placa, com isolamento em toda a extensão e apenas as pontas desencapadas. A furação WP é nominalmente 0,8 mm e sua ilha circular tem 1,8 mm. Usar fio fino compatível com o furo e com a quantidade de pontas no mesmo ponto; conferir no encaixe real. Não substituir pontes que se cruzam por arames nus.

O total geométrico dos percursos dos fios é aproximadamente {sum(b['lengthPlanMm']for b in plan['bridges'])/1000:.2f} m. Isso não é quantidade de compra nem lista de corte: acrescentar folga para curvas, passagem por cima de outros fios e soldagem. Cortar e ajustar um fio por vez.

As coordenadas X/Y das tabelas são em milímetros a partir do canto superior esquerdo na vista dos componentes. A vista inferior é espelhada, mas as coordenadas continuam identificando a posição TOP. Os últimos desenhos são provas 1:1 e não devem ser ajustados ao tamanho da página.

O motor representa a única face por “top” no Circuit JSON. A montagem física proposta tem componentes de um lado e cobre do outro. Usar a vista inferior espelhada para conferir o lado do cobre e validar a inversão com o profissional conforme o processo de transferência; não presumir a orientação pela palavra “top” do arquivo.
'''
doc+=page('2 — Distribuição dos componentes e vista do cobre')
doc+='#grid(columns:(86mm,86mm,1fr),gutter:5mm,image("assets/assembly-top.svg",height:167mm),image("assets/copper-bottom.svg",height:167mm),[\n'
doc+='''À esquerda: componentes vistos de cima, com cobre em transparência. No centro: face do cobre vista por baixo.

O retângulo azul indica envelope conservador de 33 × 55 mm do ESP32, ainda sem medição da peça. O módulo/USB pode avançar cerca de 7,5 mm além da borda superior; conferir o suporte e o gabinete. Os soquetes permanecem dentro do contorno.

MT8816 A: U1. MT8816 B: U2. Registradores: U5/U6. Adaptador: U_LEVEL. Q6: RESET em 12 V. Os demais transistores ficam nos blocos ALTO/BAIXO/TESTE.

O círculo marca pino 1. Confirmar entalhes e a pinagem C/B/E das peças compradas. Não usar apenas o desenho externo do transistor para identificar seus terminais.
])
'''
doc+=page('3 — Visão das pontes no lado dos componentes')
doc+='#grid(columns:(90mm,1fr),gutter:8mm,image("assets/all-bridges.svg",height:169mm),[\n'
doc+=f'''São *{N} pontes*, instaladas por grupos nas páginas seguintes. As linhas coloridas são fios isolados; as cinzas são trilhas na face oposta.

Os percursos dos fios foram calculados pelo motor nativo contornando os envelopes dos componentes e o espaço previsto do ESP32. Cruzamentos entre os fios continuam possíveis e exigem isolamento; não são junções elétricas.

As ilhas WP sem ponte permanecem sem fio. Elas são acessos reservados no projeto, não jumpers a fechar automaticamente. A lista JP é a referência para saber o que conectar.

Depois da furação e antes da solda, imprimir as provas 1:1 e conferir soquetes, capacitores e conectores reais. Inspecionar também os anéis de cobre dos furos de 1 mm, cuja margem é menor em alguns footprints originais.

*Não são 59 pedaços de trilha cruzando:* há somente cobre planar. Cada travessia que não coube é uma conexão externa de fio, com duas ilhas e identificação próprias.
])
'''
doc+=page('4 — Componentes e materiais')
counts=collections.Counter(p['kind']for p in parts)
doc+=table([['Grupo','Quantidade','Observação'],['MT8816',2,'U1/U2, DIP40 assumido; confirmar o encapsulamento comprado.'],['74HC595',2,'U5/U6; conservar esta família em 5 V com o adaptador.'],['74HCT14',1,'U_LEVEL; não trocar por 74HC14 sem rever os limiares.'],['Transistores',6,'BC548B/BC557B conforme BOM; conferir C/B/E.'],['Resistores',24,'Inclui cinco pull-downs e limitadores de saída; valores na BOM.'],['Capacitores',7,'Cinco de 100 nF e dois eletrolíticos de 47 µF.'],['Conectores / soquetes do ESP32',8,'Inclui os quatro conectores de nós e duas fileiras do ESP32.'],['Soquetes DIP',5,'Dois DIP40, dois DIP16 e um DIP14, além das referências funcionais.'],['Pontes isoladas',N,'Fio fino para furos WP de 0,8 mm; deixar folga para montagem.']],'27%,15%,58%')
doc+='\nCapacitores eletrolíticos: positivo no pino 1. Usar tensão nominal acima da alimentação: por exemplo 16 V no barramento de 5 V e 25 V no de 12 V. Os resistores de 470 Ω e o limitador de teste de 10 kΩ devem ser 1%. Os conectores não têm MPN de compra definido. Os TO-92 usam padrão triangular de 1,27 mm com ilhas redondas de 1,4 mm e furos de 0,8 mm; conferir C/B/E e a formação das pernas antes da corrosão. Os furos não exigem metalização: terminais e fios são soldados na única face de cobre; não há vias entre camadas.\n'
for i in range(0,len(parts),17):
 doc+=page('BOM e posicionamento — '+str(i//17+1))
 doc+=table([['Ref','Valor','Centro X/Y TOP (mm)','Rotação CAD'],*[[p['ref'],p['value'],f'{50+p["x"]:.2f} / {100-p["y"]:.2f}',str(p.get('rotation',0))+'°']for p in parts[i:i+17]]],'20%,35%,30%,15%')
 doc+='\nCentro é referência de posicionamento do footprint. Não confundir com coordenada do pino 1. Conferir a numeração nos esquemas e nas provas 1:1.\n'
doc+=page('5 — Saídas dos 22 nós: quatro conectores')
doc+=table([['Conector','Pinos','Nós em ordem','Destino na matriz'],['H1',6,'NODE00 a NODE05','U1: X0 a X5'],['H1B',5,'NODE06 a NODE10','U1: X6 a X10'],['H3',6,'NODE11 a NODE16','U2: X0 a X5'],['H3B',5,'NODE17 a NODE21','U2: X6 a X10']],'18%,12%,35%,35%')
doc+='''
O chicote muda em relação aos dois conectores antigos de 11 pinos: antigos H1.1–6 → H1.1–6; antigos H1.7–11 → H1B.1–5. O mesmo vale para H3/H3B. Etiquetar ambas as pontas e testar cada nó antes de conectar aos pogos.

Y0 = GND; Y1 = PULSE_BUS; Y2 = TEST_BUS; Y3 = SENSE_A; Y4 = SENSE_B. Y5/Y6/Y7 permanecem privados de cada metade, sem união física entre A e B. As metades compartilham serviços/GND e não são galvanicamente isoladas. Um par é medido e uma saída é estimulada por vez.
'''
doc+=page('6 — Alimentação e placa inteligente')
doc+=table([['Conector / pino','O que ligar','Função'],['H2.1','12 V regulados da fonte','VDD dos MT8816 e pull-up do RESET.'],['H2.2','5 V regulados da fonte','Lógica e estágios de saída/teste.'],['H2.3','NC — manter sem fio','Não conectar a antiga alimentação de 3,3 V.'],['H2.4','GND da fonte','Referência comum.'],['J_SMART.1','J_ROUTER.1 / A_RAW da placa inteligente','Primeiro sinal selecionado para medição.'],['J_SMART.2','J_ROUTER.2 / GND','Referência comum entre as placas.'],['J_SMART.3','J_ROUTER.3 / B_RAW','Segundo sinal selecionado para medição.'],['J_SMART.4','J_ROUTER.4 / GPIO27 da placa inteligente','Pedido de pulso 3,3 V → GPIO34 do roteador.']],'23%,42%,35%')
doc+='\nA/B precisam dos divisores antes do ADC da placa inteligente; não levar 5 V direto a GPIO. O ESP32 roteador é alimentado pelo USB, sem ligar VIN/5 V à fonte externa em paralelo. Confirmar os 12 V disponíveis na placa de energia. Os cabos OLED, NFC, joystick e UART da placa inteligente não mudam.\n'
doc+=page('7 — Ordem de montagem e testes')
doc+='''+ Conferir dimensões reais e prova 1:1. Validar lado de transferência, pino 1 e ordem dos conectores com o profissional. Confirmar diâmetros de furo antes de corroer.
+ Depois da corrosão/furação, inspecionar e medir trilhas antes de montar. Redes interrompidas por pontes estarão abertas até a instalação dos JP; não improvisar fechamentos pelo nome da rede.
+ Soldar soquetes, conectores e passivos com tudo desligado, mantendo os CIs e ESP32 fora dos soquetes. Identificar positivo/negativo dos capacitores e terminais dos transistores.
+ Instalar as pontes JP por grupos, usando as ilhas WP e os percursos das páginas seguintes. Manter isolamento nos cruzamentos e passagem livre para inserir/remover os CIs.
+ Sem CIs, conferir curto persistente entre GND/5 V/12 V. Medir a fonte nos soquetes: MT8816 pino 40 recebe 12 V; HC595 pino 16 e HCT14 pino 14 recebem 5 V. Desligar e descarregar antes de inserir componentes.
+ Testar RESET e registradores com firmware específico. O sketch de telas/joystick não controla este roteador. Confirmar que as saídas ficam desligadas no boot e que OE/RESET respeitam o estado seguro.
+ Testar cada nó e seleção da matriz com estímulo limitado e instrumento. Qualificar ALTO, BAIXO e TESTE antes de conectar aos pogos; não ativar ALTO e BAIXO simultaneamente.
+ Calibrar SENSE_A/B com a placa inteligente; testar aberto, curto e resistência conhecida com o experimento desenergizado. Retirar o estímulo antes da autorização de operação.
+ Registrar tensões, correntes, firmware, instrumentos e resultado. Reinício/falha não pode energizar automaticamente. O desligamento em ESP32 travado exige watchdog físico, ainda pendente neste candidato.
'''
for i in range(0,N,6):
 batch=plan['bridges'][i:i+6];idx=i//6+1;name=f'bridges-{idx:02}.svg';(D/'assets'/name).write_text(svg(selected=batch))
 doc+=page(f'Instalar pontes — grupo {idx:02}')
 doc+=f'#grid(columns:(86mm,1fr),gutter:7mm,image("assets/{name}",height:169mm),[\n'
 doc+=table([['Ponte / rede','Primeira ilha','Segunda ilha','Comprimento plano'],*[[b['id']+' / '+b['net'],pt(b['a']),pt(b['b']),f'{b["lengthPlanMm"]:.1f} mm']for b in batch]],'19%,28%,28%,25%')
 doc+='\nAs coordenadas são TOP a partir do canto superior esquerdo. Desencapar apenas as pontas, passar o fio isolado pelo lado dos componentes e soldar nas ilhas WP. As linhas não são trilhas adicionais. Comprimento é referência geométrica; acrescentar folga e ajustar na montagem.\n\nConferido por/data: …………………………  Continuidade medida: …………………………\n])\n'
doc+=page('8 — Controle e limites elétricos preservados')
doc+=table([['Função','GPIO roteador','Função','GPIO roteador'],['SER',23,'CLK',18],['LATCH',22,'STROBE',19],['OE_ENABLE',21,'RESET_RELEASE',25],['ALTO',26,'BAIXO',27],['TESTE',14,'PULSE_IN',34]],'30%,20%,30%,20%')
doc+='''
O HCT14 inverte SER/CLK/LATCH/STROBE; o firmware precisa compensar essas polaridades. OE_ENABLE alto habilita as saídas dos registradores através de OE_N baixo. Q6 mantém o RESET da matriz ativo em 12 V sem liberação do ESP32. Conferir a tabela de endereços físicos X do MT8816; ela não é linear em toda a faixa.

A PCB não corrige as limitações do esquema simplificado: divisor 10 kΩ/10 kΩ com entrada de aproximadamente 20 kΩ; perda de tensão na saída de 470 Ω sob carga; continuidade sem qualificação dos limiares finais; desligamento por watchdog físico ainda pendente. Os 470 Ω limitam idealmente o curto a cerca de 11,29 mA com 5,25 V e resistor −1%; isso não comprova transientes ou níveis lógicos sob 2 mA.

O pedido de pulso é um dado lógico, não a própria energia de 5 V. O roteador só aciona a saída quando o modo está autorizado; fora dele, ambos os estágios ficam desligados. O firmware integrado e os testes energizados não são entregues nem declarados aprovados por este desenho.
'''
doc+=page('9 — Verificações e arquivos de revisão')
doc+=table([['Verificação','Resultado'],['Esquema, pinos e redes funcionais','Passou no build nativo tscircuit.'],['Posicionamento, incluindo ilhas WP','Passou, usando os envelopes de referência.'],['Afastamentos / sobreposições / borda / continuidade do cobre','Sem erros nos checks registrados.'],['Curto independente sobre cobre exportado','Passou: tsci check shorts, resolução 20 pixels/mm.'],['Estilo das trilhas','Passou: tsci check pcb-style.'],['Conectividade após instalar todos os JP','Todas as redes fechadas; auditoria independente pela geometria detecta ponte ausente e ponte na rede errada.'],['Medições de encaixe e bancada','Pendentes; software não substitui medidas.'],['Liberação para fabricação','Pendente da prova física e revisão profissional.']],'52%,48%')
doc+='''
Arquivos: `copper.circuit.json` (uma face), `final-plan.json`, `wire-bridges.csv`, `wire-pads.csv`, `drill-table.csv`, `bom-functional.csv`, `copper-checks.json`, `candidate-status.json`, `shorts-check.txt` e `pcb-style-check.txt`. A fonte é `model.mjs`/`circuit.tsx`; o caminho é calculado pelo motor nativo do tscircuit, sem um roteador próprio.

Os SVGs de cobre são provas vetoriais do candidato. Não foi liberado fotolito/Gerber de fabricação nem validada uma PCB física. O projeto EasyEDA recebido e as placas já soldadas foram preservados.
'''
for section in dict.fromkeys(p['section']for p in parts):
 doc+=page('Esquema elétrico — '+section)
 doc+='Esquema nativo do candidato; rótulos iguais unem redes entre folhas. As ilhas WP e pontes são características físicas descritas nas tabelas; o esquema funcional não conta 106 componentes adicionais.\n'
 doc+=f'#align(center,image("assets/{section}-cropped.svg",width:265mm,height:150mm,fit:"contain"))\n'
doc+='\n#set page(paper:"a4",flipped:false,margin:15mm)\n'
doc+=page('Prova 1:1 — componentes')
doc+='Imprimir a 100%. Conferir a régua de 80 mm e o contorno de 100 × 200 mm. Esta prova é para encaixe e revisão, com envelope do ESP32 ainda não medido.\n#align(center,image("assets/proof-top.svg",width:120mm))\n'
doc+=page('Prova 1:1 — cobre visto por baixo')
doc+='Imprimir a 100%. A vista está espelhada em relação aos componentes. O profissional deve validar a inversão necessária no seu método de transferência. Ainda não é liberação de corrosão.\n#align(center,image("assets/proof-bottom.svg",width:120mm))\n'
# Protect identifiers in running prose; table cells were already escaped.
doc=re.sub(r'(?<!\\)_',r'\_',doc.replace('`',''))
(D/'pcb-camada-unica.typ').write_text(doc)
print('Documents generated; native cropped SVG viewBoxes must be tightened before PDF compile.')
