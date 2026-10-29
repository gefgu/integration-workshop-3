""" agrupa sockets coloridos em componentes.

um componente ocupa sockets de colunas vizinhas na MESMA linha (2 ou 3 sockets).
dois sockets vizinhos só pertencem ao mesmo componente se a "ponte" entre eles
(a barra preta entre as colunas) também estiver coberta pela mesma cor; isso separa
duas peças iguais encostadas lado a lado."""

from dataclasses import dataclass, field

import numpy as np
import cv2 as cv

from . import config as cfg
from .sockets import mascara_cor


@dataclass
class Componente:
    tipo: str
    cor: str
    metade: int
    linha: int
    colunas: list          # colunas ocupadas (em ordem)
    terminais: list        # colunas que são terminais elétricos
    pontos: int = None     # nº de pontos pretos (só calculado quando precisa desempatar)
    faixa: str = None      # cor da faixa do meio (peças azuis): define resistor/capacitor
    id: str = field(init=False)

    def __post_init__(self):
        self.id = f'{self.tipo}@{cfg.METADES[self.metade]}{self.linha}:{self.colunas[0]}-{self.colunas[-1]}'

    def redes(self):
        """ nós elétricos de cada terminal (coluna da metade)."""
        return [nome_rede(self.metade, c) for c in self.terminais]


def nome_rede(metade, coluna):
    return f'{cfg.METADES[metade]}{coluna}'


def _grupos_linha(cores, pontes):
    """ cores: (N_COLUNAS,), pontes: (N_COLUNAS-1,) de uma linha.
    retorna lista de (cor, [colunas])."""
    grupos = []
    c = 0
    while c < cfg.N_COLUNAS:
        cor = cores[c]
        if cor is None:
            c += 1
            continue
        fim = c
        # estende enquanto houver ponte da mesma cor; o socket do meio pode estar
        # vazio (jumper longo em arco), mas o grupo precisa terminar em socket colorido
        while fim + 1 < cfg.N_COLUNAS and pontes[fim] == cor and cores[fim + 1] in (cor, None):
            fim += 1
        while cores[fim] != cor:
            fim -= 1
        grupos.append((cor, list(range(c, fim + 1))))
        c = fim + 1
    return grupos


def le_faixa(ret_bgr, metade, linha, coluna):
    """ cor da faixa colorida sobre a ponte entre `coluna` e `coluna + 1` (peça azul), ou None.
    a peça fica um pouco acima do centro dos sockets, então a janela é mais alta para cima;
    o corpo azul e o preto da placa são ignorados e a cor é a do centro de FAIXAS mais próximo."""
    x, y = cfg.coord_modelo(metade, linha, coluna)
    cx, cy = (int(round(v)) for v in cfg.para_retificada(x + 0.5, y))
    meia, acima, abaixo = cfg.FAIXA_JANELA
    recorte = ret_bgr[max(0, cy - acima):cy + abaixo + 1, max(0, cx - meia):cx + meia + 1]
    if recorte.size == 0:
        return None
    hsv = cv.cvtColor(cv.GaussianBlur(recorte, (3, 3), 0), cv.COLOR_BGR2HSV).reshape(-1, 3).astype(float)
    colorido = (hsv[:, 1] > 60) & (hsv[:, 2] > 100) & ((hsv[:, 0] < 90) | (hsv[:, 0] > 140))
    if colorido.sum() < cfg.FAIXA_MIN_PIXELS:
        return None
    h, s, v = np.median(hsv[colorido], axis=0)
    melhor, dist_melhor = None, cfg.FAIXA_DIST_MAX
    for nome, faixa in cfg.FAIXAS.items():
        ch, cs, cv_ = faixa['hsv']
        dh = min(abs(h - ch), 180 - abs(h - ch))
        dist = np.sqrt((cfg.FAIXA_PESOS[0] * dh) ** 2 + (cfg.FAIXA_PESOS[1] * (s - cs)) ** 2
                       + (cfg.FAIXA_PESOS[2] * (v - cv_)) ** 2)
        if dist < dist_melhor:
            melhor, dist_melhor = nome, dist
    return melhor


def conta_pontos(ret_bgr, cor, metade, linha, colunas):
    """ conta manchas escuras dentro da área colorida da peça (desempate LED x buzzer etc.)."""
    x0, y = cfg.coord_modelo(metade, linha, colunas[0])
    x1 = colunas[-1]
    (px0, py), (px1, _) = cfg.para_retificada(x0, y), cfg.para_retificada(x1, y)
    hx, hy = cfg.ROI_SOCKET[0] * 3, cfg.ROI_SOCKET[1] * 3
    recorte = ret_bgr[max(0, int(py - hy)):int(py + hy), max(0, int(px0 - hx)):int(px1 + hx)]
    if recorte.size == 0:
        return 0

    hsv = cv.cvtColor(recorte, cv.COLOR_BGR2HSV)
    mask_cor = mascara_cor(hsv, cor)

    # só as manchas de cor que tocam os sockets desta peça (não pega a peça vizinha)
    _, rotulos = cv.connectedComponents(mask_cor)
    ox, oy = max(0, int(px0 - hx)), max(0, int(py - hy))
    proprios = set()
    for c in colunas:
        sx, sy = cfg.para_retificada(c, y)
        r = rotulos[int(sy) - oy - 3:int(sy) - oy + 4, int(sx) - ox - 3:int(sx) - ox + 4]
        proprios.update(np.unique(r[r > 0]).tolist())
    mask_cor = np.isin(rotulos, list(proprios)).astype(np.uint8) * 255

    # região da peça = envoltória convexa da cor; pontos = pixels escuros dentro dela
    contornos, _ = cv.findContours(mask_cor, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
    if not contornos:
        return 0
    peca = np.zeros_like(mask_cor)
    cv.drawContours(peca, [cv.convexHull(np.vstack(contornos))], -1, 255, -1)
    # afasta da borda da peça (pixels de transição são escuros e virariam "pontos")
    peca = cv.erode(peca, np.ones((7, 7), np.uint8), borderType=cv.BORDER_CONSTANT, borderValue=0)
    escuro = ((hsv[:, :, 2] < 60) & (peca > 0) & (mask_cor == 0)).astype(np.uint8)
    n, _, stats, _ = cv.connectedComponentsWithStats(escuro)
    return int(sum(1 for i in range(1, n) if stats[i, cv.CC_STAT_AREA] >= 4))


def identifica(cores, pontes, ret_bgr=None):
    """ cores: (2, 6, 11), pontes: (2, 6, 10) -> lista de Componente."""
    componentes = []
    pontes = pontes.copy()
    faixas = {}  # (metade, linha, coluna esquerda) -> cor da faixa
    if ret_bgr is not None:
        # dois sockets azuis vizinhos com faixa colorida entre eles são UMA peça: a faixa cobre a
        # ponte com outra cor, que sozinha separaria a peça em duas
        for m in range(2):
            for l in range(cfg.N_LINHAS_METADE):
                for c in range(cfg.N_COLUNAS - 1):
                    if cores[m, l, c] == 'azul' and cores[m, l, c + 1] == 'azul':
                        faixa = le_faixa(ret_bgr, m, l, c)
                        if faixa:
                            faixas[(m, l, c)] = faixa
                            pontes[m, l, c] = 'azul'

    for m in range(2):
        for l in range(cfg.N_LINHAS_METADE):
            for cor, colunas in _grupos_linha(cores[m, l], pontes[m, l]):
                regra = cfg.COMPONENTES.get((cor, len(colunas)))
                tipo = regra['tipo'] if regra else f'desconhecido_{cor}_{len(colunas)}'
                faixa = faixas.get((m, l, colunas[0])) if cor == 'azul' and len(colunas) == 2 else None
                if faixa:
                    tipo = cfg.FAIXAS[faixa]['tipo']
                pontos = None
                if regra and 'pontos' in regra and ret_bgr is not None and not faixa:
                    pontos = conta_pontos(ret_bgr, cor, m, l, colunas)
                    tipo = regra['pontos'].get(pontos, tipo)

                idx_terminais = cfg.TERMINAIS.get(tipo, range(len(colunas)))
                terminais = [colunas[i] for i in idx_terminais]
                componentes.append(Componente(tipo, cor, m, l, colunas, terminais, pontos, faixa))
    return componentes
