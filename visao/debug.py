""" desenhos para depuração (frame original e imagem retificada)."""

import numpy as np
import cv2 as cv

from . import config as cfg

COR_BGR = {'vermelho': (0, 0, 255), 'amarelo': (0, 220, 255), 'verde': (0, 200, 0),
           'azul': (255, 80, 0), 'branco': (255, 255, 255)}
ATUALIDADE_BGR = {'fresh': (0, 210, 0), 'stale': (0, 165, 255), 'unknown': (150, 150, 150)}


def _txt(img, texto, pos, cor=(255, 255, 255), escala=0.5):
    (w, h), base = cv.getTextSize(texto, cv.FONT_HERSHEY_SIMPLEX, escala, 1)
    x, y = pos
    cv.rectangle(img, (x - 2, y - h - 3), (x + w + 2, y + base), (0, 0, 0), -1)
    cv.putText(img, texto, pos, cv.FONT_HERSHEY_SIMPLEX, escala, cor, 1, cv.LINE_AA)


def desenha_frame(frame, res):
    """ grid projetado + componentes sobre o frame original."""
    img = frame.copy()
    H = res.registro.get('H')
    if H is not None:
        proj = cv.perspectiveTransform(cfg.MODELO[None], H)[0]
        vistos = res.registro.get('furos_vistos')
        for k, p in enumerate(proj):
            if hasattr(res, 'atualidade'):
                m, l, c = cfg.SOCKETS[k]
                if m != 0:
                    continue
                cor = ATUALIDADE_BGR[res.atualidade[m, l, c]]
            else:
                cor = (0, 255, 0) if vistos is None or vistos[k] else (0, 140, 255)
            cv.circle(img, tuple(int(v) for v in p), 5, cor, 1)

        for comp in res.componentes:
            pts = np.float32([[cfg.coord_modelo(comp.metade, comp.linha, c)] for c in comp.colunas])
            pts = cv.perspectiveTransform(pts, H).reshape(-1, 2).astype(int)
            cv.polylines(img, [pts.reshape(-1, 1, 2)], False, COR_BGR.get(comp.cor, (255, 0, 255)), 4)
            for c in comp.terminais:
                p = cv.perspectiveTransform(np.float32([[cfg.coord_modelo(comp.metade, comp.linha, c)]]), H)[0, 0]
                cv.circle(img, tuple(int(v) for v in p), 7, (255, 0, 255), 2)
            rotulo = (f'{comp.tipo} {cfg.METADES[comp.metade]}{comp.linha}:'
                      f'{comp.colunas[0]}-{comp.colunas[-1]}')
            _txt(img, rotulo, (int(pts[0][0]) - 10, int(pts[0][1]) - 14))

        for peca in getattr(res, 'pecas_sem_tipo', []):
            metade = cfg.METADES.index(peca['metade'])
            pts = np.float32([[cfg.coord_modelo(metade, peca['linha'], c)] for c in peca['colunas']])
            pts = cv.perspectiveTransform(pts, H).reshape(-1, 2).astype(int)
            cor = ATUALIDADE_BGR[peca['atualidade']]
            cv.polylines(img, [pts.reshape(-1, 1, 2)], False, cor, 3)
            rotulo = (f"peca ? {peca['metade']}{peca['linha']}:"
                      f"{peca['colunas'][0]}-{peca['colunas'][-1]}")
            if peca['atualidade'] == 'stale':
                rotulo += ' anterior'
            _txt(img, rotulo, (int(pts[0][0]) - 10, int(pts[0][1]) - 14), cor)

    status = 'OK' if res.valido else f'DESCARTADO: {res.motivo}'
    erro = res.registro.get('erro')
    _txt(img, f"{status} | furos={res.registro.get('n_furos')} inliers={res.registro.get('inliers')} "
              f"erro={erro if erro is None else round(erro, 2)} | componentes={len(res.componentes)}",
         (10, 25), (0, 255, 0) if res.valido else (0, 0, 255), 0.6)
    if hasattr(res, 'atualidade'):
        _txt(img, 'PARCIAL: verde=atual laranja=anterior cinza=desconhecido', (10, 48))
    return img


def desenha_retificada(res):
    """ observação deste frame (cor de cada socket e ponte) sobre a vista retificada."""
    if res.retificada is None:
        return None
    img = res.retificada.copy()
    for (m, l, c) in cfg.SOCKETS:
        if hasattr(res, 'atualidade') and m != 0:
            continue
        x, y = cfg.coord_modelo(m, l, c)
        px, py = (int(v) for v in cfg.para_retificada(x, y))
        hx, hy = cfg.ROI_SOCKET
        if hasattr(res, 'atualidade'):
            cv.rectangle(img, (px - hx, py - hy), (px + hx, py + hy),
                         ATUALIDADE_BGR[res.atualidade[m, l, c]], 2)
            continue
        cor = res.cores[m, l, c]
        cv.rectangle(img, (px - hx, py - hy), (px + hx, py + hy), COR_BGR.get(cor, (90, 90, 90)), 2 if cor else 1)
        if c < cfg.N_COLUNAS - 1 and res.pontes[m, l, c]:
            qx, _ = (int(v) for v in cfg.para_retificada(x + 0.5, y))
            hx, hy = cfg.ROI_PONTE
            cv.rectangle(img, (qx - hx, py - hy), (qx + hx, py + hy), COR_BGR[res.pontes[m, l, c]], 2)
    return img


def tabela_sockets(res):
    """ uma linha por socket: metade, linha, coluna, x, y (pixel no frame), furo visto, cor."""
    H = res.registro.get('H')
    if H is None:
        return []
    proj = cv.perspectiveTransform(cfg.MODELO[None], H)[0]
    vistos = res.registro.get('furos_vistos')
    linhas = []
    for k, (m, l, c) in enumerate(cfg.SOCKETS):
        linha = {'metade': cfg.METADES[m], 'linha': l, 'coluna': c,
                       'x': round(float(proj[k, 0]), 1), 'y': round(float(proj[k, 1]), 1),
                       'furo_detectado': None if vistos is None else bool(vistos[k]),
                       'cor': res.cores[m, l, c] if res.cores is not None else None}
        if hasattr(res, 'atualidade'):
            linha.update(observacao=res.observacoes[m, l, c], atualidade=res.atualidade[m, l, c],
                         ativo=(m == 0))
        linhas.append(linha)
    return linhas


def desenha_sockets(frame, res, escala=2):
    """ imagem ampliada com cada socket: centro projetado, coordenada (x,y) em pixels
    do frame original, se o furo foi detectado e a cor encontrada."""
    img = cv.resize(frame, None, fx=escala, fy=escala, interpolation=cv.INTER_LINEAR)
    img = (img * 0.75).astype(np.uint8)  # escurece um pouco para o texto aparecer

    # detecções brutas (inclui falsos positivos que o RANSAC descartou)
    for p in res.registro.get('furos', []):
        cv.drawMarker(img, tuple(int(v * escala) for v in p), (255, 255, 0), cv.MARKER_CROSS, 10, 1)

    tabela = tabela_sockets(res)
    for s in tabela:
        p = (int(s['x'] * escala), int(s['y'] * escala))
        # In the current profile the legacy colour classifier is retained for
        # diagnostics only. Its white/blue readings are not occupancy evidence.
        if s['cor'] and 'atualidade' not in s:
            cor = COR_BGR[s['cor']]
            cv.rectangle(img, (p[0] - 20, p[1] - 20), (p[0] + 20, p[1] + 20), cor, 3)
            _txt(img, s['cor'], (p[0] - 22, p[1] + 36), cor, 0.42)
        ring = ATUALIDADE_BGR[s['atualidade']] if 'atualidade' in s else (
            (0, 255, 0) if s['furo_detectado'] else (0, 140, 255))
        cv.circle(img, p, 6, ring, 2)
        _txt(img, f"{int(s['x'])},{int(s['y'])}", (p[0] - 24, p[1] - 12), (255, 255, 255), 0.38)

    # rótulos de linha e coluna nas bordas de cada metade
    if tabela:
        por_pos = {(s['metade'], s['linha'], s['coluna']): s for s in tabela}
        for m, nome in enumerate(cfg.METADES):
            for c in range(cfg.N_COLUNAS):
                s = por_pos[(nome, 0, c)]
                _txt(img, f'{nome}{c}', (int(s['x'] * escala) - 12, int(s['y'] * escala) - 34), (0, 255, 255), 0.55)
            for l in range(cfg.N_LINHAS_METADE):
                s = por_pos[(nome, l, 0)]
                _txt(img, f'L{l}', (int(s['x'] * escala) - 80, int(s['y'] * escala) + 5), (0, 255, 255), 0.55)

    vistos = sum(1 for s in tabela if s['furo_detectado'])
    ocupados = sum(1 for s in tabela if s['cor'])
    _txt(img, f"sockets: {len(tabela)} | furos casados: {vistos} | deteccoes brutas: {res.registro.get('n_furos')} "
              f"| com cor: {ocupados} | erro mediano: {res.registro.get('erro') or 0:.2f}px", (12, 30), (0, 255, 0), 0.8)
    legenda = ('PARCIAL: verde=atual laranja=anterior cinza=desconhecido | + ciano=candidato'
               if hasattr(res, 'atualidade') else
               'circulo verde = furo detectado | laranja = furo nao visto | + ciano = deteccao bruta')
    _txt(img, legenda, (12, 62), (255, 255, 255), 0.6)
    return img
