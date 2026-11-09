from pathlib import Path
import json,csv,html,collections,hashlib,subprocess
D=Path(__file__).resolve().parent; S=D.parent/'pcb-hct14-1face'
parts=json.loads((S/'parts.json').read_text()); by={p['ref']:p for p in parts}; pins={}; occupied={}
# Provisional TOP coordinates only; not a copper router.
def assign(ref,coords):
 p=by[ref]
 for q in p['pins']:
  c,r=coords[q['pin']]; key=(c,r)
  assert key not in occupied,(ref,q['pin'],occupied.get(key))
  occupied[key]=f'{ref}.{q["pin"]}'
  pins[f'{ref}.{q["pin"]}']={**q,'ref':ref,'c':c,'r':r}
def inline(ref,c,r,vertical=False):assign(ref,{q['pin']:(c if vertical else c+i,r+i if vertical else r) for i,q in enumerate(by[ref]['pins'])})
def dip(ref,c,r,width):
 n=len(by[ref]['pins']); half=n//2
 assign(ref,{i:((c,r+i-1) if i<=half else(c+width,r+n-i)) for i in range(1,n+1)})
def passive(ref,c,r,span=3):assign(ref,{1:(c,r),2:(c+span,r)})
inline('J_ESP_L',14,3,True);inline('J_ESP_R',24,3,True)
inline('H2',3,3);inline('J_SMART',31,3);inline('H1',2,47,True);inline('H3',36,47,True)
dip('U_LEVEL',18,23,3);dip('U5',6,33,3);dip('U6',24,33,3);dip('U1',6,45,6);dip('U2',26,45,6)
for ref,c,r in [('Q6',31,31),('Q7',16,45),('Q8',21,45),('Q11',16,61),('Q9',16,69),('Q10',21,69)]:inline(ref,c,r)
positions={
'R6':(29,33),'R12':(31,35),'R7':(31,37),'R8':(12,35),'R9':(12,38),
'R21':(15,48),'R30':(20,48),'R13':(20,51),'R14':(20,54),'R17':(15,54),
'R_LOW_BASE':(20,59),'R_LOW_PD':(20,62),'R_LOW_LIMIT':(15,64),
'R24':(14,72),'R27':(21,72),'R15':(21,74),'R16':(26,72),'R18':(8,72),
'R_PULSE_IN':(31,7),'R_PD_23':(2,24),'R_PD_18':(2,26),'R_PD_22':(2,28),'R_PD_19':(32,24),'R_PD_21':(32,26)}
for ref,(c,r) in positions.items():passive(ref,c,r)
for ref,c,r in [('C_BULK5',6,20),('C_BULK12',31,20),('C_LEVEL',23,26),('C4',3,34),('C5',29,39),('C1',8,42),('C2',28,42)]:passive(ref,c,r,1)
assert len(pins)==sum(len(p['pins'])for p in parts)
netpins=collections.defaultdict(list)
for e,q in pins.items():
 if q['net']:netpins[q['net']].append(e)
# Every wire is an endpoint contract; these stars are not physical path routing.
anchors={'GND':'H2.4','V5':'H2.2','V12':'H2.1'}
functions={
'GND':'Referência e retorno comum. Não unir a 5 V ou 12 V.',
'V5':'Alimentação de controle/saídas em 5 V; não é saída limitada do experimento.',
'V12':'Alimentação dos MT8816 e pull-up do RESET; nunca levar a um GPIO.',
'RESET12':'RESET ativo alto da matriz; Q6 libera ao puxar para GND.',
'SER5':'Dados seriais invertidos pelo HCT14 para o primeiro registrador.',
'CLK5':'Clock serial invertido; o firmware compensa a polaridade.',
'LATCH5':'Latch dos registradores, invertido pelo HCT14.',
'STROBE5':'Escrita da matriz, compartilhada; CS escolhe o chip.',
'OE_N5':'Habilitação ativa baixa das saídas dos registradores.',
'CHAIN':'Encadeamento serial QH_SER de U5 → SER de U6.',
'CS_A':'Seleção ativa alta do MT8816 A; pull-down mantém inativo.',
'CS_B':'Seleção ativa alta do MT8816 B; pull-down mantém inativo.',
'PULSE_BUS':'Serviço de saída ALTO/BAIXO; sempre após os resistores de 470 Ω.',
'TEST_BUS':'Estímulo de continuidade após resistor de 10 kΩ.',
'SENSE_A':'Primeiro nó selecionado para medição externa com divisor.',
'SENSE_B':'Segundo nó selecionado para medição externa com divisor.'}
def purpose(net):
 if net in functions:return functions[net]
 if net.startswith('NODE'):return 'Liga um nó físico ao X correspondente da matriz; manter sua identidade no cabo.'
 if net.startswith('AX'):return 'Bit de endereço X compartilhado entre as duas matrizes.'
 if net.startswith('AY'):return 'Bit de endereço Y compartilhado entre as duas matrizes.'
 if net=='DATA':return 'Valor escrito no crosspoint: conectar ou desconectar.'
 if net.startswith('GPIO'):return 'Comando lógico de 3,3 V do ESP32; não ligar diretamente a 5 V/12 V.'
 return 'Ligação local do estágio discreto; respeitar base, coletor e emissor conforme esquema.'
netorder=['GND','V5','V12']+sorted(n for n in netpins if n not in anchors)
wires=[]
for net in netorder:
 es=netpins[net]
 if len(es)<2:continue
 a=anchors.get(net,es[0])
 for b in es:
  if b!=a:wires.append({'id':f'W{len(wires)+1:03d}','net':net,'from':a,'to':b,'function':purpose(net)})
# Independently verify membership and complete connectivity; no extra shorts in endpoint list.
for net,es in netpins.items():
 adj={e:set()for e in es}
 for w in wires:
  if w['net']==net:
   assert w['from'] in adj and w['to'] in adj
   adj[w['from']].add(w['to']);adj[w['to']].add(w['from'])
 seen=set();todo=es[:1]
 while todo:
  e=todo.pop()
  if e in seen:continue
  seen.add(e);todo+=list(adj[e]-seen)
 assert seen==set(es),net
assert len(wires)==152,len(wires)
def esc(s):return html.escape(str(s))
def loc(e):q=pins[e];return f'{e} ({q["label"]})\nC{q["c"]}/R{q["r"]}'
def color(net):return '#151515'if net=='GND'else'#d32424'if net in ['V5','V12']else'#1675c5'if net.startswith(('AX','AY','NODE'))else'#008658'if net.startswith('GPIO')else'#bc8400'
def xy(c,r,mirror=False):x=4.28+(c-1)*2.54;return(100-x if mirror else x,6.02+(r-1)*2.54)
def draw(selected=(),mirror=False):
 svg=['<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="200mm" viewBox="0 0 100 200">','<rect x=".3" y=".3" width="99.4" height="199.4" fill="#fffdf3" stroke="#444" stroke-width=".3"/>']
 # Copper edges shown as isolated proposals, not measured board geometry.
 for x,y,w,h,net in [(0.8,5,1,190,'GND'),(98.2,5,1,190,'V5'),(3,197.7,94,1,'V12'),(3,1.2,94,1,'RESERVA')]:svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{color(net)}" opacity=".45"/>')
 for r in range(1,76):
  for c in range(1,38):
   x,y=xy(c,r,mirror);svg.append(f'<circle cx="{x}" cy="{y}" r=".28" fill="#c3bb9a"/>')
 for c in [1,5,10,15,20,25,30,35,37]:
  x,_=xy(c,1,mirror);svg.append(f'<text x="{x}" y="5" font-family="sans-serif" font-size="1.45" text-anchor="middle">{c}</text>')
 for r in [1,5,10,15,20,25,30,35,40,45,50,55,60,65,70,75]:
  _,y=xy(1,r,mirror);svg.append(f'<text x="2.4" y="{y+.5}" font-family="sans-serif" font-size="1.45">{r}</text>')
 for p in parts:
  qs=[pins[f'{p["ref"]}.{q["pin"]}']for q in p['pins']];coords=[xy(q['c'],q['r'],mirror)for q in qs];xs=[a[0]for a in coords];ys=[a[1]for a in coords];x=min(xs)-.8;y=min(ys)-.8;w=max(xs)-min(xs)+1.6;h=max(ys)-min(ys)+1.6
  svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#dce6ed" stroke="#677785" stroke-width=".15"/>')
  label=p['ref'].replace('R_LOW_','RL_').replace('R_PULSE_IN','RPI').replace('R_PD_','RP').replace('C_BULK','CB')
  svg.append(f'<text x="{(min(xs)+max(xs))/2}" y="{y-.6}" text-anchor="middle" font-size="1.45" font-family="sans-serif">{esc(label)}</text>')
  for q,(px,py)in zip(qs,coords):svg.append(f'<circle cx="{px}" cy="{py}" r=".52" fill="white" stroke="#334" stroke-width=".15"/>')
  px,py=coords[0];svg.append(f'<circle cx="{px}" cy="{py}" r=".8" fill="none" stroke="#111" stroke-width=".2"/>')
 for w in selected:
  a=pins[w['from']];b=pins[w['to']];x,y=xy(a['c'],a['r'],mirror);xx,yy=xy(b['c'],b['r'],mirror)
  svg.append(f'<line x1="{x}" y1="{y}" x2="{xx}" y2="{yy}" stroke="{color(w["net"])}" stroke-width=".45" stroke-dasharray="1 .6"/>')
 svg.append('</svg>');return ''.join(svg)
(D/'assets/top.svg').write_text(draw());(D/'assets/underside.svg').write_text(draw(mirror=True))
# Reuse the already cropped native schematic exports; circuit is unchanged.
import shutil
for f in (D.parent/'resumo-simplificacao/assets').glob('*.svg'):shutil.copyfile(f,D/'assets'/f.name)
def table(rows,widths):
 return '#table(columns:('+widths+'),inset:4pt,stroke:.4pt+rgb("aabbc7"),'+','.join('['+str(v).replace('#','\\#')+']'for row in rows for v in row)+')\n'
def page(t):return '\n#pagebreak()\n= '+t+'\n'
doc='''#set page(paper:"a4",flipped:true,margin:12mm,footer:context [Roteador 2 MT8816 + HC595 + HCT14 · guia provisório · 30/10/2026 · #counter(page).display()])
#set text(font:"DejaVu Sans",size:9pt,lang:"pt")
#set par(leading:.5em)
= Guia de montagem — nova placa de roteamento
*Perfboard de 10 × 20 cm • dois MT8816 • dois 74HC595 • um 74HCT14*

Guia de preparação, posicionamento provisório e fiação por terminais, derivado do candidato elétrico existente. Preserva a placa inteligente e as demais revisões. Não é o projeto de PCB corroída e não contém as trilhas reprovadas.

*Malha assumida por solicitação do usuário:* 37 colunas × 75 linhas, passo de 2,54 mm. O retângulo entre furos extremos mede 91,44 × 187,96 mm. Os quatro barramentos de borda são separados. Confirmar quantidade real, margens, montagem dos soquetes e largura do ESP32 antes de usar as coordenadas.

*Use agora:* separar peças, identificar pinos, fazer encaixe a seco, etiquetar conectores e revisar o circuito com quem vai soldar. *Antes de soldar:* conferir as coordenadas na placa comprada e registrar o encaixe. Os retângulos dos desenhos ligam furos; não são medidas completas dos corpos reais.

As linhas pontilhadas das páginas de fiação mostram somente as duas pontas de cada ligação. O caminho do fio isolado é manual; cruzamento no desenho não significa junção. Não há roteamento físico validado, comprimentos de corte ou autorização de corrosão.

São 48 referências e 152 ligações internas de terminais. Barramentos e emendas podem reduzir fios cortados, mas todas as pontas elétricas precisam ser mantidas. Este guia verifica a equivalência da lista de ligações com o modelo; não verifica solda, corrente ou funcionamento em bancada.
'''
doc+=page('1 — Como orientar a placa e ler os pinos')
doc+='''Vista TOP: componentes voltados para você, USB do ESP32 para cima. Colunas C1–C37 da esquerda para a direita; linhas R1–R75 de cima para baixo. Na vista inferior espelhada, os nomes C/R continuam identificando os mesmos furos TOP. Não renumerar pinos ao virar a placa.

Nos CIs DIP, entalhe voltado para cima: pino 1 no canto superior esquerdo, números descem pela esquerda e sobem pela direita. O círculo marca pino 1. U1/U2 são DIP40, U5/U6 DIP16 e U_LEVEL DIP14. Soquetes são recomendados; não inserir os CIs durante a soldagem.

Resistores: terminal 1 é a ponta esquerda no TOP, terminal 2 a direita; normalmente sem polaridade. Os dois 470 Ω e o 10 kΩ limitador de teste devem ser 1%. Capacitores de 100 nF não têm polaridade. Nos eletrolíticos: terminal 1 positivo, terminal 2 negativo; usar tensão nominal acima da alimentação, por exemplo 16 V para 5 V e 25 V para 12 V.

Transistores no modelo: 1 = coletor, 2 = base, 3 = emissor. A sequência real depende da peça comprada: conferir datasheet/encapsulamento antes de dobrar as pernas. Não assumir que qualquer BC548/BC557 tem a mesma orientação de corpo.

Cores: preto = GND; vermelho = alimentação positiva, com etiquetas distintas “5 V”/“12 V”; azul, verde, amarelo e branco para sinais. Nunca usar o barramento de 5 V como saída direta para um nó de experimento.
'''
doc+=page('2 — Encaixe a seco: TOP e inferior espelhada')
doc+='#grid(columns:(90mm,90mm,1fr),gutter:5mm,image("assets/top.svg",height:166mm),image("assets/underside.svg",height:166mm),[\n'
doc+='''*Antes da solda:*

+ Conferir a malha real; não forçar terminais para cumprir o desenho.
+ Posicionar os dois soquetes do ESP32 e verificar acesso ao USB/EN/BOOT.
+ Posicionar cinco soquetes de CI e todos os conectores.
+ Colocar passivos e transistores sem cortar pernas.
+ Verificar largura dos corpos, capacitores, área para os cabos e parafusos.
+ Fotografar TOP e inferior e marcar C1/R1 permanentemente.

*Bordas propostas:* esquerda GND, direita 5 V, inferior 12 V, superior livre. As tabelas elétricas usam H2 como origem das alimentações; as bordas só podem substituir trechos se forem ligadas à rede correta e verificadas.

Não há ligação implícita entre furos vizinhos. Um barramento contínuo de cobre pode distribuir uma única rede; não soldar redes diferentes na mesma borda.
])
'''
doc+=page('3 — Peças e posições provisórias')
for i in range(0,len(parts),16):
 if i:doc+=page('3 — Peças e posições — continuação')
 rows=[['Referência','Valor / peça','Terminais TOP (C/R)']]
 for p in parts[i:i+16]:
  qs=[pins[f'{p["ref"]}.{q["pin"]}']for q in p['pins']]
  pos=' · '.join(f'{q["pin"]}=C{q["c"]}/R{q["r"]}'for q in qs)if len(qs)<=4 else f'P1=C{qs[0]["c"]}/R{qs[0]["r"]}; demais: tabela completa de pinos (pins.csv)'
  rows.append([p['ref'],p['value'],pos])
 doc+=table(rows,'18%,27%,55%')
doc+=page('Pinos sem fio — conferir antes da solda')
doc+='Os terminais abaixo não recebem ligação externa neste candidato. Não unir pinos NC entre si e não aterrar X não utilizados da matriz. A entrada não usada do HCT14 é exceção explícita: pino 13 está em GND e aparece nas páginas W.\n\n'
rows=[['Componente','Pinos sem conexão no modelo']]
for p in parts:
 unused=[str(q['pin'])+' ('+q['label']+')'for q in p['pins']if q['net']is None]
 if unused:rows.append([p['ref'],', '.join(unused)])
doc+=table(rows,'20%,80%')
doc+='\nU1/U2: pinos 19 (Y5), 17 (Y6) e 15 (Y7) são barramentos privados. Não recebem fio externo neste candidato, mas podem unir X por chaves internas. Não conectar aos Y da outra metade.\n\nNão conectar o pino 3V3 do ESP32 à rede de 5 V; os soquetes mostram vários pinos sem uso porque este roteador recebe alimentação própria por USB. Manter acesso a VIN e demais pinos sem criar derivações improvisadas.\n'
doc+=page('4 — Ordem de montagem e auditoria por bloco')
doc+='''As etapas M abaixo pertencem a este candidato independente; não são aprovações dos checkpoints CP00–CP36 do projeto. Não transferir resultados de outra revisão. Dentro de cada etapa, conferir peça, solda e continuidade; só depois prosseguir. Não alimentar montagens parciais sem um procedimento específico revisado.

'''
doc+=table([['Etapa','Instalar/conferir','Critério antes de avançar'],['M00','Encaixe a seco, pinagem e conectores','Malha e corpos reais conferidos; fotos TOP/inferior; nenhum componente permanente anterior alterado.'],['M01','Soquetes, H2, GND, 5 V, 12 V e capacitores','Sem curtos persistentes entre alimentações; polaridades e pinos de alimentação corretos. Sem ESP32/CIs, verificar fonte regulada nos soquetes, desligar e descarregar.'],['M02','Q6, R6/R12/R7 e 74HCT14 com pull-downs','RESET ativo sem liberação; cinco entradas em nível baixo sem comandos. Revisar antes de energizar.'],['M03','U5/U6, encadeamento, CS, endereço e STROBE','Firmware específico deve verificar cada bit/endereço. Não usar o sketch dos OLEDs para este teste.'],['M04','Soquetes U1/U2, 22 nós e barramentos','Conferência terminal a terminal sem CIs; depois testar todas as seleções com estímulo limitado.'],['M05','Transistores ALTO/BAIXO/TESTE','Comandos desligados na inicialização. Medir saída em aberto, carga conhecida e curto controlado; nunca energizar ALTO e BAIXO juntos.'],['M06','J_SMART e cabos externos','GND comum; entradas A/B com divisores na placa inteligente; pedido de pulso em 3,3 V.'],['M07','Integração supervisionada','Precheck conhecido passa/rejeita/inconclusivo; desligamento por falha; nenhuma autorização automática após reset.']],'10%,40%,50%')
doc+=page('5 — Como executar as páginas de fios')
doc+='''Cada Wxxx identifica uma ligação elétrica. A origem/destino informa referência, pino, nome e furo TOP. Marcar a ligação como instalada somente depois da inspeção; marcar “medida” em separado. Trabalhar com as duas fontes e o USB desconectados.

As redes com várias pontas aparecem em estrela no documento para facilitar auditoria. Você pode usar a borda correta ou derivações locais para GND/5 V/12 V, sem acumular muitos fios num terminal de soquete. Não trocar a topologia elétrica: todas as pontas de uma rede precisam permanecer unidas. Definir e registrar o ponto físico de distribuição antes de soldar.

Nas páginas seguintes, a montagem completa aparece em cinza e até oito ligações são destacadas. Os traços são guias de pontas e podem atravessar componentes no papel; não indicam que se deve passar fio desprotegido por ali. Usar fio isolado e aliviar esforço mecânico junto aos conectores.

Depois de cada grupo: conferir continuidade com pontas de prova na origem e no destino; inspecionar ilhas vizinhas. Resistores e transistores fazem redes distintas se relacionarem eletricamente: ausência de “bip” não é um teste universal de isolamento. Para conferência do cobre/fios, manter ESP32 e CIs removidos dos soquetes quando necessário.

*Estado das verificações:* a lista W foi comparada às redes do modelo. Os pinos sem conexão não recebem fios. Os barramentos privados Y5/Y6/Y7 têm apenas um terminal externo cada; suas interligações aos X são internas aos MT8816 e configuradas por firmware.
'''
for i in range(0,len(wires),8):
 batch=wires[i:i+8];idx=i//8+1
 for mirror,label in [(False,'top'),(True,'bottom')]: (D/'assets'/f'w{idx:02d}-{label}.svg').write_text(draw(batch,mirror))
 doc+=page(f'Fiação {idx:02d} — {batch[0]["id"]} a {batch[-1]["id"]}')
 doc+=f'#grid(columns:(85mm,85mm,1fr),gutter:4mm,image("assets/w{idx:02d}-top.svg",height:164mm),image("assets/w{idx:02d}-bottom.svg",height:164mm),[\n'
 doc+=table([['Fio / rede','Origem → destino'],*[[w['id']+' / '+w['net'],loc(w['from'])+'\n→ '+loc(w['to'])]for w in batch]],'33%,67%')
 doc+='\nTOP à esquerda; inferior espelhada no centro. Coordenadas provisórias. Todos os fios deste grupo devem ser conferidos antes do próximo.\n])\n'
 # purpose separate page only per group to preserve readability at available size
 doc+=page(f'Função dos fios — grupo {idx:02d}')
 doc+=table([['Fio','Rede','O que faz / por que existe'],*[[w['id'],w['net'],w['function']]for w in batch]],'10%,20%,70%')
 doc+='\nRegistro: instalado por/data: ____________________  continuidade medida por/data: ____________________  observações: ____________________\n'
doc+=page('6 — Conectores externos: alimentação e placa inteligente')
doc+=table([['Cabo','Origem/destino','Função'],['H2.1','Saída regulada 12 V da fonte → roteador','Alimenta MT8816 e RESET. Confirmar que a fonte existente disponibiliza 12 V.'],['H2.2','Saída regulada 5 V da fonte → roteador','Alimenta lógica HCT/HC e estágios de saída.'],['H2.3','NC','Manter vazio; não conectar o antigo fio de 3,3 V.'],['H2.4','GND da fonte → roteador','Retorno comum.'],['J_SMART.1','SENSE_A → entrada A_RAW/J_ROUTER.1 da placa inteligente','Primeiro nó analógico selecionado; precisa de divisor antes do ADC.'],['J_SMART.2','GND → J_ROUTER.2 da placa inteligente','Referência comum entre placas.'],['J_SMART.3','SENSE_B → B_RAW/J_ROUTER.3 da placa inteligente','Segundo nó selecionado; precisa de divisor antes do ADC.'],['J_SMART.4','GPIO27 da placa inteligente → GPIO34 do roteador','Pedido de pulso de 3,3 V. Pull-down R_PULSE_IN no receptor.']],'17%,45%,38%')
doc+='''
Os números são por função elétrica; conferir a posição física do conector comprado e etiquetar o pino 1. Não ligar 5 V/12 V ao J_SMART. A placa inteligente e o roteador usam ESP32 distintos: ADC34 da inteligente não é PULSE_IN34 do roteador.

O ESP32 roteador é USB no candidato. Não ligar VIN/5 V dele em paralelo à alimentação externa. Conectar sinais entre placas somente com ambas alimentadas corretamente; não aplicar sinais a um ESP32 desligado. Conectores das telas, joystick, NFC e Pi continuam na placa inteligente.
'''
doc+=page('7 — Nós da bancada e barramentos internos')
doc+=table([['Pino dos conectores','H1 / MT A','H3 / MT B'],*[[str(i+1),f'NODE{i:02d} → X{i}',f'NODE{i+11:02d} → X{i}']for i in range(11)]],'20%,40%,40%')
doc+='''
Y0 = GND; Y1 = PULSE_BUS; Y2 = TEST_BUS; Y3 = SENSE_A; Y4 = SENSE_B. Y5/Y6/Y7 são privados de cada metade e ficam sem fio externo neste candidato. Não unir Y5 de A a Y5 de B etc.

Para ligar dois nós de uma mesma metade, o firmware fecha seus X no mesmo Y privado. Há três barramentos privados por metade. As metades compartilham serviços e GND; não são galvanicamente isoladas. Serviços compartilhados não podem conectar acidentalmente dois circuitos ativos. Um par é medido por vez e apenas uma saída é estimulada por vez.
'''
doc+=page('8 — Testes antes de conectar a bancada')
doc+='''+ Com tudo desligado e CIs/ESP32 fora dos soquetes: comparar todas as Wxxx com a lista, verificar pinos NC, medir bordas isoladas e ausência de ligação direta 12 V–5 V–GND.
+ Conferir as fontes em separado com multímetro. Capacitores podem causar indicação transitória de continuidade; curto persistente precisa ser resolvido. Não inserir chips com energia ligada.
+ Validar RESET e adaptação antes da matriz. HCT14 alimentado em 5 V, entradas de 3,3 V. Não substituir por HC14. Confirmar RESET em 12 V sem comando de liberação e próximo de GND quando Q6 conduz, antes de conectar à matriz.
+ Executar firmware específico de roteamento para verificar registradores e endereços. Ele ainda não foi entregue com este guia. O teste dos OLEDs/joystick não controla esta placa.
+ Testar cada X0–X10 de A e B com carga/estímulo limitados e instrumento; verificar seleção correta e ausência de rotas indesejadas. Verificar a codificação física de X, que não é linear em toda a faixa do MT8816.
+ Qualificar os estágios ALTO/BAIXO/TESTE com fonte limitada e carga conhecida antes de ligá-los aos pogos. Medir corrente e tensão sob carga e registrar quedas de RON e resistores.
+ Conectar a placa inteligente: medir SENSE_A/B com 0 V, tensão intermediária conhecida e 5 V dentro do limite do divisor; conferir ADC sem ultrapassar 3,3 V. Calibrar os dois canais.
+ Testar continuidade em circuito desenergizado com aberto, curto e resistor conhecidos. Resultado incerto não libera operação; retirar estímulo antes da autorização de energia.
+ Testar reset, cabo removido e perda de comunicação. A saída deve voltar a desligado; não assumir proteção contra ESP32 travado sem watchdog físico.
'''
doc+=page('9 — Limites que não desaparecem com a montagem')
doc+='''*Medição:* o divisor 10 kΩ/10 kΩ tem entrada de aproximadamente 20 kΩ e carrega o circuito. Não atende ao requisito final de pelo menos 1 MΩ. Não garante continuidade de 20 Ω/100 Ω nem identifica isoladamente um pogo quando há caminhos paralelos.

*Saída:* dois resistores separados de 470 Ω limitam a corrente de ALTO/BAIXO. Sob carga de 2 mA, só o resistor causa cerca de 0,94 V de queda; portanto os níveis finais exigidos não estão garantidos. A corrente ideal com 5,25 V/470 Ω a −1% é aproximadamente 11,29 mA; isso não qualifica transientes nem corrente agregada num pino compartilhado de matriz. O estímulo de 10 kΩ fica em torno de 0,531 mA nesse mesmo limite de fonte.

*Proteção:* proteção da fonte não substitui limitação local, intertravamentos e watchdog. Manter ALTO, BAIXO e TESTE desligados no boot. O fio PULSE_IN não representa sozinho os três estados alto, baixo e desconectado; o modo autorizado do roteador define quando a saída existe.

*Fabricação:* este guia é de perfboard. O candidato de PCB corroída em uma face teve tentativas de roteamento reprovadas; não usar estes desenhos como fotolito. Furos, corpos e cabos precisam de dry-fit; a quantidade real de linhas/colunas permanece pendente.

*Aceitação:* registrar tensões, correntes, cargas, instrumentos, firmware e fotos. Nenhum check de software deste documento representa medida ou liberação de um checkpoint físico.
'''
for section in dict.fromkeys(p['section']for p in parts):
 doc+=page('Esquema elétrico — '+section)
 doc+='Rótulos iguais unem redes entre folhas. Exportação nativa tscircuit do candidato existente; o esquema não representa fios por baixo da perfboard.\n'
 doc+=f'#align(center,image("assets/{section}.svg",width:265mm,height:150mm,fit:"contain"))\n'
doc=doc.replace('_'*20, '……………………').replace('_', '\\_')
(D/'wiring-guide.typ').write_text(doc)
for name,rows in [('wires.csv',[['ID','Rede','Origem','Destino','Funcao']]+[[w['id'],w['net'],w['from'],w['to'],w['function']]for w in wires]),('pins.csv',[['Ref','Pino','Nome','Rede','Coluna_TOP','Linha_TOP']]+[[q['ref'],q['pin'],q['label'],q['net']or'NC',q['c'],q['r']]for q in pins.values()]),('parts.csv',[['Ref','Valor','Tipo','Secao']]+[[p['ref'],p['value'],p['kind'],p['section']]for p in parts])]:
 with (D/name).open('w',newline='')as f:csv.writer(f).writerows(rows)
report={'parts':len(parts),'pins':len(pins),'wires':len(wires),'grid':{'columns':37,'rows':75,'pitchMm':2.54,'measured':False},'uniqueTerminalHoles':len(occupied)==len(pins),'endpointNetEquivalence':True,'wirePathRoutingVerified':False,'bodyFitMeasured':False,'poweredTestsPassed':False,'manufacturingRelease':False,'sourcePartsSha256':hashlib.sha256((S/'parts.json').read_bytes()).hexdigest()}
(D/'verification.json').write_text(json.dumps(report,indent=2)+'\n')
(D/'README.md').write_text('''# Guia provisório da perfboard do roteador

`wiring-guide.pdf`: guia PT-BR com vistas TOP/inferior, coordenadas provisórias, ligações numeradas, funções, cabos e testes. Candidato elétrico preservado em `../pcb-hct14-1face`. Malha de 37×75 assumida por autorização do usuário; não medida. Não libera soldagem antes do encaixe real e revisão.

`parts.csv`, `pins.csv`, `wires.csv`: conferência por terminais. `verification.json`: equivalência de redes, sem alegação de roteamento físico ou ensaio. Não é PCB corroída nem um novo roteador automático: linhas pontilhadas ilustram apenas origem/destino de fios isolados.

Gerar: `python3 generate.py` e depois `/home/gustavo/.cargo/bin/typst compile wiring-guide.typ` neste diretório. Reutiliza esquemas nativos já exportados do candidato, sem números de peça de conectores.
''')
print(json.dumps(report,indent=2))
