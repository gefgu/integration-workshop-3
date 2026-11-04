/**
 * Tutor feedback written for each build step of the curriculum, derived from the lesson's own circuit.
 * The validator picks the wording by category and component family (`overrides`); these replace its generic
 * "Falta um fio" with what the student has to do on this step: which piece, which value, and which two
 * things a jumper joins. Saved with the lesson, they are also voiced by the tutor.
 */
import type { LessonStep, Piece } from '../model/types.ts';

type Overrides = LessonStep['overrides'];

const BANK_ROWS = 6;
const bank = (row: number) => (row >= BANK_ROWS ? 1 : 0);

const isJumper = (p: Piece) => p.type.startsWith('jumper');
const family = (type: string) =>
  type.startsWith('resistor') ? 'resistor' : type.startsWith('jumper') ? 'jumper' : type;

const OHMS: Record<string, string> = { resistor_220: '220 Ω', resistor_470: '470 Ω', resistor_1k: '1 kΩ' };

/** "o resistor de 470 Ω", "a bateria"... the way the tray names it. */
export function nameOf(p: Piece): string {
  if (p.type === 'bateria') return 'a bateria';
  if (p.type === 'led') return 'o LED';
  if (p.type.startsWith('resistor')) return `o resistor de ${OHMS[p.type] ?? ''}`.trim();
  if (p.type === 'buzzer') return 'o buzzer';
  if (p.type === 'botao') return 'o botão';
  if (p.type === 'capacitor') return 'o capacitor';
  if (p.type === 'potenciometro') return 'o potenciômetro';
  if (p.type === 'capsula_amperimetro') return 'a cápsula do amperímetro';
  if (p.type.startsWith('capsula_')) return 'a cápsula';
  return 'o jumper';
}

/** What a column means to the student: the battery's + or −, the LED's side, or just the piece. */
function role(p: Piece, col: number): string {
  if (p.type === 'bateria') return col === p.a ? 'o + da bateria' : 'o − da bateria';
  if (p.type === 'led') return col === p.a ? 'o lado + (anodo) do LED' : 'o lado − (catodo, o da barra) do LED';
  return nameOf(p);
}

/** "o LED" → "ao LED" / "do LED", "a bateria" → "à bateria" / "da bateria"; several things are joined with "e". */
const ao = (items: string[]) => items.map((t) => t.replace(/^o /, 'ao ').replace(/^a /, 'à ')).join(' e ');
const de = (items: string[]) => items.map((t) => t.replace(/^o /, 'do ').replace(/^a /, 'da ')).join(' e ');

/** The things sitting in `col` (same bank as `row`) among the pieces already placed. */
function whoIsAt(placed: Piece[], col: number, row: number): string[] {
  const found = new Set<string>();
  for (const p of placed) {
    if (isJumper(p) || bank(p.row) !== bank(row)) continue;
    for (const c of [p.a, p.b, ...(p.c != null ? [p.c] : [])]) if (c === col) found.add(role(p, c));
  }
  return found.size ? [...found] : ['a coluna certa'];
}

/** "o + da bateria" ↔ "o lado + (anodo) do LED": what the jumper `w` joins, given what is already on the bench. */
export function jumperEnds(w: Piece, placed: Piece[]): [string[], string[]] {
  return [whoIsAt(placed, w.a, w.row), whoIsAt(placed, w.b, w.row)];
}

const REVERSED = {
  led: 'O LED está ao contrário. Gire-o: o lado da barra (catodo) deve ficar do lado que volta ao − da bateria.',
  bateria: 'A bateria está ao contrário: o + e o − estão trocados. Gire-a para o + ficar onde o circuito pede.',
};

/** Hints for the step that places `piece`, after `placed` (everything placed before it). */
export function placementHints(piece: Piece, placed: Piece[]): Overrides {
  const fam = family(piece.type);
  const name = nameOf(piece);
  if (isJumper(piece)) {
    const [from, to] = jumperEnds(piece, placed);
    return {
      missing_connection: {
        jumper: `Falta um jumper: ligue ${from.join(' e ')} ${ao(to)}. Encaixe uma ponta na coluna de cada um.`,
      },
      incorrect_connection: {
        '*': `Tem um jumper no lugar errado. Uma ponta deve ficar na coluna ${de(from)} e a outra na coluna ${de(to)}.`,
      },
      excess_connection: {
        jumper: `Tem um jumper a mais. Tire-o: esta etapa pede só o jumper que liga ${from.join(' e ')} ${ao(to)}.`,
      },
      open_circuit: {
        '*': `Ainda não fecha. Confira se uma ponta do jumper está na coluna ${de(from)} e a outra na coluna ${de(to)}.`,
      },
      short_circuit: {
        '*': `Curto-circuito! O jumper está ligando dois pontos errados. Tire-o e ligue só ${from.join(' e ')} ${ao(to)}.`,
      },
      reversed_polarity: REVERSED,
    };
  }
  const out: Overrides = {
    missing_component: {
      [fam]: `Falta ${name}. Pegue-${fam === 'bateria' || fam.startsWith('capsula') ? 'a' : 'o'} na bandeja e encaixe na bancada.`,
    },
    wrong_component: { '*': `Essa não é a peça desta etapa. Aqui entra ${name}: troque a peça pela certa.` },
    excess_component: { '*': `Tem {nome} sobrando. Esta etapa pede só ${name}: tire a peça extra.` },
    excess_connection: { jumper: `Ainda não é hora dos jumpers. Tire-o: nesta etapa só falta colocar ${name}.` },
  };
  if (fam === 'resistor') {
    out.wrong_value = {
      resistor: `Esse é o resistor certo, mas de outro valor. Nesta etapa use ${name}: o valor vem escrito na peça da bandeja.`,
    };
  }
  if (fam === 'led' || fam === 'bateria') out.reversed_polarity = REVERSED;
  return out;
}

/** Hints for the final "connect the circuit" step. `loop` is the path the current takes, in words. */
export function circuitHints(loop: string, board: Piece[] = []): Overrides {
  const values = board.filter((p) => p.type.startsWith('resistor')).map((p) => OHMS[p.type]);
  return {
    ...(values.length
      ? {
          wrong_value: {
            resistor:
              values.length === 1
                ? `O resistor está certo, mas o valor não. Este circuito pede o de ${values[0]}: troque por ele.`
                : `Um dos resistores está com o valor errado. Os valores pedidos são ${values.join(' e ')}: confira em cada ramo.`,
          },
        }
      : {}),
    open_circuit: {
      '*': `O caminho está aberto. A corrente precisa fazer este percurso: ${loop}. Siga-o com o dedo e veja onde para: quase sempre é a ponta de um jumper fora da coluna certa.`,
    },
    incorrect_connection: {
      '*': `Alguma ligação está fora do lugar. O caminho certo é: ${loop}. Compare, ligação por ligação, com essa ordem.`,
    },
    missing_connection: { jumper: `Falta um jumper. Confira se o caminho está completo: ${loop}.` },
    short_circuit: {
      '*': `Curto-circuito! Algum jumper liga os dois lados da bateria sem passar pelas peças. Procure-o e tire-o: o caminho deve ser ${loop}.`,
    },
    reversed_polarity: REVERSED,
  };
}

// --- build steps: place several pieces and connect them -----------------------------------------------------

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** "o + da bateria com o lado + (anodo) do LED": the connections that exist among `pieces` and involve a new piece. */
export function connectionPairs(pieces: Piece[], newIds: Set<string>): string[] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root) as string;
    parent.set(x, root);
    return root;
  };
  const key = (col: number, row: number) => `${bank(row)}:${col}`;
  for (const p of pieces) {
    find(key(p.a, p.row));
    find(key(p.b, p.row));
    if (isJumper(p)) parent.set(find(key(p.a, p.row)), find(key(p.b, p.row)));
  }
  const nets = new Map<string, { piece: Piece; col: number }[]>();
  const touchesNew = new Set<string>();
  for (const p of pieces) {
    const cols = isJumper(p) ? [p.a, p.b] : [p.a, p.b, ...(p.c != null ? [p.c] : [])];
    for (const col of cols) {
      const net = find(key(col, p.row));
      if (newIds.has(p.id)) touchesNew.add(net);
      if (isJumper(p)) continue;
      if (!nets.has(net)) nets.set(net, []);
      (nets.get(net) as { piece: Piece; col: number }[]).push({ piece: p, col });
    }
  }
  const out: string[] = [];
  for (const [net, members] of nets) {
    if (!touchesNew.has(net) || new Set(members.map((m) => m.piece.id)).size < 2) continue;
    const parts = [...new Set(members.map((m) => role(m.piece, m.col)))];
    out.push(parts.length > 2 ? `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}` : parts.join(' com '));
  }
  return out;
}

/** Hints for a build step that places `group` (after `before`) and connects it to what is already on the bench. */
export function groupHints(group: Piece[], before: Piece[], done?: string): Overrides {
  const all = [...before, ...group];
  const onBench = all.filter((p) => !isJumper(p));
  const newIds = new Set(group.map((p) => p.id));
  const fresh = group.filter((p) => !isJumper(p));
  const pairs = connectionPairs(all, newIds);
  const names = fresh.map(nameOf);
  const intro =
    names.length === 2
      ? `${cap(names[0])} e ${names[1]} ainda não estão conectados.`
      : names.length === 1
        ? `${cap(names[0])} ainda não está conectado${names[0].startsWith('a ') ? 'a' : ''} ao resto do circuito.`
        : 'As peças desta etapa ainda não estão todas conectadas.';
  const how = pairs.length
    ? ` Conecte: ${pairs.join('; ')}. Encaixe um terminal de cada peça na mesma coluna, ou use um jumper.`
    : ' Encaixe um terminal de cada peça na mesma coluna, ou use um jumper.';
  const notConnected = `${intro}${how}`;
  const wrongLinks = `As ligações não são as pedidas nesta etapa.${pairs.length ? ` Aqui a ligação é: ${pairs.join('; ')} (só isso por enquanto).` : ''}`;

  // One "Falta ..." per family on the bench so far; a family with two parts (two resistors) names both.
  const missing: Record<string, string> = {};
  for (const p of onBench) {
    const fam = family(p.type);
    missing[fam] = missing[fam] ? `${missing[fam].replace(/\. .*$/, '')} e ${nameOf(p)}` : nameOf(p);
  }
  const missingText = Object.fromEntries(
    Object.entries(missing).map(([fam, name]) => [fam, `Falta ${name}. Pegue na bandeja e encaixe na bancada.`])
  );
  const values = onBench.filter((p) => p.type.startsWith('resistor')).map((p) => OHMS[p.type]);
  const list = onBench.map(nameOf).join(', ');
  const out: Overrides = {
    missing_component: missingText,
    wrong_component: { '*': `Alguma peça não é a pedida. Nesta etapa a bancada tem: ${list}.` },
    excess_component: { '*': `Tem {nome} sobrando. Nesta etapa a bancada tem: ${list}.` },
    open_circuit: { '*': notConnected },
    missing_connection: { jumper: notConnected },
    incorrect_connection: { '*': wrongLinks },
    misconnected_component: { '*': wrongLinks },
    short_circuit: {
      '*': `Curto-circuito! Algum jumper liga os dois lados da bateria sem passar pelas peças.${pairs.length ? ` Ligue só: ${pairs.join('; ')}.` : ''}`,
    },
    reversed_polarity: REVERSED,
  };
  if (values.length) {
    out.wrong_value = {
      resistor: `O resistor está certo, mas o valor não. Aqui use ${values.length === 1 ? `o de ${values[0]}` : `os de ${values.join(' e ')}`}.`,
    };
  }
  if (done) out.complete = { '*': done };
  return out;
}

export interface ChecklistItem {
  label: string;
  done: boolean;
}

/** Live ticks for a build step: each new piece on the bench, then "connected" once the validator agrees. */
export function groupChecklist(group: Piece[], before: Piece[], student: Piece[], connected: boolean): ChecklistItem[] {
  const count = (pieces: Piece[], type: string) => pieces.filter((p) => p.type === type).length;
  const upTo = [...before, ...group];
  const items = group
    .filter((p) => !isJumper(p))
    .map((p) => {
      const need = count(upTo.slice(0, upTo.findIndex((x) => x.id === p.id) + 1), p.type);
      return { label: `${cap(nameOf(p))} na bancada`, done: count(student, p.type) >= need };
    });
  items.push({ label: 'Tudo conectado como pedido', done: connected });
  return items;
}
