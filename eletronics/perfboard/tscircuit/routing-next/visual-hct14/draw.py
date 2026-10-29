from pathlib import Path
from html import escape
D=Path(__file__).resolve().parent
# Conceptual placement drawing only; this script does not route electrical nets.
styles='''<style>text{font-family:DejaVu Sans,sans-serif;fill:#183049}.heading{font-size:30px;font-weight:700}.sub{font-size:19px;fill:#546477}.ref{font-size:16px;font-weight:700}.small{font-size:13px}.boardtitle{font-size:24px;font-weight:700}.body{font-size:18px}.tiny{font-size:11px}</style>'''
def text(x,y,s,cls='small',anchor='middle',fill=None):
 return f'<text x="{x}" y="{y}" class="{cls}" text-anchor="{anchor}"'+(f' style="fill:{fill}"' if fill else '')+'>'+escape(s)+'</text>'
def board(kind):
 out=['<svg class="board" xmlns="http://www.w3.org/2000/svg" width="620" height="1180" viewBox="-6 -10 112 215">',styles.replace('text{','.board text{').replace('.heading{','.board .heading{').replace('.sub{','.board .sub{').replace('.ref{','.board .ref{').replace('.small{','.board .small{').replace('.boardtitle{','.board .boardtitle{').replace('.body{','.board .body{').replace('.tiny{','.board .tiny{').replace('30px','5px').replace('19px','3px').replace('16px','2.5px').replace('13px','2.1px').replace('24px','4px').replace('18px','3px').replace('11px','1.8px')]
 out+=['<defs><pattern id="holes" x="1.74" y=".9" width="2.54" height="2.54" patternUnits="userSpaceOnUse"><circle cx="1.27" cy="1.27" r=".85" fill="#c5a36d"/><circle cx="1.27" cy="1.27" r=".38" fill="#6e6656"/></pattern></defs>']
 out+=['<rect x="0" y="0" width="100" height="200" rx="1" fill="'+('#ead9b9' if kind=='perf' else '#ece8db')+'" stroke="#34495e" stroke-width=".4"/>']
 if kind=='perf':
  out+=['<rect x="5" y="5" width="90" height="190" fill="url(#holes)"/>']
  for x,y,w,h,col in [(6,1.3,88,2.4,'#b9825d'),(1.3,6,2.4,188,'#303844'),(96.3,6,2.4,188,'#c84a40'),(6,196.3,88,2.4,'#9a6949')]:out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="1" fill="{col}"/>')
  out.append(text(50,-3,'Borda superior: reserva','small'))
  out.append('<text x="-2" y="100" transform="rotate(-90 -2 100)" class="small" text-anchor="middle">GND — borda esquerda</text>')
  out.append('<text x="102" y="100" transform="rotate(90 102 100)" class="small" text-anchor="middle">5 V — borda direita</text>')
  out.append(text(50,204,'12 V — borda inferior','small'))
 else:
  # Shaded corridors are reservations for professional routing, NOT copper tracks.
  for x,y,w,h in [(44,74,12,87),(8,103,10,57),(82,103,10,57),(5,163,90,6)]:out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#caa76b" fill-opacity=".2" stroke="#b6945f" stroke-width=".2" stroke-dasharray="1 1"/>')
  out.append(text(50,-3,'Vista dos componentes; cobre na face inferior','small'))
  out.append(text(50,204,'Corredores dourados = espaço reservado, sem trilhas','tiny'))
 for x in[5,95]:
  for y in[5,195]:out.append(f'<circle cx="{x}" cy="{y}" r="1.6" fill="white" stroke="#6c7a86" stroke-width=".25"/>')
 def box(x,y,w,h,ref,label,fill='#d4e5f6',dip=False):
  out.append(f'<rect x="{x-w/2}" y="{y-h/2}" width="{w}" height="{h}" rx=".7" fill="{fill}" stroke="#38536d" stroke-width=".3"/>')
  out.append(text(x,y-.5,ref,'ref'));out.append(text(x,y+3,label,'tiny'))
  if dip:
   n=20 if ref in ['U1','U2'] else 8 if ref in ['U5','U6'] else 7
   for i in range(n):
    yy=y-(n-1)*2.54/2+i*2.54
    for xx in[x-w/2-.7,x+w/2+.7]:out.append(f'<circle cx="{xx}" cy="{yy}" r=".45" fill="#666" stroke="#eee" stroke-width=".1"/>')
   out.append(f'<circle cx="{x-w/2+1.6}" cy="{y-h/2+1.6}" r=".6" fill="#fff"/>')
 # Complete module outline and USB access, with antenna at lower end.
 box(50,25,30,48,'','','#263e55')
 out.append('<rect x="44" y="-1.5" width="12" height="6" rx=".6" fill="#a8b6c4" stroke="#233f55" stroke-width=".25"/>')
 out.append(text(50,10,'USB','small',fill='#ffffff'));out.append(text(50,25,'ESP32','ref',fill='#ffffff'));out.append(text(50,29,'DevKit de 30 pinos','tiny',fill='#ffffff'))
 out.append('<rect x="38" y="39" width="24" height="8" fill="#fff2b2" stroke="#bea74a" stroke-width=".2"/>');out.append(text(50,44,'ANTENA: sem cobre','tiny'))
 # Input defaults sit between MCU and Schmitt inverter.
 for i in range(5):out.append(f'<rect x="{30+i*8}" y="51" width="5" height="1.5" rx=".3" fill="#e3c49d" stroke="#806d55" stroke-width=".15"/>')
 out.append(text(50,50,'5 resistores de estado inicial','tiny'))
 box(50,65,9,20,'U_LEVEL','74HCT14','#dcd6f4',True)
 box(28,92,9,22,'U5','74HC595','#dcd6f4',True);box(72,92,9,22,'U6','74HC595','#dcd6f4',True)
 box(28,134,17,53,'U1','MT8816 — cima','#cce5ef',True);box(72,134,17,53,'U2','MT8816 — baixo','#cce5ef',True)
 box(8,134,3,29,'H1','', '#d5dce4');box(92,134,3,29,'H3','', '#d5dce4')
 out.append(text(8,115,'11 nós','tiny'));out.append(text(92,115,'11 nós','tiny'))
 box(15,72,18,15,'RESET','Q6 + 3 resistores','#f4d9bb')
 for x,y,lab in [(14,56,'5 V'),(86,56,'12 V')]:
  out.append(f'<circle cx="{x}" cy="{y}" r="3" fill="#536776" stroke="#233b4c" stroke-width=".3"/>');out.append(text(x,y+.7,'+','small',fill='#fff'));out.append(text(x,y-4,lab,'tiny'))
 for x,y in[(58,65),(38,92),(62,92),(40,111),(60,111)]:out.append(f'<rect x="{x-1.5}" y="{y-1}" width="3" height="2" rx=".4" fill="#d8ad67" stroke="#876d3d" stroke-width=".2"/>')
 box(20,180,24,22,'ALTO','Q7/Q8 + 470 Ω','#f6dbd0');box(50,180,22,22,'BAIXO','Q11 + 470 Ω','#f6dbd0');box(80,180,22,22,'TESTE','Q9/Q10 + 10 kΩ','#d7eadb')
 box(18,194,12,3,'H2','', '#d5dce4');box(79,194,12,3,'J_SMART','', '#d5dce4')
 out.append(text(18,191,'12 V / 5 V / NC / GND','tiny'));out.append(text(79,191,'A / GND / B / CMD','tiny'))
 if kind=='pcb':
  out.append('<rect x="43" y="80" width="14" height="3" rx=".5" fill="#fffaf0" stroke="#a98e61" stroke-dasharray=".5 .5" stroke-width=".2"/>')
  out.append(text(50,82,'pontes: reservar','tiny'))
 out.append('</svg>');return ''.join(out)
for kind in ['perf','pcb']:(D/f'{kind}.svg').write_text(board(kind))
S=['<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1560" viewBox="0 0 1800 1560">',styles,'<rect width="1800" height="1560" fill="#f6f8fa"/>',text(70,65,'Duas montagens para o mesmo circuito','heading','start'),text(70,104,'2 MT8816 + 2 × 74HC595 + 1 × 74HCT14 | placa de 100 × 200 mm','sub','start')]
S+=[text(410,155,'PERFBOARD — FIOS E BORDAS','boardtitle'),text(1320,155,'PCB CORROÍDA — FACE ÚNICA','boardtitle')]
# Embed vector drawings; no photo manipulation and no fabricated electrical routing.
for x,kind in[(80,'perf'),(990,'pcb')]:
 inner=board(kind);a=inner.index('>')+1;inner=inner[a:inner.rfind('</svg>')]
 S.append(f'<svg class="board" x="{x}" y="180" width="620" height="1180" viewBox="-6 -10 112 215">{inner}</svg>')
for x,lines in[(70,['Bordas distribuem GND, 5 V e 12 V.','Fios isolados fazem as ligações de sinais.','Cruzamentos de fios são possíveis com isolamento.']),(980,['Mesmos blocos; ilhas só nos terminais necessários.','Trilhas em uma face; pontes isoladas por cima.','Corredores mostrados não são trilhas prontas.'])]:
 for i,l in enumerate(lines):S.append(text(x,1400+28*i,l,'body','start'))
S.append(text(900,1530,'VISÃO CONCEITUAL — não é guia por furos, máscara de corrosão ou comprovação de encaixe.','body'));S.append('</svg>');(D/'comparativo.svg').write_text(''.join(S))
