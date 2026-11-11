""" uso:
    python -m visao visao/fixtures/current/frame-00.jpg --json
    python -m visao --camera 1 --mostrar            # r = recalibrar, s = salvar, q = sair
    python -m visao --camera 1 --calibrate /tmp/cal.json --mostrar
    python -m visao --profile legacy real_img/pecas2.jpeg
"""

import argparse
import csv
import json
import os
import sys
import tempfile
import time

import cv2 as cv

from . import config as cfg
from .pipeline import Pipeline
from .circuito import desenha_placa, para_dict
from .sockets import assegura_cores, hsv_ocupados
from .tela import desenha_tela
from .debug import desenha_frame, desenha_retificada, desenha_sockets, tabela_sockets


def saida_json(res):
    saida = {'valido': res.valido, 'motivo': res.motivo,
            'circuito': para_dict(res.grafo),
            'circuito_eletrico': para_dict(res.grafo_eletrico)}
    if hasattr(res, 'perfil'):
        saida.update(perfil=res.perfil, completo=res.completo,
                     observacoes=res.observacoes.tolist(), atualidade=res.atualidade.tolist(),
                     pecas_sem_tipo=res.pecas_sem_tipo)
    return saida


def estado_camera_indisponivel(perfil, motivo):
    """An ended or unstarted stream must not advertise an old valid board."""
    saida = {'valido': False, 'motivo': motivo,
             'circuito': {'componentes': [], 'redes': []},
             'circuito_eletrico': {'componentes': [], 'redes': []}}
    if perfil == 'current':
        desconhecido = [[['unknown' for _ in range(cfg.N_COLUNAS)]
                         for _ in range(cfg.N_LINHAS_METADE)] for _ in range(2)]
        saida.update(perfil=perfil, completo=False, observacoes=desconhecido,
                     atualidade=[[row.copy() for row in bank] for bank in desconhecido],
                     pecas_sem_tipo=[])
    return saida


def publica_camera(destino, dados):
    if not destino:
        return
    dados = dict(dados, gerado_em_unix=time.time())
    if destino == '-':
        print(json.dumps(dados, ensure_ascii=False), flush=True)
        return
    diretorio = os.path.dirname(os.path.abspath(destino))
    temporario = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=diretorio,
                                         prefix='.visao-', suffix='.json', delete=False) as arquivo:
            temporario = arquivo.name
            json.dump(dados, arquivo, ensure_ascii=False, indent=2)
        os.replace(temporario, destino)
    finally:
        if temporario is not None and os.path.exists(temporario):
            os.unlink(temporario)


def cria_pipeline(args, temporal=True):
    if args.profile == 'current':
        from .pipeline_atual import PipelineAtual
        return PipelineAtual(args.calibration, temporal=temporal)
    return Pipeline(temporal=temporal)


def salva_debug(pasta, nome, frame, res):
    os.makedirs(pasta, exist_ok=True)
    original = os.path.join(pasta, f'{nome}_bruta.png')
    if not cv.imwrite(original, frame):
        raise OSError(f'não consegui salvar o frame original: {original}')
    cv.imwrite(os.path.join(pasta, f'{nome}_frame.jpg'), desenha_frame(frame, res))
    ret = desenha_retificada(res)
    if ret is not None:
        cv.imwrite(os.path.join(pasta, f'{nome}_retificada.jpg'), ret)
    cv.imwrite(os.path.join(pasta, f'{nome}_sockets.jpg'), desenha_sockets(frame, res))
    cv.imwrite(os.path.join(pasta, f'{nome}_placa.png'), desenha_tela(res))
    tabela = tabela_sockets(res)
    if tabela:
        with open(os.path.join(pasta, f'{nome}_sockets.csv'), 'w', newline='') as f:
            w = csv.DictWriter(f, fieldnames=list(tabela[0]))
            w.writeheader()
            w.writerows(tabela)


def roda_imagens(args):
    if getattr(args, 'calibrate', None):
        from .calibracao import calibra_interativa
        frame = cv.imread(args.imagens[0])
        if frame is None:
            sys.exit(f'não consegui abrir {args.imagens[0]}')
        if not calibra_interativa(frame, args.calibrate):
            return
        args.calibration = args.calibrate
    for caminho in args.imagens:
        frame = cv.imread(caminho)
        if frame is None:
            print(f'não consegui abrir {caminho}', file=sys.stderr)
            continue
        res = cria_pipeline(args, temporal=False).processa(frame)
        print(f"== {caminho}  [{'ok' if res.valido else 'DESCARTADO: ' + res.motivo}]")
        if getattr(res, 'perfil', None) == 'current':
            print('Leitura parcial: posições não reconhecidas são desconhecidas, não vazias.')
        print(desenha_placa(res.grafo))
        for item in getattr(res, 'pecas_sem_tipo', []):
            print(f"  peça sem tipo em {item['metade']}{item['linha']}, "
                  f"colunas {item['colunas'][0]}-{item['colunas'][-1]} ({item['atualidade']})")
        if args.json:
            print(json.dumps(saida_json(res), ensure_ascii=False, indent=2))
        if args.cores and res.retificada is not None:
            for s, cor, hsv in hsv_ocupados(res.retificada, assegura_cores(res)):
                print(f'  socket {s}: cor={cor} hsv_mediano={hsv.astype(int).tolist()}')
        if args.debug:
            salva_debug(args.debug, os.path.splitext(os.path.basename(caminho))[0], frame, res)


def abre_camera(indice, travar):
    # V4L2 direto: o backend automático pode cair num que só entrega 640x480.
    # MJPG é o formato em que as câmeras USB entregam 720p/1080p.
    cap = cv.VideoCapture(indice, cv.CAP_V4L2)
    # On Linux another backend may silently open a different physical camera
    # when the requested V4L2 device is busy or unavailable.
    if not cap.isOpened() and not sys.platform.startswith('linux'):
        cap = cv.VideoCapture(indice)
    cap.set(cv.CAP_PROP_FOURCC, cv.VideoWriter_fourcc(*'MJPG'))
    cap.set(cv.CAP_PROP_FRAME_WIDTH, cfg.CAMERA_LARGURA)
    cap.set(cv.CAP_PROP_FRAME_HEIGHT, cfg.CAMERA_ALTURA)
    cap.set(cv.CAP_PROP_BUFFERSIZE, 1)
    if travar:
        # exposição e balanço de branco automáticos mudam as cores entre frames
        cap.set(cv.CAP_PROP_AUTO_WB, 0)
        cap.set(cv.CAP_PROP_AUTO_EXPOSURE, 1)  # V4L2: 1 = manual
    return cap


def roda_camera(args):
    publica_camera(args.json, estado_camera_indisponivel(args.profile, 'aguardando câmera'))
    cap = abre_camera(args.camera, args.travar_camera)
    if not cap.isOpened():
        cap.release()
        sys.exit(f'não consegui abrir a câmera {args.camera}')
    periodo = 1.0 / cfg.FPS
    n = 0
    ultimo_envio = None
    motivo_termino = 'câmera encerrada'
    try:
        if getattr(args, 'calibrate', None):
            from .calibracao import calibra_interativa
            frame = None
            for _ in range(15):
                ok, frame = cap.read()
                if not ok:
                    sys.exit('falha ao ler frame para calibrar')
            if not calibra_interativa(frame, args.calibrate):
                return
            args.calibration = args.calibrate
        pipeline = cria_pipeline(args)
        while True:
            inicio = time.monotonic()
            ok, frame = cap.read()
            if not ok:
                print('falha ao ler frame', file=sys.stderr)
                motivo_termino = 'falha ao ler frame'
                break
            res = pipeline.processa(frame)
            n += 1

            if res.mudou:
                print(f'--- frame {n}: circuito mudou ({len(res.componentes)} componente(s))',
                      file=sys.stderr if args.json == '-' else sys.stdout, flush=True)
            if args.json and (res.mudou or ultimo_envio is None or inicio - ultimo_envio >= 1.0):
                publica_camera(args.json, saida_json(res))
                ultimo_envio = time.monotonic()
            if not res.valido and args.verbose:
                print(f'frame {n} descartado: {res.motivo}', file=sys.stderr)

            if args.mostrar:
                cv.imshow('visao', desenha_frame(frame, res))
                cv.imshow('placa', desenha_tela(res))
                ret = desenha_retificada(res)
                if ret is not None:
                    cv.imshow('retificada', ret)
                tecla = cv.waitKey(1) & 0xFF
                if tecla == ord('q'):
                    break
                if tecla == ord('r'):
                    pipeline.recalibrar()
                if tecla == ord('s'):
                    nome = f'frame{n:05d}-{time.time_ns()}'
                    salva_debug(args.debug or 'debug', nome, frame, res)
                    print(f'diagnóstico salvo em {os.path.join(args.debug or "debug", nome)}_*',
                          file=sys.stderr if args.json == '-' else sys.stdout, flush=True)

            time.sleep(max(0.0, periodo - (time.monotonic() - inicio)))
    finally:
        cap.release()
        cv.destroyAllWindows()
        publica_camera(args.json, estado_camera_indisponivel(args.profile, motivo_termino))


def main():
    p = argparse.ArgumentParser(prog='python -m visao', description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('imagens', nargs='*', help='imagens para analisar')
    p.add_argument('--camera', type=int, help='índice da câmera (tempo real)')
    p.add_argument('--mostrar', action='store_true', help='abre janelas com o resultado (câmera)')
    p.add_argument('--debug', metavar='PASTA', help='salva imagens de depuração nesta pasta')
    p.add_argument('--json', metavar='ARQUIVO', nargs='?', const='-', help='câmera: atualiza JSON a cada mudança e a cada segundo; imagens: imprime JSON')
    p.add_argument('--cores', action='store_true', help='imprime o HSV dos sockets ocupados')
    p.add_argument('--travar-camera', action='store_true', help='desliga exposição/balanço de branco automáticos')
    p.add_argument('--profile', choices=('current', 'legacy'), default='current', help='perfil do tabuleiro')
    p.add_argument('--calibration', help='calibração manual do perfil current (opcional)')
    p.add_argument('--calibrate', metavar='ARQUIVO', help='seleciona cantos e grava nova calibração')
    p.add_argument('-v', '--verbose', action='store_true')
    args = p.parse_args()

    if args.calibrate and (args.profile != 'current' or args.calibration):
        p.error('--calibrate exige perfil current e não pode ser combinado com --calibration')
    if args.calibrate and not (args.camera is not None or args.imagens):
        p.error('--calibrate requer uma imagem ou câmera')
    if args.calibrate and os.path.exists(args.calibrate):
        p.error('o arquivo de calibração já existe; escolha outro caminho')

    if args.camera is not None:
        roda_camera(args)
    elif args.imagens:
        roda_imagens(args)
    else:
        p.print_help()


if __name__ == '__main__':
    main()
