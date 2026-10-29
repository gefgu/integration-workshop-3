from pathlib import Path
import json, html, collections, subprocess
D=Path(__file__).resolve().parent
parts=json.loads((D/'parts.json').read_text()); circuit=json.loads((D/'placement.circuit.json').read_text())
E=html.escape
# Placement visualization only. No fabricated tracks and no custom routing.
colors={'ESP32':'#e1e8f0','AdaptacaoSerial':'#fff0c4','AdaptacaoControle':'#fff0c4','Registros':'#e6dffc','MatrizA':'#dceeff','MatrizB':'#dceeff','Pulso':'#ffe1da','Continuidade':'#def3e7','Interfaces':'#eee'}
def placement(mirror=False):
 s=['<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="200mm" viewBox="0 0 100 200">','<rect x=".2" y=".2" width="99.6" height="199.6" fill="#fffef9" stroke="#222" stroke-width=".4"/>']
 if mirror:s.append('<g transform="translate(100 0) scale(-1 1)">')
 for x in[5,95]:
  for y in[5,195]:s.append(f'<circle cx="{x}" cy="{y}" r="1.6" fill="white" stroke="#777" stroke-width=".3"/>')
 # Provisional complete module envelope, not just socket footprints.
 s.append('<rect x="34" y="0" width="32" height="50" fill="#dde4ed" fill-opacity=".45" stroke="#6c7a8a" stroke-dasharray="1 1" stroke-width=".3"/>')
 for p in parts:
  x,y=p['x']+50,100-p['y'];kind=p['kind']
  w,h=(17,52) if p['value']=='MT8816AE1' else (10,22) if kind=='IC' else (9,2.2) if kind=='R' else (6.3,6.3) if p.get('polarized') else (5.5,4.5) if kind=='Q' else (4,4) if kind=='C' else ((3,max(3,(len(p['pins'])-1)*2.54+3)) if p.get('rotation')==270 else(max(3,(len(p['pins'])-1)*2.54+3),3))
  if kind=='Q':y-=1.6
  s.append(f'<rect x="{x-w/2}" y="{y-h/2}" width="{w}" height="{h}" rx=".5" fill="{colors[p["section"]]}" stroke="#555" stroke-width=".15"/>')
  s.append(f'<text x="{x}" y="{y+.5}" text-anchor="middle" font-family="sans-serif" font-size="{1.7 if kind in ["IC","J"] else 1.3}">{E(p["ref"])}</text>')
  if kind=='IC':s.append(f'<circle cx="{x-w/2+1.6}" cy="{y-h/2+1.6}" r=".6" fill="#222"/>')
 if mirror:s.append('</g>')
 s.append('</svg>');return ''.join(s)
(D/'assets/layout-top.svg').write_text(placement());(D/'assets/layout-mirrored.svg').write_text(placement(True))
# A native schematic is included for every electrical sheet; diagrams keep purchased connector MPNs hidden.
sections=list(dict.fromkeys(p['section'] for p in parts))
checks=json.loads((D/'checks.json').read_text())
import xml.etree.ElementTree as ET
ET.register_namespace('', 'http://www.w3.org/2000/svg')
for sec in sections:
 root=ET.fromstring((D/'assets'/f'{sec}.svg').read_text())
 for child in list(root):
  if child.attrib.get('class') in ['boundary','schematic-sheet']:root.remove(child)
 ET.ElementTree(root).write(D/'assets'/f'{sec}-content.svg',encoding='unicode')
subprocess.run([str(D.parents[1]/'node_modules/.bin/bun'),str(D/'crop-schematics.mjs')],check=True)

import re
def q(x):
 s=str(x)
 s=re.sub(r'([a-záéíóúãõç])(?=(?:GPIO|GND|BUS|RESET|USB|ESP32|MT8816|LED|PULSE|STROBE|HIGH|LOW|VIN|PCB|ERC|DRC|SENSE|NODE|EFR))',r'\1 ',s)
 s=re.sub(r'([a-záéíóúãõç])(?=[0-9])',r'\1 ',s)
 s=re.sub(r'(?<=[0-9])(?=(?:mm|mA|nF|µF|V|Ω)\b)',' ',s)
 s=re.sub(r',(?=[A-Za-zÁÉÍÓÚáéíóú])',', ',s)
 s=re.sub(r'([a-záéíóúãõç])(?=[QRUCH][0-9])',r'\1 ',s)
 s=s.replace('R_LOW_PD100','R_LOW_PD 100').replace('R_LOW_LIMIT470','R_LOW_LIMIT 470')
 return json.dumps(s,ensure_ascii=False)
T='''#set page(paper: "a4", flipped: true, margin: 14mm, numbering: "1")
#set text(font: "DejaVu Sans", size: 10pt, lang: "pt")
#set par(leading: .5em)
#set heading(numbering: none)
#let title(s) = { heading(level: 1, s); v(2mm) }
#let note(s) = block(fill: rgb("fff0cf"), inset: 3mm, width: 100%, text(size: 9pt, s))
'''
def page(title):
 global T
 if T.count('#title('):T+='\n#pagebreak()\n'
 T+='#title('+q(title)+')\n'
def para(s):
 global T
 T+='#text('+q(s)+')\n#parbreak()\n'
def note(s):
 global T
 T+='#note('+q(s)+')\n#v(2mm)\n'
def table(headers,rows,widths=None):
 global T
 T+='#table(columns: '+('('+','.join(widths)+')' if widths else str(len(headers)))+', inset: 2mm, stroke: .4pt + rgb("cccccc"), table.header('+','.join('text(weight: "bold", '+q(h)+')' for h in headers)+'),'+','.join(q(c) for row in rows for c in row)+')\n'
page('Roteador: 2 MT8816 + 2 registradores — PCB 100 × 200 mm')
note('PLANEJAMENTO DE ENGENHARIA — NÃO USAR COMO MÁSCARA DE CORROSÃO. O posicionamento foi verificado em software; o roteamento de cobre e a lista física de pontes ainda não estão concluídos.')
para('Versão de 29/10/2026. Substitui a proposta de três MT8816 e controle direto por buffers. Mantém os dois 74HC595, os transistores de adaptação e o RESET do projeto do amigo. Não modifica o arquivo EasyEDA original nem a placa inteligente já soldada.')
table(['Decisão','Configuração'],[['Placa','Uma PCB de face única, 100 × 200 mm, com componentes PTH e soquetes.'],['Matriz','U1 atende NODE00…NODE10; U2 atende NODE11…NODE21. Nós no lado X.'],['Barramentos','Y5/Y6/Y7 privados por metade; Y0…Y4 dedicados a GND/saída/teste/medição.'],['Controle','Dois 74HC595 a 5 V, comandos do ESP32 adaptados por NPN.'],['Saídas','5 V por PNP/NPN; nível baixo por NPN; limitação resistiva independente.'],['Medição','Duas entradas externas da placa inteligente, um par selecionado por vez.'],['Montagem','Cobre sem cruzamentos; pontes de fio isolado pelo lado dos componentes, autorizadas pelo usuário.']])
para('Hipótese de operação: um experimento alimentado/estimulado por vez. Não há duas saídas de pulso independentes. Não há isolamento galvânico entre as metades: GND e serviços são comuns. As rotas de serviço nunca podem selecionar as duas metades simultaneamente de modo a uni-las.')
page('Como funciona e o que é compartilhado')
para('O Raspberry coordena o ESP32 do roteador por USB e o ESP32 inteligente por UART. O roteador recebe os caminhos desejados, programa os registradores e grava as conexões nos MT8816. Os próprios MT8816 retêm o estado de suas chaves.')
para('O GPIO27 da placa inteligente envia PULSE_CMD ao GPIO34 do roteador. O GPIO27 do roteador controla o transistor de nível baixo: são GPIOs de placas diferentes e não se ligam diretamente entre si.')
table(['Y / código binário AY2…AY0','Ligação','Regra'],[['Y0 / 000','GND comum','Retorno escolhido; não aterrar capacitor carregado diretamente.'],['Y1 / 001','PULSE_BUS','Fonte/nível baixo limitado; uma metade autorizada.'],['Y2 / 010','TEST_BUS','Somente precheck com energia normal removida.'],['Y3 / 011','SENSE_A','Selecionar um ponto por leitura.'],['Y4 / 100','SENSE_B','Selecionar o segundo ponto da mesma leitura.'],['Y5 / 101','BUS_A5 ou BUS_B5','Privados: não ligar fisicamente A5 a B5.'],['Y6 / 110','BUS_A6 ou BUS_B6','Privados: não ligar fisicamente A6 a B6.'],['Y7 / 111','BUS_A7 ou BUS_B7','Privados: não ligar fisicamente A7 a B7.']])
para('As duas metades podem manter suas ligações internas enquanto a medição alterna entre elas. Compartilhar a mesma saída em duas metades as acoplaria pelo barramento de serviço; o firmware desta proposta não permite isso. Três barramentos gerais por metade atendem os exemplos básicos, mas o grafo de cada aula deve ser validado antes de aceitar a configuração.')
page('Posicionamento proposto — vista superior e inferior espelhada')
T+='#grid(columns: (82mm,82mm,1fr), gutter: 6mm, [#image("assets/layout-top.svg", height: 155mm)], [#image("assets/layout-mirrored.svg", height: 155mm)], [\n'
para('Esquerda: componentes vistos de cima. Centro: referência inferior espelhada. As caixas representam corpos aproximados; não são trilhas nem uma máscara de cobre.')
para('USB junto à borda superior. Reservar o corpo completo do ESP32, acesso ao conector e antena sem cobre sob a região da antena. Os soquetes do DevKit estão provisoriamente separados por 25,4 mm; medir a placa real.')
para('Conectores dos nós nas laterais, alimentação e placa inteligente nas laterais inferiores. Fontes e retorno concentrados no bloco inferior. Furos de montagem candidatos a 5 mm das bordas, diâmetro 3,2 mm.')
T+='])\n'
page('Coordenadas para transferir ao EasyEDA')
para('Origem mecânica: canto superior esquerdo. X cresce para a direita; Y cresce para baixo. O modelo tscircuit usa centro da placa: X_EasyEDA = X_modelo + 50; Y_EasyEDA = 100 − Y_modelo. Não renumerar os conectores ao espelhar a vista inferior.')
main=[p for p in parts if p['kind'] in ['IC','J']]
table(['Referência','Função','X / Y no desenho (mm)'],[[p['ref'],p['value'] if p['kind']=='IC' else {'J_ESP_L':'Soquete ESP32 esquerdo','J_ESP_R':'Soquete ESP32 direito','H1':'Nós superiores','H3':'Nós inferiores','H2':'Alimentação','J_SMART':'Interface inteligente'}[p['ref']],f"{p['x']+50:.2f} / {100-p['y']:.2f}"] for p in main])
para('O CSV bom.csv contém as coordenadas dos demais componentes. As caixas do desenho são reservas de espaço; as posições de pino 1 e dos furos de cada footprint devem ser conferidas no encapsulamento comprado. Os transistores devem ser conferidos por C/B/E, nunca apenas pela face achatada.')
page('Pinagem dos nós — troca obrigatória no esquema original')
table(['Pino do conector H1/H3','H1 → U1','H3 → U2','X / pino físico MT8816'],[[i+1,f'NODE{i:02d}',f'NODE{i+11:02d}',f'X{i} / pino {pin}'] for i,pin in enumerate([33,32,31,30,29,28,8,9,10,11,12])])
para('X11…X15 ficam desconectados. Pinos 14 e 34 são NC do MT8816. VDD pino40 em12V; VSS16 e VEE20 emGND. Não usar o mapa antigo em que os nós eram ligados aos Y. Para X0…X10, o endereço AX3…AX0 é a numeração binária correspondente. X12…X15 possuem particularidades de decodificação e não são usados aqui.')
page('Controle por registradores e inicialização')
table(['GPIO do ESP32 roteador','Bloco original','Sinal após transistor'],[['23','Q1 / R19 / R20 / R2','SER5, invertido'],['18','Q2 / R22 / R23 / R3','CLK5, invertido'],['22','Q3 / R25 / R26 / R4','LATCH5, invertido'],['19','Q4 / R28 / R29 / R5','STROBE5, invertido'],['21','Q5 / R31 / R32 / R1','OE_N5: GPIO alto habilita saídas'],['25','Q6 / R6 / R12 / R7','RESET12: GPIO baixo força reset'],['26','Q8 / Q7','HIGH_REQ'],['27','Q11','LOW_REQ'],['14','Q10 / Q9','TEST_REQ'],['34','J_SMART.4 + pull-down47k','Entrada PULSE_CMD, somente3,3V']])
para('U5: QA…QH = AX0,AX1,AX2,AX3,AY0,AY1,AY2,DATA. U6: QA=CS_A e QB=CS_B; demais saídas ficam NC. U5.QH\' vai a U6.SER; as duas entradas SRCLR_N ficam em5V. Enviar primeiro o byte de U6 e depois o de U5, conforme ordem de bits validada em bancada. Nunca atualizar a saída do registrador com STROBE alto.')
para('Pull-ups dos cinco conversores5V:1k; resistores de base:4,7k; base–GND:100k. São mudanças em relação aos4,7k/10k do arquivo original para melhorar bordas das entradasHC; confirmar subida/descida com osciloscópio. O RESET conserva R7=47k para12V, R6=10k eR12=100k.')
para('Partida: GPIO25=0 mantémRESET ativo;GPIO21=0 mantémOE desabilitado;GPIO26/27/14=0 desligam alto,baixo e teste. ColocarGPIO19=1 paraSTROBE baixo, inicializarCLK/LATCH invertidos e gravar os16bits emzero. HabilitarOE comGPIO21=1 e só então liberarRESET comGPIO25=1. Emfalha, desligar as saídas e forçarRESET. Essa sequência ainda precisa ser implementada e testada no firmware.')
page('Saída com transistores: alto, baixo e desconectado')
para('HIGH_REQ GPIO26 → R13 10k → Q8 NPN. ColetorQ8 → R30 4,7k → baseQ7 PNP. EmissorQ7 em5V e R21 47k entre base/emissor. ColetorQ7 → R17 470Ω,1%,1/4W → PULSE_BUS.')
para('LOW_REQ GPIO27 → R_LOW_BASE 4,7k → baseQ11 NPN. R_LOW_PD100k entre base eGND. EmissorQ11 emGND. PULSE_BUS → R_LOW_LIMIT470Ω,1%,1/4W → coletorQ11.')
table(['HIGH_REQ','LOW_REQ','Saída'],[['0','0','Ambos desligados; abrir as chaves para desconectar o experimento.'],['1','0','Nível alto através de470Ω e dos MT8816.'],['0','1','Nível baixo através de470Ω e dos MT8816.'],['1','1','Configuração proibida: produz divisão de tensão, não um pulso válido.']])
para('Os resistores são separados, um em cada ramo. Assim, uma sobreposição não curto-circuita diretamente5V eGND pelos transistores. Mesmo assim, o firmware deve desligar ambos antes de trocar alto/baixo e confirmar tempo morto adequado à comutação. Ambos os comandos têm pull-down e começam desligados.')
note('5V é a alimentação antes dos resistores. Em2mA cada470Ω perde0,94V, além dos transistores e da matriz. Este limitador simples NÃO garante os níveis de saída carregada do requisito original. Se tais níveis forem obrigatórios, o bloco precisa de limitação ativa antes de fabricação final.')
page('Continuidade e medição — sequência de uso')
para('Reaproveitar Q9/Q10 do estágio3,3V original, mas alimentar o emissor deQ9 com5V. R24=47k, R27=10k, R15=10k, R16=100k. ColetorQ9 → R18=10kΩ,1% → TEST_BUS. Comando passa aGPIO14, independente do GPIO26.')
table(['Etapa','Ação'],[['1. Desenergizar','HIGH_REQ=LOW_REQ=TEST_REQ=0; abrir rotas de saída. Verificar fontes externas e descarga de capacitores.'],['2. Selecionar','NóA→TEST_BUS eSENSE_A; nóB→GND eSENSE_B. Não selecionar nós da outra metade.'],['3. Estimular','TEST_REQ=1; corrente pelo resistor≤0,531mA para fonte≤5,25V.'],['4. Ler','Placa inteligente medeA/B. Comparar curto, aberto e resistências conhecidas após calibração.'],['5. Encerrar','TEST_REQ=0; abrir rotas de teste; invalidar resultado se houver mudança de montagem.'],['6. Operar','Configurar o circuito autorizado e só então aplicarDC ou pulso.']])
para('J_SMART: pino1SENSE_A,2GND,3SENSE_B,4PULSE_CMD. A/B entram nos divisores da placa inteligente, nunca diretamente noESP32. O divisor10k/10k apresenta20kΩ e interfere na leitura; não cumpre entrada≥1MΩ. O método não garante limiares20/100Ω, contato de cada pogo isoladamente nem identidade da peça. Leituras inconclusivas não autorizam energia.')
page('Alterações no EasyEDA — preserve o que pode ser reaproveitado')
table(['Ação','Referências / conexões'],[['Manter','U1/U2,U5/U6,U7 eQ1…Q10, com as alterações de funções e valores descritas.'],['Remover','U3,C3,R10 eR11: o terceiro MT8816 e o autoteste entre seusY6/Y7 não existem nesta organização.'],['Reconectar nós','H1 mantém NODE00…10;H3 mantém NODE11…21;destinos passam aosX correspondentes.'],['Não unir','BarramentosY5…Y7 da metadeA aos da metadeB.'],['Mudar valores','R1…R5 para1k;R19/R22/R25/R28/R31 para4,7k;R17 para470Ω,1%;R30 para4,7k;R18 para10kΩ,1%.'],['Reaproveitar estágio3,3V','Q9/Q10 agora são estímulo5V/10k, comandoGPIO14. Retirar3V3_SYS dessa função.'],['Acrescentar','Q11, resistor de base4,7k,pull-down100k e limitador470Ω;J_SMART e pull-down47k na entrada de comando.'],['Alimentação','H2:1=12V,2=5V,3=NC,4=GND. C_BULK5 eC_BULK12=47µF;100nF junto a cada um dos quatroCIs.'],['USB','ESP32 roteador alimentado porUSB; não ligarVIN à fonte externa em paralelo. Confirmar origem real dos12V.']])
para('Salvar uma cópia do projeto e atualizar esquema→PCB somente após revisar o netlist. O mapa antigo de trêschips não pode ser usado para apenas apagarU3. O arquivoEasyEDA fornecido continua intacto; este pacote contém fonte tscircuit, tabelas e PDF para transferir e auditar as alterações.')
page('Cobre de face única — regras para identificar as pontes')
note('Nenhum SVG deste pacote é uma máscara de corrosão. Não há trilhas completas aprovadas nem tabela final de pontes. A ausência de linhas no desenho de posicionamento não comprova que o roteamento esteja resolvido.')
para('Regra de fabricação: uma única face de cobre, sem sobreposição de trilhas de redes diferentes. Pontes de fio isolado no lado dos componentes são permitidas. Cada ponte final deve aparecer comoJP01,JP02… no desenho de montagem, com dois pads furados, rede, comprimento e origem/destino na tabela. Não usar segmentos de cobre da segunda face como se fossem pontes automaticamente fabricadas.')
para('Plano de roteamento: primeiro saídasNODE→conectores laterais; depois barramentos privados de cada metade; em seguida linhas analógicas de serviço; depois endereço/dados/CS/STROBE; por último alimentação eGND. Não cruzar o cobre de sinais; usar pontes nas ligações de controle que bloquearem corredores. Manter5V e12V longe das entradas de medição e reservar a região da antena doESP32 sem cobre.')
para('Valores iniciais para negociar com o profissional: trilha mínima0,4mm e espaçamento0,25mm; trilhas de alimentação/GND preferencialmente0,8–1mm. Esses números são premissas, não capacidade medida do processo. Ajustar largura, ilha e furação ao soquete comprado antes de rotear. FurosPTH em placa caseira não são metalizados: toda conexão deve ser soldável pela face de cobre. Pontes têm de atravessar furos próprios e aparecer na montagem.')
para('O autorroteador nativo foi tentado com uma camada. A tentativa não produziu roteamento completo validado nesta entrega. Isso não prova impossibilidade; significa que o profissional deve concluir o roteamento e as pontes antes de gerar o fotolito. Não gerarGerbers/fotolito a partir deste posicionamento sem esse fechamento.')
page('Conferência antes de corroer e montagem incremental')
para('1. Confirmar as medidas doDevKit, separação dos soquetes, soquetesDIP40/DIP16, transistores e conectores. Reservas gráficas não verificam o hardware comprado.')
para('2. Fechar as trilhas e pontes noEasyEDA. RodarERC/DRC; zero conexões pendentes; conferir cobre contra netlist e ausência de curtos; inspecionar os dois lados e a orientação do desenho de transferência. Revisar a tabela de pontes com o profissional.')
para('3. Imprimir uma prova1:1 e encaixar os componentes SEM soldar. Conferir régua de escala, todos os pinos,USB,antena,cabos e fixação. A prova é de encaixe, não um fotolito aprovado.')
para('4. Após corrosão/furação, testar continuidade das trilhas e isolamento antes dosCIs. Soldar primeiro pontes, resistores, soquetes e capacitores. Conferir5V/12V eRESET sem osMT8816.')
para('5. Testar os registradores com saídas conhecidas e níveis com osciloscópio. Instalar umMT8816, testar abre/fecha e cada endereço. Só depois instalar o segundo e os cabos dos22nós.')
para('6. Testar alto/baixo/curto aGND e5V no estágio de saída com fontes limitadas e resistores verificados. Calibrar medição e continuidade com curto/aberto/1kΩ. Repetir reset, perda deUSB/comunicação e alteração de montagem.')
para('Este candidato não altera os checkpointsCP00–CP36 nem transforma verificações de software em evidência medida. Preservar a placa inteligente e as outras placas já construídas. As etapas desta página são pré-requisitos e ensaios locais do roteador, não uma nova liberação de todos osCPs.')
page('Lista de peças — semicondutores, capacitores e interfaces')
rows=[]
for p in parts:
 if p['kind']!='R':rows.append([p['ref'],p['value'] if p['kind']!='J' else str(len(p['pins']))+' pinos',p['footprint']])
T+='#set text(size: 8.5pt)\n'
for ix in range(0,len(rows),14):
 if ix:page('Lista de peças — continuação')
 table(['Ref.','Valor / função','Encapsulamento provisório'],rows[ix:ix+14])
T+='#set text(size: 10pt)\n'
para('Adicionar um móduloESP32 de30pinos, doissoquetesDIP40, doissoquetesDIP16 e os soquetes doDevKit. Pontes, parafusos e conectores comprados ainda não estão identificados porMPN. Capacitores eletrolíticos: tensão nominal≥16V no ramo12V e≥10V no ramo5V. Conferir polaridade.')
for chunk,start in [(parts,0)]:
 rs=[p for p in parts if p['kind']=='R']
 for ix in range(0,len(rs),18):
  page('Resistores — lista '+str(ix//18+1))
  table(['Ref.','Valor','Função / bloco'],[[p['ref'],p['value']+(' Ω, 1%, 1/4W' if p['ref'] in ['R17','R_LOW_LIMIT'] else 'Ω, 1%' if p['ref']=='R18' else 'Ω, 1/4W'),p['section']] for p in rs[ix:ix+18]])
  para('Todos os valores comk são emkΩ. Limites calculados com5,25V e resistores1%:470Ω mínimo465,3Ω →11,29mA;10kΩ mínimo9,9kΩ →0,531mA. Os limites dependem de o circuito não contornar esses resistores.')
page('O que foi verificado e o que permanece pendente')
table(['Verificação','Resultado'],[[k,'Sem ocorrências no modelo' if not v else str(len(v))+' ocorrências'] for k,v in checks.items()]+[['Schematic-placement e placement','Passaram no candidato de posicionamento.'],['Curto/estilo em pads','Executados sem cobre roteado; não verificam trilhas finais.'],['Roteamento de uma face / pontes','Não concluído; nenhum fotolito liberado.'],['Encaixe físico e ensaios elétricos','Pendentes.'],['Firmware','Não implementado neste pacote.']])
para('Limitações de requisitos: entrada20kΩ não atende≥1MΩ nem fuga≤10µA com placa desligada; limitadores resistivos não garantem os níveis sobcarga;RESET padrão não cobreESP32 travado comsaída mantida. Portanto, este é um candidato simples para engenharia/protótipo e não um produto final conforme todos os requisitosoriginais. Fechar essas diferenças antes da fabricação definitiva.')
para('Fontes: MT8816 (Zarlink/Microchip), datasheet de setembro2011; SN74HC595 (TexasInstruments), revisãoJ; BC548B/BC557B (onsemi), pinagemC/B/E1/2/3 conforme fontes citadas. Consultas em29/10/2026. URLs completos noREADME deste pacote.')
for section in sections:
 page('Esquema tscircuit — '+section)
 note('Conexões por nomes de rede mantêm o netlist completo. Esta folha é elétrica; cruzamentos gráficos do esquema não são trilhas de PCB. PCB de face única ainda requer fechamento do cobre e das pontes.')
 T+='#align(center, image('+q('assets/'+section+'-content.svg')+', width: 250mm, height: 145mm, fit: "contain"))\n'
(D/'planejamento-pcb-2mt-595.typ').write_text(T)
subprocess.run(['/home/gustavo/.cargo/bin/typst','compile',str(D/'planejamento-pcb-2mt-595.typ'),str(D/'planejamento-pcb-2mt-595.pdf')],check=True)
print('PDF generated; placement only, no etching mask.')
