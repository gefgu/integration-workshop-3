# Visão conceitual: HCT14, perfboard com bordas e PCB de face única

[Comparação visual](comparativo.png) · [PDF de três páginas](comparativo.pdf) · [SVG ampliável](comparativo.svg).

Distribuição de blocos para duas alternativas de 100 × 200 mm. Inclui o HCT14 sugerido em conversa. Não é uma alteração do circuito nativo anterior: o esquema anterior `pcb-2mt-595` ainda representa os cinco conversores discretos. Este desenho não mostra todas as peças individualmente nem fios/trilhas de fabricação.

Bordas da perfboard separadas e ilhas centrais individuais: informação confirmada pelo usuário. Quantidade de furos, encaixe dos soquetes, posições finais de resistores/transistores e roteamento ainda não verificados. Pontes isoladas autorizadas para PCB de uma face; nenhum número final de pontes foi estabelecido.

`draw.py` gera os desenhos vetoriais; `render.mjs` gera a prévia PNG. Não implementam um roteador, não modificam fotos e não geram cobre. `comparativo.typ` gera o PDF.
