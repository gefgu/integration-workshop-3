"""Conservative reader for the currently assembled half of the board."""
import time

import numpy as np

from . import config as cfg
from .calibracao import RegistradorParcial
from .circuito import contrai_jumpers, monta_grafo
from .componentes import Componente
from .pipeline import Resultado
from .resistor_atual import resistor_branco
from .pecas_atuais import abertura_vazia, corpos_azuis, ponte_clara, regiao_colorida, suporte_local
from .sockets import le_placa, retifica


class PipelineAtual:
    def __init__(self, calibracao=None, temporal=True, clock=time.monotonic):
        self.registrador = RegistradorParcial(calibracao)
        self.temporal = temporal
        self.counts = {}
        self.previous = None
        self.clock = clock
        self.last_seen = {}
        self.blue_counts = {}
        self.blue_last_seen = {}
        self.empty_counts = {}
        self.empty_last_seen = {}
        self.generation = None

    def recalibrar(self):
        self.registrador.recalibrar()
        self.counts.clear()
        self.last_seen.clear()
        self.blue_counts.clear()
        self.blue_last_seen.clear()
        self.empty_counts.clear()
        self.empty_last_seen.clear()
        self.previous = None
        self.generation = None

    def processa(self, frame):
        registration = self.registrador.atualiza(frame)
        if registration['valido'] and registration['generation'] != self.generation:
            # Automatic reacquisition can establish a different origin. Never
            # carry old physical positions into a newly fitted mapping.
            self.counts.clear()
            self.blue_counts.clear()
            self.empty_counts.clear()
            self.last_seen.clear()
            self.blue_last_seen.clear()
            self.empty_last_seen.clear()
            self.generation = registration['generation']
        graph = monta_grafo([])
        result = Resultado(False, '', registration, grafo=graph, grafo_eletrico=graph)
        result.perfil = 'current'
        result.completo = False
        result.pecas_sem_tipo = []
        result.observacoes = np.full((2, 6, 11), 'unknown', dtype=object)
        result.atualidade = np.full((2, 6, 11), 'unknown', dtype=object)
        result.visiveis = np.zeros((2, 6, 11), dtype=bool)
        now = self.clock()
        if not registration['valido']:
            self.counts.clear()
            self.blue_counts.clear()
            self.empty_counts.clear()
            result.motivo = registration.get('motivo') or 'calibração sem suporte suficiente no frame'
        else:
            result.valido = True
            result.retificada = retifica(frame, registration['H'])
            result.cores, result.pontes = le_placa(result.retificada)
            # A bright candidate can also be part of a component. Do not infer
            # an empty socket solely from a match used for registration.
            seen = registration['furos_vistos'].reshape(2, 6, 11)
            found_raw = {(row, col) for row in range(6) for col in range(10)
                         if resistor_branco(result.retificada, 0, row, col)}
            blue_raw = corpos_azuis(result.retificada)
            pale_bridges = {(row, col) for row in range(6) for col in range(10)
                            if ponte_clara(result.retificada, row, col)}
            # A component-coloured region is never evidence of an empty hole,
            # even when local geometry is too uncertain to publish its position.
            footprint = {(row, col + offset) for row, col in found_raw | blue_raw | pale_bridges
                         for offset in (0, 1)}
            found = {(row, col) for row, col in found_raw if suporte_local(seen[0], row, col, col + 1)}
            blue = {(row, col) for row, col in blue_raw if suporte_local(seen[0], row, col, col + 1)}
            empty = {(row, col) for row in range(6) for col in range(11)
                     if seen[0, row, col] and (row, col) not in footprint
                     and suporte_local(seen[0], row, col, col)
                     and not regiao_colorida(result.retificada, row, col)
                     and abertura_vazia(result.retificada, row, col)}
            if not (found or blue or empty):
                result.valido = False
                result.motivo = 'nenhuma posição com observação confiável'
            self.empty_counts = {key: self.empty_counts.get(key, 0) + 1 for key in empty}
            stable_empty = {key for key in empty if not self.temporal
                            or self.empty_counts[key] >= cfg.FRAMES_ESTAVEIS}
            for row, col in stable_empty:
                result.observacoes[0, row, col] = 'empty'
                result.atualidade[0, row, col] = 'fresh'
                result.visiveis[0, row, col] = True
                self.empty_last_seen[(row, col)] = now
            # A fresh empty terminal supersedes a previous footprint; do not
            # keep showing that old component as stale over a confirmed hole.
            for mapping in (self.last_seen, self.blue_last_seen):
                for row, col in list(mapping):
                    if (row, col) in stable_empty or (row, col + 1) in stable_empty:
                        del mapping[(row, col)]
            self.blue_counts = {key: self.blue_counts.get(key, 0) + 1 for key in blue}
            for row, col in sorted(blue):
                if (not self.temporal or self.blue_counts[(row, col)] >= cfg.FRAMES_ESTAVEIS):
                    self.blue_last_seen[(row, col)] = now
                    result.pecas_sem_tipo.append({'metade': 'C', 'linha': row,
                                                  'colunas': [col, col + 1], 'atualidade': 'fresh'})
                    result.observacoes[0, row, col:col + 2] = 'occupied'
                    result.atualidade[0, row, col:col + 2] = 'fresh'
                    result.visiveis[0, row, col:col + 2] = True
            self.counts = {key: self.counts.get(key, 0) + 1 for key in found}
            for row, col in sorted(found):
                result.observacoes[0, row, col:col + 2] = 'unknown'
                result.visiveis[0, row, col:col + 2] = False
                if not self.temporal or self.counts[(row, col)] >= cfg.FRAMES_ESTAVEIS:
                    result.componentes.append(Componente('resistor_1k', 'branco', 0, row,
                                                         [col, col + 1], [col, col + 1]))
                    result.observacoes[0, row, col:col + 2] = 'occupied'
                    result.atualidade[0, row, col:col + 2] = 'fresh'
                    result.visiveis[0, row, col:col + 2] = True
                    self.last_seen[(row, col)] = now
            result.grafo = monta_grafo(result.componentes)
            result.grafo_eletrico = contrai_jumpers(result.grafo)
        self.last_seen = {key: when for key, when in self.last_seen.items() if now - when <= 2.0}
        self.empty_last_seen = {key: when for key, when in self.empty_last_seen.items() if now - when <= 2.0}
        self.blue_last_seen = {key: when for key, when in self.blue_last_seen.items() if now - when <= 2.0}
        fresh_blue = {(item['linha'], item['colunas'][0]) for item in result.pecas_sem_tipo}
        for row, col in sorted(self.blue_last_seen):
            if (row, col) not in fresh_blue:
                result.pecas_sem_tipo.append({'metade': 'C', 'linha': row,
                                              'colunas': [col, col + 1], 'atualidade': 'stale'})
                for index in (col, col + 1):
                    if result.atualidade[0, row, index] == 'unknown':
                        result.observacoes[0, row, index] = 'occupied'
                        result.atualidade[0, row, index] = 'stale'
        for row, col in self.last_seen:
            for index in (col, col + 1):
                if result.atualidade[0, row, index] == 'unknown':
                    result.observacoes[0, row, index] = 'occupied'
                    result.atualidade[0, row, index] = 'stale'
        for (row, col), _ in self.empty_last_seen.items():
            if result.atualidade[0, row, col] == 'unknown':
                result.observacoes[0, row, col] = 'empty'
                result.atualidade[0, row, col] = 'stale'
        result.pecas_sem_tipo.sort(key=lambda item: (item['linha'], item['colunas'][0]))
        result.completo = bool(self.temporal and result.valido and not result.pecas_sem_tipo
                               and np.all(result.atualidade[0] == 'fresh')
                               and np.all(result.observacoes[0] != 'unknown'))
        signature = (result.valido, result.completo, tuple(result.observacoes.ravel()), tuple(result.atualidade.ravel()),
                     tuple(c.id for c in result.componentes),
                     tuple(sorted((p['linha'], p['colunas'][0], p['atualidade']) for p in result.pecas_sem_tipo)))
        result.mudou = signature != self.previous
        self.previous = signature
        return result
