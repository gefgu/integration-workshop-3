""" leitura do estado de cada socket (cor) e das "pontes" entre sockets vizinhos.

tudo é feito sobre a imagem RETIFICADA (vista de cima canônica), onde cada
socket ocupa sempre o mesmo retângulo, independente de rotação/deslocamento da câmera."""

import numpy as np
import cv2 as cv

from . import config as cfg

# transformação modelo -> imagem retificada (constante)
_T = np.float64([[cfg.PX_X, 0, cfg.MARGEM_X * cfg.PX_X],
                 [0, cfg.PX_Y, cfg.MARGEM_Y * cfg.PX_Y],
                 [0, 0, 1]])

NOMES_CORES = list(cfg.CORES)


def retifica(image, H):
    """ H: modelo -> imagem. retorna a vista de cima da placa."""
    M = _T @ np.linalg.inv(H)
    return cv.warpPerspective(image, M, (cfg.LARGURA_RET, cfg.ALTURA_RET))


def mascara_cor(hsv, cor):
    """ máscara 0/255 de uma cor; a abertura remove pixels isolados
    (o preto da placa tem ruído que às vezes cai na faixa de alguma cor)."""
    m = np.zeros(hsv.shape[:2], np.uint8)
    for lo, hi in cfg.CORES[cor]:
        m |= cv.inRange(hsv, np.array(lo), np.array(hi))
    return cv.morphologyEx(m, cv.MORPH_OPEN, np.ones((3, 3), np.uint8))


def mascaras_cores(ret_bgr):
    """ dict cor -> máscara binária (uint8 0/1) da imagem retificada inteira."""
    hsv = cv.cvtColor(cv.GaussianBlur(ret_bgr, (3, 3), 0), cv.COLOR_BGR2HSV)
    return hsv, {cor: (mascara_cor(hsv, cor) > 0).astype(np.uint8) for cor in cfg.CORES}


def _recorte(img, cx, cy, meia):
    hx, hy = meia
    cx, cy = int(round(cx)), int(round(cy))
    return img[max(0, cy - hy):cy + hy + 1, max(0, cx - hx):cx + hx + 1]


def classifica_regiao(masks, cx, cy, meia):
    """ cor dominante na região (ou None se nenhuma cor passa do limiar)."""
    melhor, frac_melhor = None, cfg.FRACAO_MIN_COR
    for cor, m in masks.items():
        r = _recorte(m, cx, cy, meia)
        if r.size == 0:
            continue
        frac = r.mean()
        if frac >= frac_melhor:
            melhor, frac_melhor = cor, frac
    return melhor


def le_placa(ret_bgr):
    """ retorna (cores, pontes):
    cores[m, l, c]   -> nome da cor ou None
    pontes[m, l, c]  -> cor sobre a barra entre coluna c e c+1 (ou None)
    """
    _, masks = mascaras_cores(ret_bgr)
    cores = np.full((2, cfg.N_LINHAS_METADE, cfg.N_COLUNAS), None, object)
    pontes = np.full((2, cfg.N_LINHAS_METADE, cfg.N_COLUNAS - 1), None, object)

    for (m, l, c) in cfg.SOCKETS:
        x, y = cfg.coord_modelo(m, l, c)
        cores[m, l, c] = classifica_regiao(masks, *cfg.para_retificada(x, y), cfg.ROI_SOCKET)
        if c < cfg.N_COLUNAS - 1:
            pontes[m, l, c] = classifica_regiao(masks, *cfg.para_retificada(x + 0.5, y), cfg.ROI_PONTE)
    return cores, pontes


def hsv_ocupados(ret_bgr, cores):
    """ para calibração: HSV mediano dos pixels saturados/claros de cada socket ocupado."""
    hsv, _ = mascaras_cores(ret_bgr)
    saida = []
    for (m, l, c) in cfg.SOCKETS:
        x, y = cfg.coord_modelo(m, l, c)
        r = _recorte(hsv, *cfg.para_retificada(x, y), cfg.ROI_SOCKET).reshape(-1, 3)
        # ignora pixels escuros (furo vazio / barra preta)
        r = r[r[:, 2] > 60]
        if len(r) < 0.3 * cfg.ROI_SOCKET[0] * cfg.ROI_SOCKET[1] * 4:
            continue
        saida.append(((m, l, c), cores[m, l, c], np.median(r, axis=0)))
    return saida
