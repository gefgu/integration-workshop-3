""" parâmetros do sistema de visão.
tudo que depende da placa física, da câmera ou dos componentes reais fica aqui."""

import numpy as np

# ------------------------------------------------------------------ GEOMETRIA DA PLACA
# coordenadas em "unidades de socket": x = coluna, y = linha.
# metade de cima: linhas 0..5 ; metade de baixo: linhas GAP..GAP+5
N_COLUNAS = 11
N_LINHAS_METADE = 6
GAP = 7.5  # distância (em linhas) entre a 1a linha de cima e a 1a linha de baixo

def coord_modelo(metade, linha, coluna):
    """ posição (x, y) do socket no modelo da placa."""
    return (coluna, linha + (GAP if metade == 1 else 0))

# lista fixa com os 132 sockets: índice k -> (metade, linha, coluna)
SOCKETS = [(m, l, c) for m in (0, 1) for l in range(N_LINHAS_METADE) for c in range(N_COLUNAS)]
MODELO = np.float32([coord_modelo(*s) for s in SOCKETS])
METADES = ('C', 'B')  # nome das metades (Cima / Baixo) usado nos nós do grafo

# ------------------------------------------------------------------ DETECÇÃO DOS FUROS
CLAHE_CLIP = 2.0
THRESH_BLOCO = 31
THRESH_C = 8
FURO_AREA_MIN = 250
FURO_AREA_MAX = 2500
FURO_PROPORCAO = (0.6, 1.6)   # largura / altura
FURO_PREENCHIMENTO = 0.6      # área / área do retângulo envolvente

# ------------------------------------------------------------------ REGISTRO (HOMOGRAFIA)
DIST_CASAMENTO = 15.0   # px: distância máx. entre furo detectado e socket projetado
RANSAC_LIMIAR = 4.0     # px
MIN_INLIERS = 40        # abaixo disso o frame é descartado (mão na frente, etc.)
MAX_ERRO = 3.0          # px: erro mediano máximo aceitável
ITER_CALIBRACAO = 5
ITER_RASTREIO = 2

# ------------------------------------------------------------------ IMAGEM RETIFICADA
# pixels por unidade de socket (x e y têm passos físicos diferentes)
PX_X = 68
PX_Y = 40
MARGEM_X = 0.7
MARGEM_Y = 1.0
LARGURA_RET = int((N_COLUNAS - 1 + 2 * MARGEM_X) * PX_X)
ALTURA_RET = int((GAP + N_LINHAS_METADE - 1 + 2 * MARGEM_Y) * PX_Y)

def para_retificada(x, y):
    """ coordenada do modelo -> pixel na imagem retificada."""
    return ((x + MARGEM_X) * PX_X, (y + MARGEM_Y) * PX_Y)

# regiões amostradas na imagem retificada (meia-largura, meia-altura em px)
ROI_SOCKET = (9, 9)
ROI_PONTE = (5, 7)  # região entre dois sockets vizinhos (por cima da barra preta)

# ------------------------------------------------------------------ CORES
# faixas HSV do OpenCV (H: 0..179). AJUSTAR COM OS COMPONENTES REAIS
# (rodar `python -m visao imagem.jpg --cores` e olhar os valores impressos)
CORES = {
    'vermelho': [((0, 90, 70), (8, 255, 255)), ((165, 90, 70), (179, 255, 255))],
    'amarelo':  [((18, 90, 90), (38, 255, 255))],
    'verde':    [((39, 60, 40), (90, 255, 255))],
    'azul':     [((95, 90, 50), (135, 255, 255))],
    'branco':   [((0, 0, 185), (179, 45, 255))],
}
FRACAO_MIN_COR = 0.35  # fração mínima de pixels da ROI com a cor para considerar ocupado

# ------------------------------------------------------------------ COMPONENTES
# (cor, nº de sockets) -> tipo. Quando a mesma combinação serve a mais de um tipo,
# o desempate é feito pelo nº de pontos pretos na peça ('pontos': {n: tipo}).
# AJUSTAR conforme as peças reais.
COMPONENTES = {
    ('branco', 2):   {'tipo': 'jumper_curto'},
    ('branco', 3):   {'tipo': 'jumper_longo'},
    ('azul', 2):     {'tipo': 'resistor_ou_capacitor', 'pontos': {1: 'resistor', 2: 'capacitor'}},
    ('verde', 2):    {'tipo': 'led_ou_buzzer', 'pontos': {1: 'led', 4: 'buzzer'}},
    ('amarelo', 2):  {'tipo': 'botao'},
    ('amarelo', 3):  {'tipo': 'potenciometro'},
    ('vermelho', 2): {'tipo': 'vermelho_2'},
    ('vermelho', 3): {'tipo': 'vermelho_3'},
}

# quais sockets do componente são terminais elétricos (índices ao longo do componente).
# padrão: todos. O jumper longo passa por cima do socket do meio sem ligá-lo.
TERMINAIS = {
    'jumper_longo': (0, 2),
}

TIPOS_JUMPER = ('jumper_curto', 'jumper_longo')

# ------------------------------------------------------------------ FILTRO TEMPORAL
FRAMES_ESTAVEIS = 3         # nº de frames seguidos para aceitar uma mudança (3 frames = 0,6 s a 5 fps)
# socket "obstruído" = furo não aparece E não tem cor de componente (ex.: mão, sombra).
# acima desse número o frame é descartado
MAX_OBSTRUIDOS = 6
# movimento entre frames (na imagem retificada): fração de pixels que mudaram mais que DIFF_PIXEL.
# acima disso a cena não está parada (mão mexendo) -> frame descartado
DIFF_PIXEL = 30
MAX_FRACAO_MOVIMENTO = 0.03

# ------------------------------------------------------------------ CÂMERA
FPS = 5
