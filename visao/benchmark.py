"""Benchmark warmed current-profile processing on saved board images."""
import argparse
import statistics
import time
from pathlib import Path

import cv2

from .pipeline_atual import PipelineAtual


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('images', nargs='+', type=Path)
    parser.add_argument('--frames', type=int, default=30)
    args = parser.parse_args()
    if args.frames < 1:
        parser.error('--frames must be positive')
    for path in args.images:
        frame = cv2.imread(str(path))
        if frame is None:
            raise SystemExit(f'Cannot read {path}')
        pipeline = PipelineAtual()
        start = time.perf_counter()
        first = pipeline.processa(frame)
        initial = (time.perf_counter() - start) * 1000
        for _ in range(4):
            pipeline.processa(frame)
        samples = []
        for _ in range(args.frames):
            start = time.perf_counter()
            result = pipeline.processa(frame)
            samples.append((time.perf_counter() - start) * 1000)
        pieces = [(p.tipo, p.linha, p.colunas) for p in result.componentes]
        print(f'{path}: initial={initial:.1f} ms valid={first.valido}; '
              f'mean={statistics.mean(samples):.1f} ms median={statistics.median(samples):.1f} ms '
              f'p90={sorted(samples)[int((len(samples)-1)*.9)]:.1f} ms pieces={pieces}')


if __name__ == '__main__':
    main()
