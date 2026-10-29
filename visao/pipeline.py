""" junta todas as etapas:

frame -> registro do grid -> retificação -> cor de cada socket/ponte
      -> filtro temporal -> componentes -> grafo do circuito
"""

from dataclasses import dataclass, field

import numpy as np
import cv2 as cv

from . import config as cfg
from .registro import Registrador
from .sockets import retifica, le_placa
from .temporal import FiltroTemporal
from .componentes import identifica
from .circuito import monta_grafo, contrai_jumpers

_FORMA_CORES = (2, cfg.N_LINHAS_METADE, cfg.N_COLUNAS)
_N_CORES = int(np.prod(_FORMA_CORES))


@dataclass
class Resultado:
    valido: bool                 # frame usado para atualizar o estado?
    motivo: str                  # por que foi descartado (se for o caso)
    registro: dict
    retificada: np.ndarray = None
    cores: np.ndarray = None     # observação deste frame
    pontes: np.ndarray = None
    visiveis: np.ndarray = None  # sockets dentro do quadro da câmera
    obstruidos: int = 0
    mudou: bool = False          # estado estável mudou neste frame?
    componentes: list = field(default_factory=list)  # do estado estável
    grafo: object = None         # bipartido (com jumpers)
    grafo_eletrico: object = None  # redes unidas pelos jumpers


class Pipeline:

    def __init__(self, temporal=True):
        """ temporal=False: cada frame é independente (útil para imagens soltas)."""
        self.registrador = Registrador()
        self.filtro = FiltroTemporal() if temporal else None
        self.ret_anterior = None
        self.componentes = []
        self.grafo = monta_grafo([])
        self.grafo_eletrico = contrai_jumpers(self.grafo)

    def recalibrar(self):
        self.registrador.recalibrar()
        self.ret_anterior = None

    def processa(self, frame):
        reg = self.registrador.atualiza(frame)
        res = Resultado(False, '', reg, componentes=self.componentes,
                        grafo=self.grafo, grafo_eletrico=self.grafo_eletrico)

        if reg['H'] is None:
            res.motivo = 'grid não encontrado'
            return self._descarta(res)

        ret = retifica(frame, reg['H'])
        res.retificada = ret
        res.cores, res.pontes = le_placa(ret)

        if not reg['valido']:
            res.motivo = f"registro ruim (inliers={reg['inliers']})"
            return self._descarta(res)

        # sockets fora do quadro não são "obstruídos": só ficam sem leitura neste frame
        res.visiveis = _dentro_do_quadro(reg['H'], frame.shape)
        sem_furo = ~reg['furos_vistos'].reshape(_FORMA_CORES)
        res.obstruidos = int((sem_furo & (res.cores == None) & res.visiveis).sum())  # noqa: E711
        if res.obstruidos > cfg.MAX_OBSTRUIDOS:
            res.motivo = f'{res.obstruidos} sockets obstruídos'
            return self._descarta(res, ret)

        movimento = self._movimento(ret)
        if movimento > cfg.MAX_FRACAO_MOVIMENTO:
            res.motivo = f'movimento ({movimento:.1%})'
            return self._descarta(res, ret)

        res.valido = True
        obs = np.concatenate([res.cores.ravel(), res.pontes.ravel()])
        pontes_visiveis = res.visiveis[:, :, :-1] & res.visiveis[:, :, 1:]
        lidos = np.concatenate([res.visiveis.ravel(), pontes_visiveis.ravel()])
        if self.filtro is not None:
            estado, res.mudou = self.filtro.atualiza(obs, lidos)
        else:
            estado, res.mudou = obs, True
        cores = estado[:_N_CORES].reshape(_FORMA_CORES)
        pontes = estado[_N_CORES:].reshape(res.pontes.shape)

        if res.mudou:
            self.componentes = identifica(cores, pontes, ret)
            self.grafo = monta_grafo(self.componentes)
            self.grafo_eletrico = contrai_jumpers(self.grafo)
        res.componentes, res.grafo, res.grafo_eletrico = self.componentes, self.grafo, self.grafo_eletrico
        return res

    def _descarta(self, res, ret=None):
        if self.filtro is not None:
            self.filtro.descarta_frame()
        if ret is not None:
            self.ret_anterior = _cinza(ret)
        return res

    def _movimento(self, ret):
        """ fração de pixels que mudaram desde o último frame (0 no primeiro frame)."""
        gray = _cinza(ret)
        anterior, self.ret_anterior = self.ret_anterior, gray
        if anterior is None or self.filtro is None:
            return 0.0
        return float((cv.absdiff(gray, anterior) > cfg.DIFF_PIXEL).mean())


def _dentro_do_quadro(H, forma, margem=25):
    """ (2, 6, 11) bool: socket projetado dentro da imagem (com margem)."""
    proj = cv.perspectiveTransform(cfg.MODELO[None], H)[0]
    alt, larg = forma[:2]
    ok = ((proj[:, 0] >= margem) & (proj[:, 0] < larg - margem) &
          (proj[:, 1] >= margem) & (proj[:, 1] < alt - margem))
    return ok.reshape(_FORMA_CORES)


def _cinza(ret):
    return cv.GaussianBlur(cv.cvtColor(ret, cv.COLOR_BGR2GRAY), (5, 5), 0)
