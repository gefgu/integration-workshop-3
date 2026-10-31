import type { Lesson, Piece } from '../model/types.ts';

/** Escalate help after deliberate attempts, never from the initial validation request. */
export function challengeHint(lesson: Lesson, pieces: Piece[], misses: number, message: string): string {
  const threshold = lesson.settings?.hintAfter ?? 1;
  if (misses < threshold) return 'Ainda não é isso. Observe o circuito com calma e tente de novo.';
  if (misses === threshold) return message;
  const missing = lesson.board.pieces.find((p) => !pieces.some((a) => a.type === p.type));
  if (lesson.id.includes('02-desafio'))
    return misses > threshold + 1
      ? 'Confira os dois jumpers: um une o + da bateria ao anodo do LED; o outro une o catodo ao −. Os pinos precisam estar nas mesmas colunas, dentro do mesmo banco.'
      : 'Siga do + da bateria até o LED e depois até o −. Procure onde falta um jumper para completar o caminho.';
  if (lesson.id.includes('04-desafio'))
    return misses > threshold + 1
      ? 'Gire o LED: o lado da barra (catodo) deve ficar no caminho de volta ao − da bateria. Preserve a posição da bateria para comparar.'
      : 'Compare os lados do LED com os polos da bateria. O LED só conduz em um sentido.';
  return `${message} ${missing ? 'Confira na bandeja se falta uma peça do circuito pedido.' : 'Confira onde cada pino termina: as colunas do mesmo banco são os pontos de ligação.'}`;
}
