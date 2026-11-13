"""Full populated board: four existing stickers, two banks, evidence-only values.

No inventory assumptions, demo switches, wall-clock value caches or exposure
round trips are used. Every processed image supplies its own band evidence.
"""
import time

import cv2 as cv
import numpy as np

from . import config as cfg
from .bandas_resistor import VALORES, le_valor
from .calibracao_bancada import contact_candidates, validate_fixed_bank, four_sticker_proposal
from .circuito import contrai_jumpers, monta_grafo
from .componentes import Componente
from .pecas_atuais import led_vermelho_kit, pecas_kit
from .pecas_bancada import blue_bodies, potentiometers, buzzers, white_jumpers
from .pipeline import Resultado
from .polaridade import read_polarity
from .sockets import retifica
from .template_pecas import capacitor_candidates, smart_candidates


class PipelineBancada:
    def __init__(self, temporal=True, clock=time.monotonic):
        cv.setNumThreads(1)
        self.temporal = temporal
        self.clock = clock
        self.frame_index = 0
        self.generation = 0
        self.anchor = None
        self.previous_gray = None
        self.counts = {}
        self.accepted = {}
        self.missing = {}
        self.previous = None
        self.previous_polarities = {}
        self.polarity_counts = {}

    def recalibrar(self):
        self.anchor = None
        self.previous_gray = None
        self.counts.clear()
        self.accepted.clear()
        self.missing.clear()
        self.previous_polarities.clear()
        self.polarity_counts.clear()
        self.generation += 1

    def _registration(self, frame):
        if self.anchor is None:
            self.anchor = four_sticker_proposal(frame)
            if self.anchor is not None:
                self.anchor['shape'] = frame.shape
                hsv = cv.cvtColor(frame, cv.COLOR_BGR2HSV)
                self.anchor['patches'] = []
                half = round(18 * frame.shape[1] / 1280)
                for index, (x, y) in enumerate(np.rint(self.anchor['marks']).astype(int)):
                    patch = hsv[y - half:y + half + 1, x - half:x + half + 1]
                    colour = self._marker_colour(patch, index)
                    self.anchor['patches'].append((index, x, y, half, colour.copy()))
                self.generation += 1
        if self.anchor is None or self.anchor['shape'] != frame.shape:
            self.anchor = None
            return None
        hsv = cv.cvtColor(frame, cv.COLOR_BGR2HSV)
        white_samples = []
        for index, x, y, half, reference in self.anchor['patches']:
            current = hsv[y - half:y + half + 1, x - half:x + half + 1]
            colour = self._marker_colour(current, index)
            # Pixel texture in the dim green sticker is noisy. Validate its
            # actual colour support at the anchored location, then require
            # distributed socket reprojection, rather than re-fitting from
            # a JPEG/noise-sensitive intensity correlation every frame.
            if (reference.sum() < 20 or colour.shape != reference.shape
                    or float(colour[reference].mean()) < .60):
                self.anchor = None
                return None
            if index in (1, 3):
                white_samples.extend(current[:, :, 2][reference].tolist())
        scale = min(1., 640 / frame.shape[1])
        validation = cv.resize(frame, None, fx=scale, fy=scale, interpolation=cv.INTER_AREA)
        small_points = contact_candidates(validation)
        scaling = np.diag([scale, scale, 1.])
        banks = [validate_fixed_bank(scaling @ bank['H'], small_points, validation.shape) for bank in self.anchor['banks']]
        points = small_points / scale
        if all(bank is not None for bank in banks):
            for bank in banks:
                bank['erro'] /= scale
        if any(bank is None for bank in banks):
            # Keep native validation for dark/occluded banks that do not
            # supply enough independent contacts after downsampling.
            points = contact_candidates(frame)
            banks = [validate_fixed_bank(bank['H'], points, frame.shape) for bank in self.anchor['banks']]
        if any(bank is None for bank in banks):
            self.anchor = None
            return None
        # A fixed calibration never walks with movable pieces or accumulates
        # homography drift: each frame is fitted against the original anchor.
        for bank, anchor in zip(banks, self.anchor['banks']):
            bank['H'] = anchor['H']
        return dict(banks=banks, marks=self.anchor['marks'], points=points,
                    white_level=float(np.median(white_samples)))

    @staticmethod
    def _marker_colour(hsv, index):
        if index in (0, 2):
            return (hsv[:, :, 0] >= 65) & (hsv[:, :, 0] <= 100) & (hsv[:, :, 1] >= 65) & (hsv[:, :, 2] >= 15)
        return (hsv[:, :, 1] <= 65) & (hsv[:, :, 2] >= 80)

    def processa(self, frame):
        self.frame_index += 1
        registration = self._registration(frame)
        valid = registration is not None
        reg = dict(valido=valid, H=None, inliers=0, erro=None,
                   furos_vistos=np.zeros(132, bool), n_furos=0,
                   generation=self.generation)
        result = Resultado(valid, '' if valid else 'four_markers_or_socket_support_missing', reg)
        result.perfil = 'board'
        result.completo = False
        result.pecas_sem_tipo = []
        result.decisions = []
        result.observacoes = np.full((2, 6, 11), 'unknown', object)
        result.atualidade = np.full((2, 6, 11), 'unknown', object)
        result.visiveis = np.zeros((2, 6, 11), bool)
        result.retificadas = []
        detected = {}
        observed_polarities = {}
        polarity_counts = {}
        if valid:
            reg.update(H=registration['banks'][0]['H'],
                       bank_homographies=[bank['H'] for bank in registration['banks']],
                       marks=registration['marks'], furos=registration['points'],
                       n_furos=len(registration['points']),
                       inliers=sum(bank['inliers'] for bank in registration['banks']),
                       erro=max(bank['erro'] for bank in registration['banks']),
                       furos_vistos=np.concatenate([bank['seen'] for bank in registration['banks']]))
            for index, bank in enumerate(registration['banks']):
                # Each bank is rectified independently. The legacy warp's
                # canvas has room for a second bank *below* the first; here
                # that area is outside this bank and can join unrelated blobs.
                # Smart cases extend more than one socket beyond their pins.
                # Preserve the whole housing without including another bank.
                bank_bottom = round(cfg.para_retificada(0, 5)[1] + cfg.PX_Y * 1.5)
                rect = retifica(frame, bank['H'])[:bank_bottom]
                result.retificadas.append(rect)
                seen = bank['seen'].reshape(6, 11)
                result.observacoes[index][seen] = 'empty'
                result.atualidade[index][seen] = 'fresh'
                result.visiveis[index][seen] = True
                candidates = sorted(set([p for p in pecas_kit(rect, short_jumpers=True, white_floor=100)
                                         if not p[0].startswith('jumper')]
                                         + white_jumpers(rect, registration['white_level']) + led_vermelho_kit(rect)))
                found_buzzers = buzzers(rect)
                smarts = smart_candidates(rect)
                capacitors = capacitor_candidates(rect)
                cap_polarities = {item['piece'][2:5]: item['polarity'] for item in capacitors}
                inside_smart = lambda row, first, last: any(row == s[2]
                    and s[3] <= first and last <= s[4] for s in smarts)
                found_buzzers = [b for b in found_buzzers if not inside_smart(*b[2:5])]
                candidates = [p for p in candidates if not (p[0] == 'led' and any(p[2:5] == b[2:5] for b in found_buzzers))]
                # A pale LED board also looks like a short white jumper. Lens
                # evidence resolves that exact footprint before publication.
                lenses = {p[2:5] for p in candidates if p[0] == 'led'}
                candidates = [p for p in candidates if not (p[0].startswith('jumper') and p[2:5] in lenses)]
                pots = potentiometers(rect)
                candidates += found_buzzers + smarts + pots + [item['piece'] for item in capacitors]
                blocked = {(row, col) for s in smarts for row in (s[2],)
                           for col in range(s[3], s[4])}
                blue = blue_bodies(rect, details=True, blocked=blocked)
                blue = {p: bounds for p, bounds in blue.items() if not inside_smart(p[0], p[1], p[1] + 1)}
                # Coloured holders and a yellow three-terminal body are
                # positive evidence against an overlapping white-jumper guess.
                occupied_colour = [(r, a, a + 1) for r, a in blue] + [p[2:5] for p in pots]
                candidates = [p for p in candidates if not (p[0].startswith('jumper') and any(
                    p[2] == r and max(p[3], a) < min(p[4], b) for r, a, b in occupied_colour))]
                for row, col in sorted(blue):
                    if (row, col, col + 1) in cap_polarities:
                        continue
                    reading = le_valor(frame, bank['H'], row, col, relative=True, vertical_window=blue[(row, col)])
                    result.decisions.append(dict(bank=cfg.METADES[index], row=row, a=col, b=col + 1,
                                                 reason=reading['motivo'] or 'complete_bands', value=reading['valor']))
                    if reading['valor'] is None:
                        result.pecas_sem_tipo.append(dict(metade=cfg.METADES[index], linha=row,
                                                         colunas=[col, col + 1], atualidade='fresh',
                                                         type='resistor' if reading['faixas'] else 'peca_sem_tipo',
                                                         reason=reading['motivo']))
                    else:
                        candidates.append((VALORES[reading['valor']], 'azul', row, col, col + 1))
                for kind, colour, row, first, last in sorted(set(candidates)):
                    terminals = [first, first + 1, last] if kind == 'potenciometro' else [first, last]
                    comp = Componente(kind, colour, index, row, list(range(first, last + 1)), terminals)
                    if kind in ('vermelho_2', 'led', 'capacitor', 'buzzer'):
                        polarity = read_polarity(rect, row, first, last, kind)
                        pattern = cap_polarities.get((row, first, last)) if kind == 'capacitor' else None
                        if pattern and pattern['status'] == 'known':
                            if polarity['status'] == 'known' and polarity['positive'] != pattern['positive']:
                                polarity = dict(status='unknown', reason='polarity_evidence_conflict')
                            else:
                                polarity = pattern
                        result.decisions.append(dict(bank=cfg.METADES[index], row=row, a=first, b=last,
                                                     reason=polarity['reason'], polarity=polarity))
                        signature = (polarity['status'], polarity.get('positive'), polarity.get('negative'))
                        votes = self.polarity_counts.get(comp.id, 0) + 1 if self.previous_polarities.get(comp.id) == signature else 1
                        observed_polarities[comp.id] = signature
                        polarity_counts[comp.id] = votes
                        if self.temporal and polarity['status'] == 'known' and votes < 2:
                            polarity = dict(status='unknown', reason='confirming_printed_signs')
                        comp.polaridade = {k: v for k, v in polarity.items() if k != 'score'}
                    detected[comp.id] = comp
                for body in result.pecas_sem_tipo:
                    if body['metade'] == cfg.METADES[index]:
                        result.observacoes[index, body['linha'], body['colunas']] = 'unknown'
                        result.atualidade[index, body['linha'], body['colunas']] = 'fresh'
            result.retificada = result.retificadas[0]
        else:
            self.counts.clear()
            self.accepted.clear()
            self.missing.clear()
        self.counts = {key: self.counts.get(key, 0) + 1 for key in detected}
        self.previous_polarities = observed_polarities
        self.polarity_counts = polarity_counts
        unknown_footprints = {(p['metade'], p['linha'], tuple(p['colunas'])) for p in result.pecas_sem_tipo}
        fresh_footprints = {(cfg.METADES[c.metade], c.linha, tuple(c.colunas)): key for key, c in detected.items()}
        for key, comp in list(self.accepted.items()):
            if key not in detected:
                self.missing[key] = self.missing.get(key, 0) + 1
                footprint = (cfg.METADES[comp.metade], comp.linha, tuple(comp.colunas))
                # Changed/unreadable bands invalidate an old value immediately.
                if (not valid or self.missing[key] >= 2 or footprint in unknown_footprints
                        or (footprint in fresh_footprints and fresh_footprints[footprint] != key)):
                    del self.accepted[key]
                    self.missing.pop(key, None)
        for key, comp in detected.items():
            self.missing.pop(key, None)
            if not self.temporal or self.counts[key] >= 2:
                self.accepted[key] = comp
        result.componentes = [self.accepted[key] for key in sorted(self.accepted)]
        for comp in result.componentes:
            freshness = 'fresh' if comp.id in detected else 'stale'
            if freshness == 'stale' and comp.polaridade is not None:
                comp.polaridade = dict(status='unknown', reason='body_not_visible')
            result.observacoes[comp.metade, comp.linha, comp.colunas] = 'occupied'
            result.atualidade[comp.metade, comp.linha, comp.colunas] = freshness
            result.visiveis[comp.metade, comp.linha, comp.colunas] = True
        result.grafo = monta_grafo(result.componentes)
        result.grafo_eletrico = contrai_jumpers(result.grafo)
        result.completo = bool(valid and not result.pecas_sem_tipo and np.all(result.atualidade == 'fresh'))
        signature = (valid, tuple(sorted(self.accepted)), tuple((p['metade'], p['linha'], tuple(p['colunas'])) for p in result.pecas_sem_tipo))
        result.mudou = signature != self.previous
        self.previous = signature
        return result
