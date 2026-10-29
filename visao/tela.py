""" tela da placa: desenha o circuito achado no mesmo estilo da bancada do aplicativo web
(teacher_authoring_app: Breadboard.tsx / PieceView.tsx), com a mesma geometria."""

import numpy as np
import cv2 as cv

from . import config as cfg

# geometria copiada de teacher_authoring_app/src/engine/board.ts
COL_SPACING = 40
ROW_SPACING = 40
OX = 40
BANK_TOP_Y = 46
CHANNEL_GAP = 70
SOCKET = 34
LARGURA = OX + (cfg.N_COLUNAS - 1) * COL_SPACING + OX
ALTURA = BANK_TOP_Y + (cfg.N_LINHAS_METADE - 1) * ROW_SPACING + CHANNEL_GAP \
    + (cfg.N_LINHAS_METADE - 1) * ROW_SPACING + BANK_TOP_Y
RODAPE = 56
ESCALA = 1.6


def _bgr(hex_):
    h = hex_.lstrip('#')
    return (int(h[4:6], 16), int(h[2:4], 16), int(h[0:2], 16))


# paleta do aplicativo (--color-neutral-* e CAPSULE em engine/sim.ts)
FUNDO = _bgr('#f6f2ea')
PLACA = _bgr('#eee7db')
FURO = _bgr('#dcd3c4')
CANAL = _bgr('#c0b6a5')
NUMERO = _bgr('#a19786')
TINTA = _bgr('#2e2b25')
CAPSULA = {   # cor -> (fundo, texto)
    'vermelho': (_bgr('#d23a30'), _bgr('#ffffff')),
    'verde': (_bgr('#3f9b4f'), _bgr('#ffffff')),
    'azul': (_bgr('#2f66c9'), _bgr('#ffffff')),
    'amarelo': (_bgr('#e8b923'), _bgr('#2e2b25')),
    'branco': (_bgr('#f6f2ea'), _bgr('#2e2b25')),
}
DESCONHECIDO = (_bgr('#a19786'), _bgr('#ffffff'))

# texto curto escrito em cada peça
ROTULOS = {
    'led_ou_buzzer': 'LED?', 'resistor_ou_capacitor': 'R/C?', 'botao': 'BOTAO',
    'potenciometro': 'POT', 'jumper_curto': '', 'jumper_longo': '',
    'resistor_220': '220R', 'resistor_470': '470R', 'resistor_1k': '1kR', 'resistor_cc': 'R CC',
    'capacitor': 'CAP',
}


def _x(coluna):
    return OX + coluna * COL_SPACING


def _y(metade, linha):
    if metade == 0:
        return BANK_TOP_Y + linha * ROW_SPACING
    return BANK_TOP_Y + (cfg.N_LINHAS_METADE - 1) * ROW_SPACING + CHANNEL_GAP + linha * ROW_SPACING


def _retangulo(img, x0, y0, x1, y1, raio, cor, preencher=True):
    """ retângulo com cantos arredondados (coordenadas em px da imagem final)."""
    raio = int(min(raio, (x1 - x0) // 2, (y1 - y0) // 2))
    esp = -1 if preencher else 1
    cv.rectangle(img, (x0 + raio, y0), (x1 - raio, y1), cor, esp, cv.LINE_AA)
    cv.rectangle(img, (x0, y0 + raio), (x1, y1 - raio), cor, esp, cv.LINE_AA)
    for cx, cy in ((x0 + raio, y0 + raio), (x1 - raio, y0 + raio), (x0 + raio, y1 - raio), (x1 - raio, y1 - raio)):
        cv.circle(img, (cx, cy), raio, cor, esp, cv.LINE_AA)


def _texto(img, texto, cx, cy, tamanho, cor, espessura=1):
    (w, h), _ = cv.getTextSize(texto, cv.FONT_HERSHEY_SIMPLEX, tamanho, espessura)
    cv.putText(img, texto, (int(cx - w / 2), int(cy + h / 2)), cv.FONT_HERSHEY_SIMPLEX,
               tamanho, cor, espessura, cv.LINE_AA)


def desenha_tela(res):
    """ imagem BGR da placa com os componentes do estado estável de `res`."""
    s = ESCALA
    img = np.full((int((ALTURA + RODAPE) * s), int(LARGURA * s), 3), FUNDO, np.uint8)

    def p(v):
        return int(round(v * s))

    _retangulo(img, 0, 0, p(LARGURA), p(ALTURA), p(24), PLACA)
    topo = _y(0, cfg.N_LINHAS_METADE - 1) + 20
    base = _y(1, 0) - 20
    _retangulo(img, p(14), p(topo), p(LARGURA - 14), p(base), p(10), CANAL)

    # mesma numeração do aplicativo: colunas de 1 a 11
    for c in range(cfg.N_COLUNAS):
        _texto(img, str(c + 1), p(_x(c)), p(16), 0.4 * s, NUMERO, 1)
    for m in (0, 1):
        for l in range(cfg.N_LINHAS_METADE):
            for c in range(cfg.N_COLUNAS):
                cx, cy = p(_x(c)), p(_y(m, l))
                meio = p(SOCKET / 2)
                _retangulo(img, cx - meio, cy - meio, cx + meio, cy + meio, p(6), FURO)

    grafo = res.grafo
    n = 0
    for no, d in grafo.nodes(data=True):
        if d['kind'] != 'componente':
            continue
        n += 1
        fundo, tinta = CAPSULA.get(d['cor'], DESCONHECIDO)
        if d['tipo'].startswith('desconhecido'):
            fundo, tinta = DESCONHECIDO
        m = cfg.METADES.index(d['metade'])
        c0, c1 = d['colunas'][0], d['colunas'][-1]
        y = _y(m, d['linha'])
        jumper = d['tipo'] in cfg.TIPOS_JUMPER
        meia_alt = SOCKET / 2 if jumper else 14
        x0, x1 = p(_x(c0) - SOCKET / 2), p(_x(c1) + SOCKET / 2)
        y0, y1 = p(y - meia_alt), p(y + meia_alt)
        _retangulo(img, x0 + p(1), y0 + p(2), x1 + p(1), y1 + p(2), p(8), (190, 184, 175))  # sombra
        _retangulo(img, x0, y0, x1, y1, p(8), fundo)
        if d['cor'] == 'branco':
            _retangulo(img, x0, y0, x1, y1, p(8), CANAL, preencher=False)
        # jumper: marca só os terminais (o socket do meio do jumper longo não é terminal)
        if jumper:
            for i, col in enumerate(d['colunas']):
                if i in (cfg.TERMINAIS.get(d['tipo']) or range(len(d['colunas']))):
                    cv.circle(img, (p(_x(col)), p(y)), p(4), CANAL, -1, cv.LINE_AA)
        faixa = cfg.FAIXAS.get(d.get('faixa'))
        if faixa:
            # faixa colorida no meio da peça, na cor do app web (engine/sim.ts: stripe)
            xm = (x0 + x1) // 2
            cv.rectangle(img, (xm - p(7), y0), (xm + p(7), y1), _bgr(faixa['web']), -1)
        if len(d['colunas']) == 1:
            rotulo = '?'
        else:
            rotulo = ROTULOS.get(d['tipo'], '?')
        if rotulo:
            # com faixa, o texto fica na metade esquerda da peça para não ficar sobre a faixa
            xt = x0 + (x1 - x0) * 0.27 if faixa else (x0 + x1) / 2
            _texto(img, rotulo, xt, (y0 + y1) / 2, 0.42 * s, tinta, 1)

    estado = 'ok' if res.valido else f'aguardando: {res.motivo}'
    cv.putText(img, f'{n} componente(s)  |  {estado}', (p(20), p(ALTURA + 30)),
               cv.FONT_HERSHEY_SIMPLEX, 0.5 * s, TINTA, 1, cv.LINE_AA)
    return img
