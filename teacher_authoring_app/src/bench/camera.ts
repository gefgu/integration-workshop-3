/** Camera board view helpers (SFR17.1), kept pure for tests. */

/** pt-BR message for a getUserMedia failure, by DOMException name. */
export function cameraErrorMessage(name: string): string {
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'A bancada não tem permissão para usar a câmera. Chame seu professor.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Nenhuma câmera encontrada. Confira se o cabo da câmera está conectado.';
    case 'NotReadableError':
      return 'A câmera está sendo usada por outro programa. Chame seu professor.';
    default:
      return 'Não consegui ligar a câmera. Chame seu professor.';
  }
}

/**
 * Guide lines for the board overlay, as percentages of the view: one vertical line per column edge and one
 * horizontal line per row edge, inside a margin that leaves room for the four corner markers.
 */
export function gridLines(cols: number, rows: number, margin = 6): { xs: number[]; ys: number[] } {
  const span = 100 - 2 * margin;
  const xs = Array.from({ length: cols + 1 }, (_, i) => margin + (span * i) / cols);
  const ys = Array.from({ length: rows + 1 }, (_, i) => margin + (span * i) / rows);
  return { xs, ys };
}
