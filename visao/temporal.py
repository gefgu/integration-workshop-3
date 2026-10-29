""" filtro temporal: o estado de um socket/ponte só muda depois de
FRAMES_ESTAVEIS observações iguais seguidas. evita que o grafo "pisque"."""

import numpy as np

from . import config as cfg


class FiltroTemporal:

    def __init__(self, n_frames=cfg.FRAMES_ESTAVEIS):
        self.n = n_frames
        self.estavel = None
        self.candidato = None
        self.contagem = None

    def atualiza(self, observacao, lidos=None):
        """ observacao: array (object) de rótulos.
        lidos: máscara bool dos elementos realmente observados neste frame
        (os demais, ex. fora do quadro, mantêm o estado). retorna (estado_estavel, mudou)."""
        if self.estavel is None:
            self.estavel = np.full(observacao.shape, None, object)
            self.candidato = observacao.copy()
            self.contagem = np.zeros(observacao.shape, int)

        igual_estavel = observacao == self.estavel
        igual_candidato = observacao == self.candidato

        self.contagem = np.where(igual_candidato, self.contagem + 1, 1)
        self.contagem[igual_estavel] = 0
        if lidos is not None:
            self.contagem[~lidos] = 0
        self.candidato = observacao.copy()

        aceitar = self.contagem >= self.n
        mudou = bool(aceitar.any())
        self.estavel[aceitar] = observacao[aceitar]
        self.contagem[aceitar] = 0
        return self.estavel.copy(), mudou

    def descarta_frame(self):
        """ frame não confiável (mão, câmera mexendo): zera a sequência em andamento."""
        if self.contagem is not None:
            self.contagem[:] = 0
            self.candidato = self.estavel.copy()
