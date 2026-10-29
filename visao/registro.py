""" localiza o grid de sockets na imagem (homografia modelo -> imagem).

a referência são os próprios furos dos sockets: são muitos pontos (até 132),
continuam visíveis mesmo com peças na placa e não dependem do contorno externo
(que se mistura com sombras e pode sair do enquadramento)."""

import numpy as np
import cv2 as cv

from . import config as cfg


def detecta_furos(image):
    """ retorna um array (N, 2) com os centros dos furos (quadrados pretos) vazios."""
    gray = cv.cvtColor(image, cv.COLOR_BGR2GRAY)
    gray = cv.createCLAHE(cfg.CLAHE_CLIP, (8, 8)).apply(gray)
    blur = cv.GaussianBlur(gray, (5, 5), 0)
    thresh = cv.adaptiveThreshold(blur, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV,
                                  cfg.THRESH_BLOCO, cfg.THRESH_C)
    thresh = cv.morphologyEx(thresh, cv.MORPH_OPEN, np.ones((5, 5), np.uint8))

    n, _, stats, centros = cv.connectedComponentsWithStats(thresh)
    furos = []
    for i in range(1, n):
        _, _, w, h, area = stats[i]
        if not cfg.FURO_AREA_MIN < area < cfg.FURO_AREA_MAX:
            continue
        if not cfg.FURO_PROPORCAO[0] < w / h < cfg.FURO_PROPORCAO[1]:
            continue
        if area / (w * h) < cfg.FURO_PREENCHIMENTO:
            continue
        furos.append(centros[i])
    return np.float32(furos).reshape(-1, 2)


def _ordena_cantos(p):
    """ ordena 4 pontos: sup-esq, sup-dir, inf-dir, inf-esq."""
    s = p.sum(1)
    d = np.diff(p, axis=1).ravel()
    return np.float32([p[s.argmin()], p[d.argmin()], p[s.argmax()], p[d.argmax()]])


def _projeta(H):
    return cv.perspectiveTransform(cfg.MODELO[None], H)[0]


def _refina(H, furos, iteracoes):
    """ casa cada furo com o socket projetado mais próximo e recalcula H (RANSAC).
    retorna (H, n_inliers, erro_mediano, furos_por_socket) ou None."""
    resultado = None
    for _ in range(iteracoes):
        proj = _projeta(H)
        dist = np.linalg.norm(furos[:, None] - proj[None], axis=2)
        j = dist.argmin(1)
        ok = dist[np.arange(len(furos)), j] < cfg.DIST_CASAMENTO
        if ok.sum() < cfg.MIN_INLIERS:
            return None
        H_novo, mask = cv.findHomography(cfg.MODELO[j[ok]], furos[ok], cv.RANSAC, cfg.RANSAC_LIMIAR)
        if H_novo is None:
            return None
        H = H_novo
        resultado = (j[ok], furos[ok], mask.ravel().astype(bool))

    j, pts, inl = resultado
    erro = np.linalg.norm(pts[inl] - _projeta(H)[j[inl]], axis=1)
    vistos = np.zeros(len(cfg.MODELO), bool)
    vistos[j[inl]] = True
    return H, int(inl.sum()), float(np.median(erro)), vistos


def calibra(furos):
    """ estimativa global (sem chute inicial): cantos da envoltória dos furos -> H inicial."""
    if len(furos) < cfg.MIN_INLIERS:
        return None
    # descarta detecções isoladas (todo furo real tem vizinhos a ~1 passo do grid);
    # um falso positivo fora da placa estragaria os cantos da envoltória
    dist = np.linalg.norm(furos[:, None] - furos[None], axis=2)
    np.fill_diagonal(dist, np.inf)
    passo = np.median(dist.min(1))
    furos_grid = furos[(dist < 2.5 * passo).sum(1) >= 1]
    if len(furos_grid) < cfg.MIN_INLIERS:
        return None
    hull = cv.convexHull(furos_grid)
    aprox = cv.approxPolyDP(hull, 0.03 * cv.arcLength(hull, True), True).reshape(-1, 2)
    if len(aprox) < 4:
        return None
    if len(aprox) > 4:
        # fica com os 4 pontos mais extremos
        aprox = _ordena_cantos(np.float32(aprox))
    ultima_linha = cfg.GAP + cfg.N_LINHAS_METADE - 1
    ultima_col = cfg.N_COLUNAS - 1
    cantos_modelo = np.float32([[0, 0], [ultima_col, 0], [ultima_col, ultima_linha], [0, ultima_linha]])
    H0 = cv.getPerspectiveTransform(cantos_modelo, _ordena_cantos(np.float32(aprox)))

    # se um canto da placa estiver coberto/fora do quadro, a envoltória encaixa o grid
    # deslocado de 1 linha/coluna: testa os vizinhos e fica com o que tem mais inliers
    melhor = None
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            T = np.float64([[1, 0, dx], [0, 1, dy], [0, 0, 1]])
            res = _refina(H0 @ T, furos, cfg.ITER_CALIBRACAO)
            if res is not None and (melhor is None or (res[1], -res[2]) > (melhor[1], -melhor[2])):
                melhor = res
    return melhor


class Registrador:
    """ mantém a homografia ao longo dos frames.
    usa a H do frame anterior como chute (câmera mexe pouco a 5 fps) e
    recalibra do zero quando o rastreio falha."""

    def __init__(self):
        self.H = None

    def recalibrar(self):
        self.H = None

    def atualiza(self, image):
        """ retorna dict com H, inliers, erro, furos_vistos, valido."""
        furos = detecta_furos(image)
        res = None
        if self.H is not None:
            res = _refina(self.H, furos, cfg.ITER_RASTREIO)
        if not self._aceita(res):
            res = calibra(furos)

        if not self._aceita(res):
            # mantém a última H conhecida, mas avisa que o frame não é confiável
            return {'H': self.H, 'valido': False, 'n_furos': len(furos), 'furos': furos,
                    'inliers': res[1] if res else 0, 'erro': res[2] if res else None,
                    'furos_vistos': None}

        self.H, inliers, erro, vistos = res
        return {'H': self.H, 'valido': True, 'n_furos': len(furos), 'furos': furos,
                'inliers': inliers, 'erro': erro, 'furos_vistos': vistos}

    @staticmethod
    def _aceita(res):
        return res is not None and res[1] >= cfg.MIN_INLIERS and res[2] <= cfg.MAX_ERRO
