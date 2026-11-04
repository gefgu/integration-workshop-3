import type { Lesson, Piece } from '../model/types.ts';

/** What the tutor can say about a mistake before it gives the validator's own wording. Hints, not answers. */
const NUDGE: Record<string, string> = {
  reversed_polarity:
    'Quase! Uma peça tem um lado certo e parece estar ao contrário. Quais peças do circuito têm + e −?',
  open_circuit:
    'A corrente ainda não consegue dar a volta. Siga com o dedo do + da bateria até o − e veja onde ela para.',
  missing_connection: 'Falta ligar alguma coisa. Siga com o dedo do + da bateria até o − e veja onde o caminho para.',
  short_circuit:
    'Cuidado: a corrente está pegando um atalho. Procure um fio que ligue dois pontos que não deviam se encontrar.',
  missing_component: 'Confira as peças da bandeja: será que falta alguma na sua bancada?',
  excess_component: 'Confira as peças da bancada: será que tem alguma a mais do que o circuito pede?',
  wrong_component: 'Alguma peça da bancada não é a que o circuito pede. Confira cada uma.',
  wrong_value: 'A peça está certa, mas o valor não. Veja o valor escrito em cada peça da bandeja.',
};
const DEFAULT_NUDGE =
  'Ainda não é isso. Siga o caminho da corrente com o dedo: ela sai do + da bateria, passa pelas peças e volta ao −.';

/** Specific help for the challenges that are built on the bench: [a closer clue, the near-answer]. */
const LESSON_TIPS: Record<string, [string, string]> = {
  '02-desafio': [
    'Siga do + da bateria até o LED e depois até o −. Procure onde falta um jumper para completar o caminho.',
    'Falta o jumper do + da bateria até o lado + (anodo) do LED: uma ponta na coluna do +, a outra na coluna do anodo. O lado − do LED já está na coluna do − da bateria.',
  ],
  '04-desafio': [
    'Compare os lados do LED com os polos da bateria. O LED só conduz em um sentido.',
    'Gire o LED: o lado da barra (catodo) deve ficar no caminho de volta ao − da bateria. Preserve a posição da bateria para comparar.',
  ],
  '05-desafio': [
    'Para o LED só acender com os DOIS botões apertados, a corrente tem de passar por um botão E depois pelo outro, um atrás do outro (em série).',
    'Monte a fila: + da bateria → resistor → LED → botão A → botão B → − da bateria, ligando cada peça à próxima com jumpers.',
  ],
  '09-desafio': [
    'São dois defeitos ao mesmo tempo. Comece pelo mais perigoso: procure um jumper que liga os dois lados da bateria direto. É ele que dispara o alarme de curto.',
    'Tire o jumper curto que liga as duas colunas da bateria. Depois, se uma peça estiver marcada como “solta”, clique nela para encaixá-la de verdade.',
  ],
};

const TYPE_NAME: Record<string, string> = {
  bateria: 'bateria',
  led: 'LED',
  buzzer: 'buzzer',
  botao: 'botão',
  capacitor: 'capacitor',
  potenciometro: 'potenciômetro',
  resistor_220: 'resistor de 220 Ω',
  resistor_470: 'resistor de 470 Ω',
  resistor_1k: 'resistor de 1 kΩ',
  capsula_amperimetro: 'cápsula do amperímetro',
};

const countByType = (pieces: Piece[]) => {
  const counts = new Map<string, number>();
  for (const p of pieces) if (!p.type.startsWith('jumper')) counts.set(p.type, (counts.get(p.type) ?? 0) + 1);
  return counts;
};

const list = (counts: Map<string, number>) =>
  [...counts].map(([type, n]) => `${n > 1 ? `${n} ` : ''}${TYPE_NAME[type] ?? type}${n > 1 ? 's' : ''}`).join(', ');

/** Which pieces (jumpers aside) the bench lacks or has too many of, in words; '' when the pieces are right. */
export function piecesGap(wanted: Piece[], have: Piece[]): string {
  const want = countByType(wanted);
  const got = countByType(have);
  const missing = new Map<string, number>();
  const extra = new Map<string, number>();
  for (const [type, n] of want) if ((got.get(type) ?? 0) < n) missing.set(type, n - (got.get(type) ?? 0));
  for (const [type, n] of got) if (n > (want.get(type) ?? 0)) extra.set(type, n - (want.get(type) ?? 0));
  const parts: string[] = [];
  if (missing.size) parts.push(`Faltam na bancada: ${list(missing)}.`);
  if (extra.size) parts.push(`Estão sobrando: ${list(extra)}.`);
  return parts.join(' ');
}

/**
 * Escalate help after deliberate attempts, never from the initial validation request:
 * a nudge that names no answer, then the validator's own wording, then a closer clue, then the near-answer.
 */
export function challengeHint(
  lesson: Lesson,
  pieces: Piece[],
  misses: number,
  message: string,
  category?: string | null
): string {
  const threshold = lesson.settings?.hintAfter ?? 1;
  if (misses < threshold) return (category && NUDGE[category]) || DEFAULT_NUDGE;
  if (misses === threshold) return message;
  const tips = Object.entries(LESSON_TIPS).find(([suffix]) => lesson.id.includes(suffix))?.[1];
  const gap = piecesGap(lesson.board.pieces, pieces);
  if (tips) return misses > threshold + 1 ? tips[1] : tips[0];
  return misses > threshold + 1
    ? `${message} ${gap || 'As peças estão certas: confira onde cada jumper começa e termina, e se os pinos estão nas colunas certas do mesmo socket.'}`
    : `${message} ${gap || 'Confira onde cada pino termina: as colunas do mesmo socket são os pontos de ligação.'}`;
}
