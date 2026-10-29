""" rodar da raiz do projeto:  python3 -m unittest discover tests -v """

import os
import unittest
from unittest import mock

import numpy as np
import cv2 as cv

from visao import config as cfg
from visao.pipeline import Pipeline
from visao.registro import Registrador
from visao.temporal import FiltroTemporal
from visao.circuito import para_dict

PASTA = os.path.join(os.path.dirname(__file__), '..', 'real_img')
VAZIAS = ['foto1.jpg', 'foto2.jpg', 'foto3.jpg', 'foto4.jpg', 'foto5.jpg']


def carrega(nome):
    img = cv.imread(os.path.join(PASTA, nome))
    assert img is not None, nome
    return img


def desenha_peca(img, H, metade, linha, c0, c1, bgr, espessura=22):
    """ desenha uma "peça" cobrindo os sockets c0..c1 de uma linha, na perspectiva da foto."""
    pts = np.float32([[cfg.coord_modelo(metade, linha, c0)], [cfg.coord_modelo(metade, linha, c1)]])
    a, b = cv.perspectiveTransform(pts, H).reshape(2, 2)
    # estende um pouco além dos centros para cobrir os furos das pontas
    d = (b - a) / np.linalg.norm(b - a) * 12
    cv.line(img, tuple((a - d).astype(int)), tuple((b + d).astype(int)), bgr, espessura)


AZUL, AMARELO, BRANCO, VERDE = (255, 80, 0), (0, 220, 255), (255, 255, 255), (0, 170, 0)


class TestRegistro(unittest.TestCase):

    def test_fotos_vazias(self):
        for nome in VAZIAS:
            reg = Registrador().atualiza(carrega(nome))
            self.assertTrue(reg['valido'], nome)
            self.assertGreaterEqual(reg['inliers'], 125, nome)
            self.assertLess(reg['erro'], 2.0, nome)

    def test_rastreio_entre_fotos(self):
        # usa a H de uma foto como chute para outra (deslocamento maior que o real a 5 fps)
        r = Registrador()
        for nome in VAZIAS:
            self.assertTrue(r.atualiza(carrega(nome))['valido'], nome)


class TestComponentes(unittest.TestCase):

    def test_fotos_vazias_sem_componentes(self):
        for nome in VAZIAS:
            res = Pipeline(temporal=False).processa(carrega(nome))
            self.assertEqual(res.componentes, [], nome)

    def test_pecas2(self):
        res = Pipeline(temporal=False).processa(carrega('pecas2.jpeg'))
        por_id = {c.id: c for c in res.componentes}
        self.assertIn('vermelho_2@C0:0-1', por_id)
        self.assertIn('led_ou_buzzer@B1:2-3', por_id)
        self.assertEqual(por_id['led_ou_buzzer@B1:2-3'].redes(), ['B2', 'B3'])

    def test_sintetico(self):
        img = carrega('foto3.jpg')  # foto rotacionada
        H = Registrador().atualiza(img)['H']
        desenha_peca(img, H, 0, 2, 0, 1, AZUL)       # resistor
        desenha_peca(img, H, 0, 2, 2, 3, AZUL)       # outro resistor encostado
        desenha_peca(img, H, 1, 4, 5, 7, AMARELO)    # potenciômetro (3 terminais)
        desenha_peca(img, H, 1, 0, 0, 2, BRANCO)     # jumper longo
        desenha_peca(img, H, 1, 3, 2, 3, BRANCO)     # jumper curto
        desenha_peca(img, H, 1, 1, 3, 4, VERDE)      # led/buzzer

        res = Pipeline(temporal=False).processa(img)
        self.assertTrue(res.valido, res.motivo)
        tipos = {c.id: (c.tipo, c.redes()) for c in res.componentes}
        self.assertEqual(tipos, {
            'resistor_ou_capacitor@C2:0-1': ('resistor_ou_capacitor', ['C0', 'C1']),
            'resistor_ou_capacitor@C2:2-3': ('resistor_ou_capacitor', ['C2', 'C3']),
            'potenciometro@B4:5-7': ('potenciometro', ['B5', 'B6', 'B7']),
            'jumper_longo@B0:0-2': ('jumper_longo', ['B0', 'B2']),
            'jumper_curto@B3:2-3': ('jumper_curto', ['B2', 'B3']),
            'led_ou_buzzer@B1:3-4': ('led_ou_buzzer', ['B3', 'B4']),
        })

        # jumpers unem B0, B2 e B3 numa rede só; o LED fica entre essa rede e B4
        eletrico = para_dict(res.grafo_eletrico)
        led = next(c for c in eletrico['componentes'] if c['tipo'] == 'led_ou_buzzer')
        self.assertEqual(led['redes'], ['B0+B2+B3', 'B4'])
        self.assertFalse(any(c['tipo'].startswith('jumper') for c in eletrico['componentes']))

    def test_desempate_por_pontos(self):
        img = carrega('foto1.jpg')
        H = Registrador().atualiza(img)['H']

        def pontos(metade, linha, c0, n):
            """ n pontos pretos sobre a peça, espalhados entre os sockets c0 e c0+1."""
            for i in range(n):
                x = c0 + (i + 1) / (n + 1)
                p = cv.perspectiveTransform(np.float32([[cfg.coord_modelo(metade, linha, x)]]), H)[0, 0]
                cv.circle(img, tuple(int(v) for v in p), 4, (0, 0, 0), -1)

        desenha_peca(img, H, 0, 1, 4, 5, VERDE, espessura=26)
        pontos(0, 1, 4, 1)
        desenha_peca(img, H, 1, 3, 7, 8, VERDE, espessura=26)
        pontos(1, 3, 7, 4)

        res = Pipeline(temporal=False).processa(img)
        self.assertEqual(sorted(c.id for c in res.componentes), ['buzzer@B3:7-8', 'led@C1:4-5'])

    def test_mao_na_frente_descarta_frame(self):
        img = carrega('foto1.jpg')
        H = Registrador().atualiza(img)['H']
        # "mão": mancha cor de pele (pouco saturada) sobre vários sockets
        for linha in range(4):
            desenha_peca(img, H, 1, linha, 3, 6, (140, 170, 210), espessura=40)
        # o limite padrão é folgado (a câmera real não vê ~40 furos escuros); aqui testa-se o mecanismo
        with mock.patch.object(cfg, 'MAX_OBSTRUIDOS', 6):
            res = Pipeline(temporal=False).processa(img)
        self.assertFalse(res.valido)


class TestFaixa(unittest.TestCase):
    """ peças azuis: a faixa colorida do meio define a peça (catálogo do app web)."""

    def retificada_com_faixa(self, bgr):
        ret = np.zeros((cfg.ALTURA_RET, cfg.LARGURA_RET, 3), np.uint8)
        (x0, y), (x1, _) = cfg.para_retificada(3, 1), cfg.para_retificada(4, 1)
        cv.rectangle(ret, (int(x0) - 20, int(y) - 22), (int(x1) + 20, int(y) + 8), (200, 110, 30), -1)  # corpo azul
        xm = int((x0 + x1) / 2)
        cv.rectangle(ret, (xm - 7, int(y) - 22), (xm + 7, int(y) + 8), bgr, -1)
        return ret

    def test_cor_da_faixa_define_a_peca(self):
        from visao.componentes import le_faixa
        # cada faixa, na cor que a câmera real vê (centros medidos em FAIXAS), vira o tipo do catálogo do app web
        tipos = {'laranja': 'resistor_220', 'vermelho': 'resistor_470', 'amarelo': 'resistor_1k',
                 'rosa': 'resistor_cc', 'verde': 'capacitor'}
        for faixa, dados in cfg.FAIXAS.items():
            bgr = cv.cvtColor(np.uint8([[dados['hsv']]]), cv.COLOR_HSV2BGR)[0, 0].tolist()
            self.assertEqual(le_faixa(self.retificada_com_faixa(bgr), 0, 1, 3), faixa)
            self.assertEqual(dados['tipo'], tipos[faixa])

    def test_sem_faixa_nao_ha_faixa(self):
        from visao.componentes import le_faixa
        self.assertIsNone(le_faixa(self.retificada_com_faixa((200, 110, 30)), 0, 1, 3))


class TestTemporal(unittest.TestCase):

    def test_precisa_de_n_frames(self):
        f = FiltroTemporal(3)
        vazio = np.array([None, None], object)
        peca = np.array(['azul', None], object)
        f.atualiza(vazio)
        self.assertEqual(f.atualiza(peca)[0][0], None)
        self.assertEqual(f.atualiza(peca)[0][0], None)
        estado, mudou = f.atualiza(peca)
        self.assertEqual(estado[0], 'azul')
        self.assertTrue(mudou)

    def test_ignora_piscada(self):
        f = FiltroTemporal(3)
        peca = np.array(['azul'], object)
        for _ in range(3):
            f.atualiza(peca)
        f.atualiza(np.array([None], object))  # 1 frame errado
        estado, mudou = f.atualiza(peca)
        self.assertEqual(estado[0], 'azul')
        self.assertFalse(mudou)

    def test_camera_tremendo(self):
        """ rotação de até 4° e deslocamento de até 25 px, com parte da placa saindo do quadro."""
        base = carrega('pecas2.jpeg')
        p = Pipeline()
        validos, n_comp = 0, set()
        for i in range(60):
            M = cv.getRotationMatrix2D((640, 360), 4 * np.sin(i / 6), 1.0)
            M[:, 2] += (25 * np.sin(i / 9), 15 * np.cos(i / 7))
            res = p.processa(cv.warpAffine(base, M, (1280, 720), borderMode=cv.BORDER_REPLICATE))
            validos += res.valido
            if i >= cfg.FRAMES_ESTAVEIS:
                n_comp.add(len(res.componentes))
        self.assertGreaterEqual(validos, 55)
        self.assertEqual(n_comp, {4})

    def test_pipeline_temporal(self):
        p = Pipeline()
        img = carrega('pecas2.jpeg')
        resultados = [p.processa(img) for _ in range(cfg.FRAMES_ESTAVEIS)]
        self.assertEqual(resultados[0].componentes, [])
        self.assertTrue(resultados[-1].mudou)
        self.assertEqual(len(resultados[-1].componentes), 4)


if __name__ == '__main__':
    unittest.main()
