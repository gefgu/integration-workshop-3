""" uso:
    python -m visao real_img/pecas2.jpeg            # analisa imagens soltas
    python -m visao real_img/*.jpg --debug saida/   # salva imagens de depuração
    python -m visao real_img/pecas2.jpeg --cores    # imprime HSV dos sockets ocupados (calibrar cores)
    python -m visao --camera 0 --mostrar            # tempo real (5 fps). teclas: r = recalibrar, s = salvar, q = sair
"""

import argparse
import csv
import json
import os
import sys
import time

import cv2 as cv

from . import config as cfg
from .pipeline import Pipeline
from .circuito import para_dict, resumo
from .sockets import hsv_ocupados
from .debug import desenha_frame, desenha_retificada, desenha_sockets, tabela_sockets


def saida_json(res):
    return {'valido': res.valido, 'motivo': res.motivo,
            'circuito': para_dict(res.grafo),
            'circuito_eletrico': para_dict(res.grafo_eletrico)}


def salva_debug(pasta, nome, frame, res):
    os.makedirs(pasta, exist_ok=True)
    cv.imwrite(os.path.join(pasta, f'{nome}_frame.jpg'), desenha_frame(frame, res))
    ret = desenha_retificada(res)
    if ret is not None:
        cv.imwrite(os.path.join(pasta, f'{nome}_retificada.jpg'), ret)
    cv.imwrite(os.path.join(pasta, f'{nome}_sockets.jpg'), desenha_sockets(frame, res))
    tabela = tabela_sockets(res)
    if tabela:
        with open(os.path.join(pasta, f'{nome}_sockets.csv'), 'w', newline='') as f:
            w = csv.DictWriter(f, fieldnames=list(tabela[0]))
            w.writeheader()
            w.writerows(tabela)


def roda_imagens(args):
    for caminho in args.imagens:
        frame = cv.imread(caminho)
        if frame is None:
            print(f'não consegui abrir {caminho}', file=sys.stderr)
            continue
        res = Pipeline(temporal=False).processa(frame)
        print(f"== {caminho}  [{'ok' if res.valido else 'DESCARTADO: ' + res.motivo}]")
        print(resumo(res.grafo))
        if args.json:
            print(json.dumps(saida_json(res), ensure_ascii=False, indent=2))
        if args.cores and res.retificada is not None:
            for s, cor, hsv in hsv_ocupados(res.retificada, res.cores):
                print(f'  socket {s}: cor={cor} hsv_mediano={hsv.astype(int).tolist()}')
        if args.debug:
            salva_debug(args.debug, os.path.splitext(os.path.basename(caminho))[0], frame, res)


def abre_camera(indice, travar):
    cap = cv.VideoCapture(indice)
    cap.set(cv.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv.CAP_PROP_FRAME_HEIGHT, 720)
    cap.set(cv.CAP_PROP_BUFFERSIZE, 1)
    if travar:
        # exposição e balanço de branco automáticos mudam as cores entre frames
        cap.set(cv.CAP_PROP_AUTO_WB, 0)
        cap.set(cv.CAP_PROP_AUTO_EXPOSURE, 1)  # V4L2: 1 = manual
    return cap


def roda_camera(args):
    cap = abre_camera(args.camera, args.travar_camera)
    if not cap.isOpened():
        sys.exit(f'não consegui abrir a câmera {args.camera}')
    pipeline = Pipeline()
    periodo = 1.0 / cfg.FPS
    n = 0
    try:
        while True:
            inicio = time.monotonic()
            ok, frame = cap.read()
            if not ok:
                print('falha ao ler frame', file=sys.stderr)
                break
            res = pipeline.processa(frame)
            n += 1

            if res.mudou:
                dados = saida_json(res)
                print(f'--- frame {n}: circuito mudou\n{resumo(res.grafo)}', flush=True)
                if args.json and args.json != '-':
                    with open(args.json, 'w') as f:
                        json.dump(dados, f, ensure_ascii=False, indent=2)
            if not res.valido and args.verbose:
                print(f'frame {n} descartado: {res.motivo}', file=sys.stderr)

            if args.mostrar:
                cv.imshow('visao', desenha_frame(frame, res))
                ret = desenha_retificada(res)
                if ret is not None:
                    cv.imshow('retificada', ret)
                tecla = cv.waitKey(1) & 0xFF
                if tecla == ord('q'):
                    break
                if tecla == ord('r'):
                    pipeline.recalibrar()
                if tecla == ord('s'):
                    salva_debug(args.debug or 'debug', f'frame{n:05d}', frame, res)

            time.sleep(max(0.0, periodo - (time.monotonic() - inicio)))
    finally:
        cap.release()
        cv.destroyAllWindows()


def main():
    p = argparse.ArgumentParser(prog='python -m visao', description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('imagens', nargs='*', help='imagens para analisar')
    p.add_argument('--camera', type=int, help='índice da câmera (tempo real)')
    p.add_argument('--mostrar', action='store_true', help='abre janelas com o resultado (câmera)')
    p.add_argument('--debug', metavar='PASTA', help='salva imagens de depuração nesta pasta')
    p.add_argument('--json', metavar='ARQUIVO', nargs='?', const='-', help='câmera: grava o circuito neste arquivo a cada mudança; imagens: imprime o JSON completo')
    p.add_argument('--cores', action='store_true', help='imprime o HSV dos sockets ocupados')
    p.add_argument('--travar-camera', action='store_true', help='desliga exposição/balanço de branco automáticos')
    p.add_argument('-v', '--verbose', action='store_true')
    args = p.parse_args()

    if args.camera is not None:
        roda_camera(args)
    elif args.imagens:
        roda_imagens(args)
    else:
        p.print_help()


if __name__ == '__main__':
    main()
