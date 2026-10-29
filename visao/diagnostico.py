""" diagnóstico rápido: lê alguns frames da câmera e diz em que etapa do pipeline eles falham,
comparando exposição travada e automática.
uso: python -m visao.diagnostico [índice_da_câmera] [pasta_de_saída] [max_obstruídos]"""

import os
import sys

import cv2 as cv

from .__main__ import abre_camera, salva_debug
from . import config as cfg
from .pipeline import Pipeline
from .circuito import desenha_placa


def testa(indice, pasta, travar):
    nome = 'travada' if travar else 'auto'
    cap = abre_camera(indice, travar)
    if not cap.isOpened():
        sys.exit(f'não consegui abrir a câmera {indice} (está em uso por outro programa?)')
    pipeline = Pipeline(temporal=False)
    res = frame = None
    for _ in range(20):  # os primeiros frames costumam vir escuros/desfocados
        ok, frame = cap.read()
        if not ok:
            sys.exit('falha ao ler frame')
        res = pipeline.processa(frame)
    cap.release()
    print(f"[{nome}] {frame.shape[1]}x{frame.shape[0]} brilho={frame.mean():.0f} "
          f"furos={res.registro.get('furos_vistos').sum() if res.registro.get('furos_vistos') is not None else '-'} "
          f"inliers={res.registro.get('inliers')} obstruídos={res.obstruidos} "
          f"-> {'ok' if res.valido else 'DESCARTADO: ' + res.motivo}; componentes={len(res.componentes)}")
    if res.valido:
        print(desenha_placa(res.grafo))
    cv.imwrite(os.path.join(pasta, f'{nome}_bruto.jpg'), frame)
    if res.retificada is not None:
        cv.imwrite(os.path.join(pasta, f'{nome}_ret_bruta.png'), res.retificada)
    salva_debug(pasta, nome, frame, res)


def main():
    indice = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    pasta = sys.argv[2] if len(sys.argv) > 2 else 'debug_diagnostico'
    if len(sys.argv) > 3:
        cfg.MAX_OBSTRUIDOS = int(sys.argv[3])
    os.makedirs(pasta, exist_ok=True)
    for travar in (False,):
        testa(indice, pasta, travar)
    print(f'imagens em {os.path.abspath(pasta)}')


if __name__ == '__main__':
    main()
