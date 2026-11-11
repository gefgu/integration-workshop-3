"""Conservative reader for the currently assembled half of the board."""
import time

import cv2 as cv
import numpy as np

from . import config as cfg
from .calibracao import RegistradorParcial
from .circuito import contrai_jumpers, monta_grafo
from .componentes import Componente
from .pipeline import Resultado
from .bandas_resistor import VALORES, le_valor
from .pecas_atuais import abertura_vazia, buzzer_kit, corpos_azuis, led_vermelho_kit, pecas_kit, ponte_clara, regiao_colorida, resistores_azuis_kit, smart_kit, suporte_local, suporte_marcado, suporte_smart
from .sockets import retifica


# Band readings: refreshed periodically, failed ones retried later, and a value is
# forgotten once its body has been out of view this long (swap or removal).
REVERIFICA_BANDAS_S = 20.0
RETENTA_BANDAS_S = 6.0
MAX_RETENTA_BANDAS_S = 60.0
ESQUECE_VALOR_S = 3.0


# A read value belongs to the physical body that was read. Its look at normal
# exposure (same body: >= .92 correlation across frames; different bodies: <= .40
# in the fixtures) is stored with the value, and a body that no longer matches
# loses the value at once instead of waiting for the next re-read.
MIN_ASSINATURA = .80


def assinatura_corpo(retificada, linha, coluna):
    """Zero-mean, unit-norm HSV thumbnail of the body at (row, column), or None."""
    cx, cy = cfg.para_retificada(coluna + .5, linha)
    x0, x1, y0, y1 = int(cx - 85), int(cx + 95), int(cy - 44), int(cy + 4)
    if x0 < 0 or y0 < 0 or x1 > retificada.shape[1] or y1 > retificada.shape[0]:
        return None
    thumb = cv.resize(cv.cvtColor(retificada[y0:y1, x0:x1], cv.COLOR_BGR2HSV), (45, 12),
                      interpolation=cv.INTER_AREA).astype(np.float32).reshape(-1, 3)
    thumb = (thumb - thumb.mean(axis=0)) / (thumb.std(axis=0) + 1e-3)
    return (thumb / np.sqrt(thumb.size)).ravel()


class PipelineAtual:
    def __init__(self, calibracao=None, temporal=True, clock=time.monotonic):
        self.registrador = RegistradorParcial(calibracao, clock=clock)
        self.temporal = temporal
        self.counts = {}
        self.previous = None
        self.clock = clock
        self.last_seen = {}
        self.kit_counts = {}
        self.kit_last_seen = {}
        self.empty_counts = {}
        self.empty_last_seen = {}
        self.generation = None
        # Resistor values read from the colour bands (see bandas_resistor.py),
        # keyed by the body's (row, first column): {'valor', 'lido_em', 'visto_em'}.
        self.valores_resistor = {}
        self.tentativa_bandas = {}
        self.corpos_visiveis = set()
        self.assinaturas = {}
        self.geracao_valida = False

    def recalibrar(self):
        self.valores_resistor.clear()
        self.tentativa_bandas.clear()
        self.corpos_visiveis = set()
        self.registrador.recalibrar()
        self.counts.clear()
        self.last_seen.clear()
        self.kit_counts.clear()
        self.kit_last_seen.clear()
        self.empty_counts.clear()
        self.empty_last_seen.clear()
        self.previous = None
        self.generation = None

    def precisa_bandas(self):
        """True when a visible blue body has no recent band reading (the caller then
        lowers the exposure and calls `registra_bandas`). Failed readings are retried
        only after RETENTA_BANDAS_S, so a body without bands (the capacitor) does not
        keep stalling the camera."""
        if not (self.geracao_valida and self.corpos_visiveis):
            return False
        now = self.clock()
        for pos in self.corpos_visiveis:
            value = self.valores_resistor.get(pos)
            if value is not None:
                if now - value['lido_em'] >= REVERIFICA_BANDAS_S:
                    return True
            else:
                attempt = self.tentativa_bandas.get(pos)
                if attempt is None or now - attempt['em'] >= attempt['intervalo']:
                    return True
        return False

    def _falhou_bandas(self, pos, now):
        """Back off for a body that could not be read: 6 s, then doubling up to a minute."""
        attempt = self.tentativa_bandas.get(pos)
        interval = RETENTA_BANDAS_S if attempt is None else min(MAX_RETENTA_BANDAS_S, attempt['intervalo'] * 2)
        self.tentativa_bandas[pos] = {'em': now, 'intervalo': interval, 'assinatura': self.assinaturas.get(pos)}

    def adia_bandas(self):
        """A reading could not be attempted (the exposure did not take); retry later."""
        now = self.clock()
        for pos in self.corpos_visiveis:
            if pos not in self.valores_resistor:
                self._falhou_bandas(pos, now)

    def registra_bandas(self, frames):
        """Read the bands of every visible blue body from low-exposure frames.

        A value is accepted only when at least two frames decode and every frame that
        decodes agrees. A conflicting reading removes the value instead of keeping the
        old one. Returns {position: ohms or None}."""
        H = self.registrador.H
        now = self.clock()
        if H is None or not self.geracao_valida or not frames:
            return {}
        out = {}
        for pos in sorted(self.corpos_visiveis):
            reads = [le_valor(frame, H, *pos)['valor'] for frame in frames]
            decoded = [value for value in reads if value is not None]
            if len(decoded) >= 2 and len(set(decoded)) == 1:
                signature = self.assinaturas.get(pos)
                if signature is None:
                    self._falhou_bandas(pos, now)
                    out[pos] = None
                    continue
                self.valores_resistor[pos] = {'valor': decoded[0], 'lido_em': now, 'visto_em': now,
                                              'assinatura': signature}
                self.tentativa_bandas.pop(pos, None)
                out[pos] = decoded[0]
            else:
                if len(set(decoded)) > 1 or pos in self.valores_resistor:
                    self.valores_resistor.pop(pos, None)
                self._falhou_bandas(pos, now)
                out[pos] = None
        return out

    def processa(self, frame):
        registration = self.registrador.atualiza(frame)
        self.geracao_valida = bool(registration['valido'])
        if registration['valido'] and registration['generation'] != self.generation:
            # Automatic reacquisition can establish a different origin. Never
            # carry old physical positions into a newly fitted mapping.
            self.valores_resistor.clear()
            self.tentativa_bandas.clear()
            self.counts.clear()
            self.empty_counts.clear()
            self.last_seen.clear()
            self.kit_counts.clear()
            self.kit_last_seen.clear()
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
            self.kit_counts.clear()
            self.empty_counts.clear()
            result.motivo = registration.get('motivo') or 'calibração sem suporte suficiente no frame'
        else:
            result.valido = True
            result.retificada = retifica(frame, registration['H'])
            # A bright candidate can also be part of a component. Do not infer
            # an empty socket solely from a match used for registration.
            seen = registration['furos_vistos'].reshape(2, 6, 11)
            resistor_blue_raw = resistores_azuis_kit(result.retificada)
            visible_blue = corpos_azuis(result.retificada) | resistor_blue_raw
            # Blue bodies (resistors and the capacitor) are unknown until their colour
            # bands are read from a low-exposure frame (`registra_bandas`).
            self.corpos_visiveis = set(visible_blue)
            self.assinaturas = {pos: assinatura_corpo(result.retificada, *pos) for pos in visible_blue}
            for pos in list(self.valores_resistor):
                if pos in visible_blue:
                    stored, current = self.valores_resistor[pos].get('assinatura'), self.assinaturas[pos]
                    if stored is None or current is None or float(stored @ current) < MIN_ASSINATURA:
                        # A different (or unreadable) body now sits where the bands were read.
                        del self.valores_resistor[pos]
                        self.tentativa_bandas.pop(pos, None)
                        continue
                    self.valores_resistor[pos]['visto_em'] = now
                elif now - self.valores_resistor[pos]['visto_em'] > ESQUECE_VALOR_S:
                    del self.valores_resistor[pos]
            # A body whose bands were read keeps its value (the reading is position
            # based and expires if the body leaves); the rest stay unknown.
            for pos in list(self.tentativa_bandas):
                # A body that was unreadable (the capacitor) is retried at once if a different body replaces it.
                stored, current = self.tentativa_bandas[pos].get('assinatura'), self.assinaturas.get(pos)
                if pos in visible_blue and (stored is None or current is None
                                            or float(stored @ current) < MIN_ASSINATURA):
                    del self.tentativa_bandas[pos]
            read_blue = {pos for pos in visible_blue if pos in self.valores_resistor}
            # No value is assumed: a blue body whose bands were not read stays unknown,
            # even when it is the only one on the board.
            found_raw = read_blue
            standard_kit = list(set(pecas_kit(result.retificada) + led_vermelho_kit(result.retificada)))
            candidates_buzzer = buzzer_kit(result.retificada)
            # A buzzer's green PCB can also satisfy the LED-colour mask. A
            # round buzzer body at exactly the same footprint wins; a nearby
            # but different LED instead makes the buzzer candidate ambiguous.
            buzzers = [b for b in candidates_buzzer
                       if not any(p[0] == 'led' and p[2] == b[2] and p[3:5] != b[3:5]
                                  and p[3] <= b[4] + 1 and b[3] <= p[4] + 1 for p in standard_kit)]
            standard_kit = [p for p in standard_kit
                            if not (p[0] == 'led' and any(p[2:5] == b[2:5] for b in buzzers))]
            smart = [p for p in smart_kit(result.retificada)
                     if not any(abs(p[2] - row) <= 1 and p[3] <= col + 1 and col <= p[4]
                                for row, col in resistor_blue_raw)]
            kit_raw = standard_kit + buzzers + smart
            ambiguous_blue = visible_blue - found_raw
            for row, col in sorted(ambiguous_blue):
                result.pecas_sem_tipo.append({'metade': 'C', 'linha': row,
                                               'colunas': [col, col + 1], 'atualidade': 'fresh'})
            # Edge-mounted battery bodies cover most neighboring sockets. Use
            # the wider, still distributed three-match support there, as for
            # the wide smart housing; never accept the colored body alone.
            kit = {p for p in kit_raw if (
                (suporte_smart if p[0] == 'capsula_smart' or
                 (p[0] == 'vermelho_2' and (p[2] in (0, 5) or p[3] == 0 or p[4] == 10))
                 else suporte_local)(seen[0], p[2], p[3], p[4])
                or (self.registrador.marker_active and registration['inliers'] >= 17
                    and ((p[0] == 'vermelho_2' and p[3:5] == (9, 10))
                         or suporte_marcado(seen[0], p[2], p[3], p[4]))))}
            pale_bridges = {(row, col) for row in range(6) for col in range(10)
                            if ponte_clara(result.retificada, row, col)}
            # A component-coloured region is never evidence of an empty hole,
            # even when local geometry is too uncertain to publish its position.
            footprint = {(row, col + offset) for row, col in found_raw | ambiguous_blue | pale_bridges
                         for offset in (0, 1)}
            footprint.update((row, col) for _, _, row, first, last in kit_raw for col in range(first, last + 1))
            found = {(row, col) for row, col in found_raw
                     if suporte_local(seen[0], row, col, col + 1)
                     or (self.registrador.marker_active and registration['inliers'] >= 17
                         and suporte_marcado(seen[0], row, col, col + 1))}
            # A read resistor that lacks distributed socket support is not published
            # with its value; it is still a visible, unidentified body.
            for row, col in sorted((found_raw - found) & read_blue):
                result.pecas_sem_tipo.append({'metade': 'C', 'linha': row,
                                               'colunas': [col, col + 1], 'atualidade': 'fresh'})
            empty = {(row, col) for row in range(6) for col in range(11)
                     if seen[0, row, col] and (row, col) not in footprint
                     and suporte_local(seen[0], row, col, col)
                     and not regiao_colorida(result.retificada, row, col)
                     and abertura_vazia(result.retificada, row, col)}
            if not (found or empty or kit):
                result.valido = False
                result.motivo = 'nenhuma posição com observação confiável'
            self.empty_counts = {key: self.empty_counts.get(key, 0) + 1 for key in empty}
            self.kit_counts = {p: self.kit_counts.get(p, 0) + 1 for p in kit}
            for kind, colour, row, first, last in sorted(kit):
                if not self.temporal or self.kit_counts[(kind, colour, row, first, last)] >= cfg.FRAMES_ESTAVEIS:
                    result.componentes.append(Componente(kind, colour, 0, row, list(range(first, last + 1)), [first, last]))
                    result.observacoes[0, row, first:last + 1] = 'occupied'
                    result.atualidade[0, row, first:last + 1] = 'fresh'
                    result.visiveis[0, row, first:last + 1] = True
                    self.kit_last_seen[(kind, colour, row, first, last)] = now
            stable_empty = {key for key in empty if not self.temporal
                            or self.empty_counts[key] >= cfg.FRAMES_ESTAVEIS}
            for row, col in stable_empty:
                result.observacoes[0, row, col] = 'empty'
                result.atualidade[0, row, col] = 'fresh'
                result.visiveis[0, row, col] = True
                self.empty_last_seen[(row, col)] = now
            # A fresh empty terminal supersedes a previous footprint; do not
            # keep showing that old component as stale over a confirmed hole.
            for mapping in (self.last_seen,):
                for row, col in list(mapping):
                    if (row, col) in stable_empty or (row, col + 1) in stable_empty:
                        del mapping[(row, col)]
            self.counts = {key: self.counts.get(key, 0) + 1 for key in found}
            for row, col in sorted(found):
                result.observacoes[0, row, col:col + 2] = 'unknown'
                result.visiveis[0, row, col:col + 2] = False
                if not self.temporal or self.counts[(row, col)] >= cfg.FRAMES_ESTAVEIS:
                    colour = 'azul' if (row, col) in visible_blue else 'branco'
                    kind = VALORES[self.valores_resistor[(row, col)]['valor']]
                    result.componentes.append(Componente(kind, colour, 0, row,
                                                         [col, col + 1], [col, col + 1]))
                    result.observacoes[0, row, col:col + 2] = 'occupied'
                    result.atualidade[0, row, col:col + 2] = 'fresh'
                    result.visiveis[0, row, col:col + 2] = True
                    self.last_seen[(row, col)] = now
            result.grafo = monta_grafo(result.componentes)
            result.grafo_eletrico = contrai_jumpers(result.grafo)
        self.last_seen = {key: when for key, when in self.last_seen.items() if now - when <= 2.0}
        self.empty_last_seen = {key: when for key, when in self.empty_last_seen.items() if now - when <= 2.0}
        self.kit_last_seen = {key: when for key, when in self.kit_last_seen.items() if now - when <= 2.0}
        for (_, _, row, first, last), _ in self.kit_last_seen.items():
            for col in range(first, last + 1):
                if result.atualidade[0, row, col] == 'unknown':
                    result.observacoes[0, row, col] = 'occupied'
                    result.atualidade[0, row, col] = 'stale'
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
