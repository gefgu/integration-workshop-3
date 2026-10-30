/**
 * The TedTronics curriculum (Notion “Guided Lessons and Challenges”): lessons 1–10,
 * each with a guided and a challenge version where the page specifies one.
 *
 * The lessons double as authoring examples (`tags`): every one says in `teacherNotes` what it teaches,
 * how success is judged, which parts are simulated, and where it departs from the Notion text.
 * Explanations and drawings were drafted with AI assistance during development and stored here so they
 * work offline; no AI runs while a student plays.
 */
import { LESSON_VERSION } from '../model/lesson.ts';
import { connectionStep, newStep } from '../model/steps.ts';
import type { ExperimentSpec, Illustration, Lesson, LessonSettings, LessonStep, Piece, Quiz } from '../model/types.ts';
import {
  artAlarm,
  artButton,
  artBuzzer,
  artCapacitor,
  artLedPolarity,
  artLoop,
  artNodes,
  artPot,
  artResistorBands,
  artSafety,
  artWorkbench,
} from './art.ts';
import {
  circuitL01,
  circuitL02,
  circuitL03,
  circuitL04,
  circuitL05,
  circuitL05Challenge,
  circuitL06,
  circuitL07,
  circuitL08,
  circuitL08Pot,
  circuitL10,
  P,
  withPiece,
} from './circuits.ts';

export const SEED_PREFIX = 'curriculo-';

/** Curriculum content that no longer exists (the color-code resistor was removed from the project); the seed deletes these. */
export const RETIRED_LESSON_IDS = [`${SEED_PREFIX}bonus-guiada`, `${SEED_PREFIX}bonus-desafio`];
export const RETIRED_MODULE_TITLES = ['Trilha 2 — Código de cores, sentido e botão (bônus, 4 e 5)'];
const SEED_DATE = '2026-10-30T00:00:00.000Z';

// --- tiny builders -------------------------------------------------------------------------------

/** A question with feedback on every option. `options` are [text, feedback]; `correct` is the index. */
function quiz(id: string, prompt: string, options: [string, string][], correct: number): Quiz {
  const ids = options.map((_, i) => `${id}-o${i + 1}`);
  return {
    id,
    position: 'step',
    prompt,
    correctId: ids[correct],
    options: options.map(([text, feedback], i) => ({ id: ids[i], text, feedback })),
  };
}

const explain = (id: string, title: string, text: string, illustration?: Illustration, widget?: 'nodes'): LessonStep =>
  newStep({ id, action: 'explain', title, text, illustration: illustration ?? null, widget: widget ?? null });

const interact = (id: string, text: string, q: Quiz): LessonStep =>
  newStep({ id, action: 'interact', quizId: q.id, text });

const experiment = (id: string, title: string, text: string, spec: ExperimentSpec): LessonStep =>
  newStep({ id, action: 'experiment', title, text, experiment: spec });

/** One placement step per listed piece id, in the given order, then the final circuit check. */
function build(
  board: Piece[],
  order: [string, string][],
  connectText: string,
  options?: LessonStep['options']
): LessonStep[] {
  const byId = new Map(board.map((p) => [p.id, p]));
  const placed = order.map(([pieceId, text]) => {
    const piece = byId.get(pieceId);
    if (!piece) throw new Error(`piece ${pieceId} not on the board`);
    return newStep({
      id: `place-${pieceId}`,
      action: piece.type.startsWith('jumper') ? 'place_connection' : 'place_component',
      pieceId,
      text,
    });
  });
  if (placed.length !== board.length) throw new Error('every piece needs a placement step');
  const connect = connectionStep('connect');
  connect.text = connectText;
  if (options) connect.options = options;
  return [...placed, connect];
}

interface Spec {
  id: string;
  title: string;
  instruction: string;
  kind: 'guided' | 'challenge';
  board?: Piece[];
  start?: Lesson['start'];
  steps?: LessonStep[];
  quizzes?: Quiz[];
  settings?: LessonSettings;
  notes: string;
  tags: string[];
}

function lesson(s: Spec): Lesson {
  // Step ids and quiz ids stay unique across the whole curriculum, so progress and answers never collide.
  const scope = (id: string) => `${s.id}.${id}`;
  const steps = (s.steps ?? []).map((st) => ({ ...st, id: scope(st.id), quizId: st.quizId ? scope(st.quizId) : null }));
  const quizzes = (s.quizzes ?? []).map((q) => ({
    ...q,
    id: scope(q.id),
    correctId: scope(q.correctId),
    options: q.options.map((o) => ({ ...o, id: scope(o.id) })),
  }));
  return {
    version: LESSON_VERSION,
    id: s.id,
    title: s.title,
    instruction: s.instruction,
    kind: s.kind,
    board: { cols: 11, rows: 12, pieces: s.board ?? [] },
    steps,
    timeLimitS: null,
    quizzes,
    updatedAt: SEED_DATE,
    ...(s.start ? { start: s.start } : {}),
    ...(s.settings ? { settings: s.settings } : {}),
    teacherNotes: s.notes,
    tags: ['currículo', ...s.tags],
  };
}

const SIM =
  'Simulação: as correntes, o brilho, o som e o LED de status são calculados pelo software; nada é medido na bancada física nem lido pela câmera.';
const KIT = (...types: Piece['type'][]) => types;

// --- Lesson 1 ------------------------------------------------------------------------------------

const L01_NOTES = `Objetivo: reconhecer a bancada e entender que cada coluna tem DOIS nós (A em cima, B embaixo) separados pela abertura central.
Como saber que deu certo: a cápsula da bateria encaixada, confirmada pelo LED de status da própria bancada.
${SIM} O LED de status é desenhado na tela quando há uma bateria encaixada; a lição não afirma que o LED físico foi lido.
A versão guiada tem explicações, o explorador de nós e duas perguntas; o desafio não mostra instrução.`;

function lesson01(): Lesson[] {
  const board = circuitL01();
  const q1 = quiz(
    'q-nos',
    'Os furos A5 e B5 (mesma coluna, um em cada banco) estão ligados entre si?',
    [
      [
        'Sim, porque são da mesma coluna 5.',
        'Quase! Mas a abertura central corta a coluna ao meio: A5 e B5 são dois nós diferentes.',
      ],
      ['Não. A abertura central separa o nó A5 do nó B5.', 'Isso! Cada coluna tem dois nós, um em cada banco.'],
      [
        'Só quando tem uma peça no meio.',
        'Não é a peça que liga: dentro de um banco os 6 furos já são o mesmo nó; entre bancos não há ligação.',
      ],
    ],
    1
  );
  const q2 = quiz(
    'q-led',
    'O LED de status acendeu. O que ele está dizendo?',
    [
      [
        'Que a bancada reconheceu a bateria encaixada.',
        'Exato! Ele só confirma a bateria — ainda não existe nenhum circuito para acender.',
      ],
      [
        'Que o circuito está pronto e funcionando.',
        'Ainda não: você só colocou a bateria. Nas próximas lições você fecha circuitos de verdade.',
      ],
      [
        'Que o LED vermelho do kit está aceso.',
        'Esse LED está embutido na bancada; ele não faz parte das peças que você monta.',
      ],
    ],
    0
  );
  const guided = lesson({
    id: `${SEED_PREFIX}01-guiada`,
    title: 'Lição 1 — Conhecendo a bancada (guiada)',
    instruction: 'Vamos conhecer a bancada, encaixar a bateria e descobrir o que é um nó.',
    kind: 'guided',
    board,
    steps: [
      explain(
        'e-bancada',
        'Sua bancada de eletrônica',
        'À esquerda fica a bandeja com as peças. No meio fica a bancada, onde você encaixa as peças nos furos. A bancada também tem um LED de status embutido e uma tela que explica o que acontece.\n\nVocê não monta nada com fios soltos: as peças e os jumpers (fios curtinhos) se encaixam nos furos.',
        artWorkbench()
      ),
      explain(
        'e-nos',
        'Furos ligados: o que é um nó?',
        'Dentro da bancada, os 6 furos de uma mesma linha vertical já estão ligados entre si. Chamamos esse conjunto de nó: tudo que está num nó tem a mesma ligação elétrica.\n\nA abertura no meio da bancada corta cada coluna em duas. Por isso cada coluna tem DOIS nós: um em cima (banco A) e um embaixo (banco B). Toque nos furos abaixo e veja.',
        artNodes(),
        'nodes'
      ),
      interact('i-nos', 'Pense no que você acabou de ver e responda.', q1),
      ...build(
        board,
        [
          [
            'bat',
            'Arraste a bateria da bandeja para a bancada. Os dois lados dela (+ e −) ficam em colunas diferentes.',
          ],
        ],
        'Confira: a bateria está encaixada na bancada.'
      ),
      experiment(
        'x-status',
        'Olhe o LED de status',
        'Observe o LED de status da bancada. Ele diz se a bateria foi reconhecida.',
        {
          goals: [
            { id: 'status', label: 'Veja o LED de status acender (a bateria foi reconhecida).', now: ['status_led'] },
          ],
        }
      ),
      interact('i-led', 'Para fechar: o que o LED de status mostrou?', q2),
    ],
    quizzes: [q1, q2],
    settings: { statusLed: true, tray: KIT('bateria') },
    notes: L01_NOTES,
    tags: ['guiada', 'explicação', 'nós', 'exemplo'],
  });
  const challenge = lesson({
    id: `${SEED_PREFIX}01-desafio`,
    title: 'Lição 1 — Conhecendo a bancada (desafio)',
    instruction: '',
    kind: 'challenge',
    board,
    settings: { statusLed: true, tray: KIT('bateria') },
    notes: `${L01_NOTES}\nDesafio: bancada vazia, bateria solta na bandeja e nenhuma instrução na tela (o campo de instrução fica vazio de propósito).`,
    tags: ['desafio', 'sem instruções', 'exemplo'],
  });
  return [guided, challenge];
}

// --- Lesson 2 ------------------------------------------------------------------------------------

const L02_NOTES = `Objetivo: o primeiro circuito fechado — a corrente só passa em um caminho completo do + ao −.
Como saber que deu certo: ao clicar em “Energizar” o LED acende e a tela mostra “circuito fechado ✓”.
Simplificação didática: sem resistor nesta lição; o resistor entra na lição 3. A tela avisa que a bancada está limitando a corrente; com um LED real, sem resistor, ele poderia queimar.
${SIM}
O circuito foi refeito para a bancada de 5 V.`;

function lesson02(): Lesson[] {
  const board = circuitL02();
  const qFio = quiz(
    'q-fio',
    'Você tirou um jumper e a luz apagou. Por quê?',
    [
      ['A bateria acabou.', 'A bateria continua boa — repare que ao recolocar o fio a luz volta.'],
      [
        'O caminho ficou aberto: a corrente não consegue voltar ao −.',
        'Isso! Sem caminho fechado do + ao −, não há corrente.',
      ],
      ['O LED queimou.', 'O LED está bem: ele só precisa de um caminho completo para acender.'],
    ],
    1
  );
  const guided = lesson({
    id: `${SEED_PREFIX}02-guiada`,
    title: 'Lição 2 — O primeiro circuito fechado (guiada)',
    instruction: 'Ligue a bateria a um LED com dois jumpers e acenda a luz.',
    kind: 'guided',
    board,
    steps: [
      explain(
        'e-loop',
        'A corrente anda em círculo',
        'Para o LED acender, a corrente sai do + da bateria, passa pelo LED e volta ao − da bateria. Se o caminho tiver um buraco, a corrente para.\n\nNesta lição vamos fazer só isso: bateria + LED + dois jumpers. (Atenção: só aqui o resistor fica de fora. Na próxima lição você vai descobrir por que ele é importante.)',
        artLoop(false)
      ),
      ...build(
        board,
        [
          ['bat', 'Coloque a bateria na bancada.'],
          ['led', 'Coloque o LED. O lado da barra é o −.'],
          ['w1', 'Use um jumper para ligar o + da bateria ao lado “+” do LED.'],
          ['w2', 'Use outro jumper para ligar o lado “−” do LED de volta ao − da bateria.'],
        ],
        'Agora confira o circuito inteiro e clique em Energizar para ver o LED acender.'
      ),
      experiment(
        'x-fecha',
        'Feche o circuito e veja a luz',
        'Clique em Energizar. Depois, tire um jumper (arraste para fora), energize de novo e veja o que muda.',
        {
          goals: [
            { id: 'lit', label: 'Energize e veja o LED acender com “circuito fechado ✓”.', seen: ['lit'] },
            { id: 'open', label: 'Tire um jumper e veja a luz apagar.', seen: ['energized'], now: ['dark'] },
          ],
        }
      ),
      interact('i-fio', 'Por que a luz apagou quando você tirou o fio?', qFio),
    ],
    quizzes: [qFio],
    settings: {
      requireLit: true,
      allowNoResistor: true,
      tray: KIT('bateria', 'led', 'jumper_curto', 'jumper_longo', 'jumper_3'),
    },
    notes: L02_NOTES,
    tags: ['guiada', 'circuito fechado', 'experimento', 'exemplo'],
  });
  const challenge = lesson({
    id: `${SEED_PREFIX}02-desafio`,
    title: 'Lição 2 — O primeiro circuito fechado (desafio)',
    instruction: 'O circuito está montado, mas a luz não acende. Descubra o que está desconectado e conserte.',
    kind: 'challenge',
    board,
    start: { pieces: board, removeOneOf: ['w1', 'w2'] },
    settings: {
      requireLit: true,
      allowNoResistor: true,
      hintAfter: 2,
      tray: KIT('bateria', 'led', 'jumper_curto', 'jumper_longo', 'jumper_3'),
    },
    notes: `${L02_NOTES}\nDesafio: o circuito começa montado, mas SEM um dos jumpers; a bancada sorteia qual (a cada vez). A dica só aparece depois que o aluno erra duas vezes seguidas, seja qual for o erro.`,
    tags: ['desafio', 'bancada com defeito', 'exemplo'],
  });
  return [guided, challenge];
}

// --- Lesson 3 ------------------------------------------------------------------------------------

const L03_NOTES = `Objetivo: o resistor protege o LED limitando a corrente; ler a corrente em mA no amperímetro.
Como saber que deu certo: LED aceso e a tela do amperímetro mostrando a corrente em mA, com a unidade explicada.
Observação: o amperímetro é a cápsula que mostra o valor em mA; ela entra em série no circuito, no encaixe E2 (o único em que ela funciona). O resistor sugerido é 470 Ω.
${SIM} A corrente vem de (5 V − 2 V do LED) ÷ resistência total (inclui 10 Ω do amperímetro).
Desafio: o kit só tem resistores de 220 Ω, 470 Ω e 1 kΩ; o aluno compara 220 Ω e 1 kΩ trocando-os pelos botões do experimento.`;

function lesson03(): Lesson[] {
  const board = circuitL03();
  const qUnit = quiz(
    'q-ma',
    'A tela do amperímetro mostra um valor perto de “6 mA”. O que isso quer dizer?',
    [
      ['Passam cerca de 6 milésimos de ampère de corrente pelo circuito.', 'Isso! mA é miliampère: 1 mA = 0,001 A.'],
      ['A bateria tem 6 mil volts.', 'Volt é outra grandeza (a “força” que empurra a corrente). mA mede a corrente.'],
      ['O resistor vale 6 ohms.', 'Ohm mede resistência; mA mede quanta corrente passa.'],
    ],
    0
  );
  const qMais = quiz(
    'q-mais',
    'Se trocarmos o resistor por um MAIOR, a corrente será…',
    [
      ['Maior, e o LED fica mais forte.', 'Ao contrário: mais resistência atrapalha a passagem.'],
      ['Menor, e o LED fica mais fraco.', 'Isso! O resistor “segura” a corrente — por isso protege o LED.'],
      ['A mesma.', 'Não: a corrente depende da resistência. Faça a conta (5 V − 2 V) ÷ resistência.'],
    ],
    1
  );
  const guided = lesson({
    id: `${SEED_PREFIX}03-guiada`,
    title: 'Lição 3 — Limitando a corrente: o resistor (guiada)',
    instruction: 'Monte o circuito com resistor e leia a corrente no amperímetro.',
    kind: 'guided',
    board,
    steps: [
      explain(
        'e-res',
        'Por que o LED precisa de um resistor?',
        'Um LED deixa passar quase toda a corrente que a bateria empurrar — e demais pode queimá-lo. O resistor funciona como um “estreitamento” no caminho: quanto maior o valor (em ohms, Ω), menos corrente passa.\n\nO valor está escrito em faixas coloridas. Este resistor tem as faixas amarelo · violeta · marrom, que valem 470 Ω.',
        artResistorBands(470)
      ),
      ...build(
        board,
        [
          ['bat', 'Coloque a bateria na bancada.'],
          ['res', 'Coloque o resistor de 470 Ω (faixas amarelo, violeta, marrom).'],
          ['led', 'Coloque o LED, depois do resistor.'],
          [
            'amp',
            'Encaixe o amperímetro no encaixe E2 (o tracejado marcado “A”). Ele mede a corrente que passa por ele.',
          ],
          ['w1', 'Jumper do + da bateria até o resistor.'],
          ['w2', 'Jumper do amperímetro de volta ao − da bateria.'],
        ],
        'Conecte tudo, confira o circuito e clique em Energizar.',
        { matchValues: true, strictPositions: false }
      ),
      experiment(
        'x-ma',
        'Leia a corrente',
        'Energize e olhe a tela do amperímetro: ela mostra quantos mA passam pelo LED.',
        {
          goals: [
            { id: 'lit', label: 'Energize: o LED acende e o amperímetro mostra a corrente em mA.', seen: ['lit'] },
          ],
        }
      ),
      interact('i-ma', 'Agora que você viu o número…', qUnit),
      interact('i-mais', 'Pense na conta: corrente = (5 V − 2 V do LED) ÷ resistência.', qMais),
    ],
    quizzes: [qUnit, qMais],
    settings: {
      requireLit: true,
      tray: KIT('bateria', 'resistor_470', 'led', 'capsula_amperimetro', 'jumper_longo', 'jumper_4'),
    },
    notes: L03_NOTES,
    tags: ['guiada', 'resistor', 'telas inteligentes', 'unidades', 'exemplo'],
  });
  const r220 = circuitL03('resistor_220');
  const r1k = circuitL03('resistor_1k');
  const qPred = quiz(
    'q-pred',
    'Antes de testar: qual resistor deixa o LED MAIS FRACO, o de 220 Ω ou o de 1 kΩ?',
    [
      ['O de 220 Ω.', 'Pense de novo: resistor menor deixa passar mais corrente.'],
      ['O de 1 kΩ (1000 Ω).', 'Boa previsão! Mais resistência, menos corrente. Agora teste para conferir.'],
      ['Os dois deixam igual.', 'Se fosse igual, o resistor não serviria para nada. Teste e compare!'],
    ],
    1
  );
  const qObs = quiz(
    'q-obs',
    'Depois de testar os dois: qual deixou o LED mais fraco?',
    [
      ['220 Ω', 'Olhe os mA no amperímetro: 220 Ω deixou passar mais corrente e o LED ficou mais forte.'],
      ['1 kΩ', 'Isso! 1 kΩ deixou passar menos corrente — sua previsão estava certa se você escolheu isso antes.'],
    ],
    1
  );
  const challenge = lesson({
    id: `${SEED_PREFIX}03-desafio`,
    title: 'Lição 3 — Limitando a corrente: o resistor (desafio)',
    instruction: 'Preveja, teste e confirme: qual resistor deixa o LED mais fraco?',
    kind: 'challenge',
    board: r220,
    start: { pieces: r220 },
    steps: [
      interact('i-pred', 'Faça sua previsão antes de mexer na bancada.', qPred),
      experiment(
        'x-troca',
        'Teste os dois resistores no mesmo ponto',
        'Energize com cada resistor e compare o brilho e os mA do amperímetro.',
        {
          board: r220,
          presets: [
            { label: 'Usar resistor de 220 Ω', pieces: r220 },
            { label: 'Usar resistor de 1 kΩ', pieces: r1k },
          ],
          goals: [
            { id: 'both', label: 'Veja o LED funcionando com os DOIS resistores (troque e energize).', presetsLit: 2 },
          ],
        }
      ),
      interact('i-obs', 'Confira sua previsão com o que você observou.', qObs),
    ],
    quizzes: [qPred, qObs],
    notes: L03_NOTES,
    tags: ['desafio', 'previsão', 'comparação', 'experimento', 'exemplo'],
  });
  return [guided, challenge];
}

// --- Lesson 4 ------------------------------------------------------------------------------------

const L04_NOTES = `Objetivo: o LED só acende em um sentido (polaridade).
Como saber que deu certo: o aluno testa os dois sentidos e identifica qual funciona ANTES de o tutor dar o nome “polaridade”; no desafio, o LED vem invertido sem aviso e o aluno o gira clicando na peça.
${SIM}`;

function lesson04(): Lesson[] {
  const board = circuitL04();
  const qWhich = quiz(
    'q-sentido',
    'Em qual posição o LED acendeu?',
    [
      [
        'Quando a barra do LED fica do lado do − da bateria.',
        'Isso! O triângulo aponta do + para o −, e a barra marca o lado do −.',
      ],
      [
        'Quando a barra fica do lado do +.',
        'Nessa posição o LED ficou apagado (você viu “reversed” na bancada). Teste de novo.',
      ],
      ['Nas duas posições.', 'O LED só acende em uma delas. Gire a peça e compare.'],
    ],
    0
  );
  const guided = lesson({
    id: `${SEED_PREFIX}04-guiada`,
    title: 'Lição 4 — Sentido da corrente: o LED (guiada)',
    instruction: 'Monte o circuito e descubra se o LED liga nos dois sentidos.',
    kind: 'guided',
    board,
    steps: [
      explain(
        'e-intro',
        'Será que o LED tem um lado certo?',
        'Você já acendeu um LED. Agora vai fazer um teste: monte o circuito de novo e depois gire o LED (clicando nele) para ver o que acontece nas duas posições. Escreva mentalmente o que você observa — depois eu explico o nome disso.'
      ),
      ...build(
        board,
        [
          ['bat', 'Coloque a bateria.'],
          ['res', 'Coloque o resistor de 470 Ω.'],
          ['led', 'Coloque o LED.'],
          ['w1', 'Jumper do + da bateria ao resistor.'],
          ['w2', 'Jumper do LED de volta ao − da bateria.'],
        ],
        'Confira o circuito.'
      ),
      experiment(
        'x-gira',
        'Teste os dois sentidos',
        'Energize, depois clique no LED para girá-lo e energize de novo. Compare.',
        {
          goals: [
            { id: 'acende', label: 'Veja o LED acender em uma posição.', seen: ['lit'] },
            { id: 'apaga', label: 'Gire o LED e veja que, ao contrário, ele fica apagado.', seen: ['reversed_dark'] },
          ],
        }
      ),
      interact('i-sentido', 'Conte o que você observou.', qWhich),
      explain(
        'e-pol',
        'O nome disso: polaridade',
        'Você descobriu a polaridade: o LED é uma via de mão única. A corrente entra pelo anodo (+) e sai pelo catodo (−). Ligado ao contrário, ele bloqueia e não acende — e isso protege o LED.\n\nMuitas peças têm polaridade: a bateria, o LED e, em geral, o capacitor.',
        artLedPolarity()
      ),
    ],
    quizzes: [qWhich],
    settings: { requireLit: true, tray: KIT('bateria', 'resistor_470', 'led', 'jumper_longo', 'jumper_3') },
    notes: L04_NOTES,
    tags: ['guiada', 'polaridade', 'experimento', 'exemplo'],
  });
  const reversed = withPiece(board, 'led', { a: 5, b: 4 });
  const challenge = lesson({
    id: `${SEED_PREFIX}04-desafio`,
    title: 'Lição 4 — Sentido da corrente: o LED (desafio)',
    instruction: 'O circuito está montado, mas o LED não acende. Descubra por quê e conserte.',
    kind: 'challenge',
    board,
    start: { pieces: reversed },
    settings: {
      requireLit: true,
      hintAfter: 2,
      tray: KIT('bateria', 'resistor_470', 'led', 'jumper_longo', 'jumper_3'),
    },
    notes: `${L04_NOTES}\nDesafio: o LED começa invertido, sem aviso. A dica só vem depois de dois erros iguais seguidos.`,
    tags: ['desafio', 'bancada com defeito', 'polaridade', 'exemplo'],
  });
  return [guided, challenge];
}

// --- Lesson 5 ------------------------------------------------------------------------------------

const L05_NOTES = `Objetivo: o botão fecha o circuito só enquanto está apertado; dois botões em série exigem os dois apertados (sem usar o termo “série”).
Como saber que deu certo: guiada — o LED acende só enquanto o botão está apertado, confirmado em pergunta; desafio — dois botões, o LED só acende com os dois apertados e o circuito montado confere com o esperado.
${SIM} Na tela o botão pode ser segurado com o mouse/dedo ou travado pelos controles “Botão A/B” (necessário para apertar dois ao mesmo tempo).`;

function lesson05(): Lesson[] {
  const board = circuitL05();
  const qWhen = quiz(
    'q-quando',
    'Quando o LED acendeu?',
    [
      ['Só enquanto eu apertava o botão.', 'Isso! O botão é uma ponte que só fecha o caminho enquanto está apertado.'],
      ['O tempo todo, o botão não faz diferença.', 'Observe de novo: ao soltar, a luz apagou.'],
      ['Só depois de soltar o botão.', 'Foi ao contrário: acendeu apertado e apagou solto.'],
    ],
    0
  );
  const guided = lesson({
    id: `${SEED_PREFIX}05-guiada`,
    title: 'Lição 5 — Controlando com o botão (guiada)',
    instruction: 'Coloque um botão no circuito e comande o LED.',
    kind: 'guided',
    board,
    steps: [
      explain(
        'e-botao',
        'O botão é uma ponte',
        'Um botão é um interruptor: solto, ele deixa um buraco no caminho e nada passa; apertado, ele fecha o caminho e a corrente passa. Ele fica no meio do circuito, junto com o resistor e o LED.',
        artButton()
      ),
      ...build(
        board,
        [
          ['bat', 'Coloque a bateria.'],
          ['res', 'Coloque o resistor de 470 Ω.'],
          ['led', 'Coloque o LED.'],
          ['btn', 'Coloque o botão depois do LED.'],
          ['w1', 'Jumper do + da bateria ao resistor.'],
          ['w2', 'Jumper do botão de volta ao − da bateria.'],
        ],
        'Confira o circuito.'
      ),
      experiment(
        'x-aperta',
        'Aperte e solte',
        'Energize. Segure o botão (ou use os controles abaixo da bancada) e depois solte.',
        {
          goals: [
            { id: 'ap', label: 'Aperte o botão e veja o LED acender.', seen: ['pressed_lit'] },
            { id: 'so', label: 'Solte o botão e veja o LED apagar.', seen: ['released_dark'] },
          ],
        }
      ),
      interact('i-quando', 'Confirme o que você viu.', qWhen),
    ],
    quizzes: [qWhen],
    settings: { tray: KIT('bateria', 'resistor_470', 'led', 'botao', 'jumper_longo', 'jumper_4') },
    notes: L05_NOTES,
    tags: ['guiada', 'botão', 'experimento', 'exemplo'],
  });
  const chBoard = circuitL05Challenge();
  const qBoth = quiz(
    'q-ambos',
    'Com dois botões na montagem, quando o LED acende?',
    [
      [
        'Só quando os dois estão apertados ao mesmo tempo.',
        'Isso! Os dois botões estão no mesmo caminho: se um abre, o caminho todo abre.',
      ],
      ['Quando qualquer um dos dois está apertado.', 'Observe: com só um apertado o LED continuou apagado.'],
      ['Só quando nenhum está apertado.', 'Ao contrário: apertados, eles fecham o caminho.'],
    ],
    0
  );
  const challenge = lesson({
    id: `${SEED_PREFIX}05-desafio`,
    title: 'Lição 5 — Controlando com o botão (desafio)',
    instruction:
      'Na bandeja há uma bateria, um resistor, um LED e DOIS botões. Monte um circuito em que o LED só acenda com os dois botões apertados ao mesmo tempo.',
    kind: 'challenge',
    board: chBoard,
    steps: [
      experiment(
        'x-dois',
        'Teste os botões',
        'Energize. Aperte um botão só; depois os dois juntos (use os controles Botão A e B para segurar os dois).',
        {
          goals: [
            { id: 'um', label: 'Aperte só um botão: o LED fica apagado.', seen: ['partial_dark'] },
            { id: 'dois', label: 'Aperte os dois ao mesmo tempo: o LED acende.', seen: ['pressed_lit'] },
          ],
        }
      ),
      interact('i-ambos', 'Confirme o comportamento.', qBoth),
    ],
    quizzes: [qBoth],
    settings: {
      tray: KIT('bateria', 'resistor_470', 'led', 'botao', 'jumper_longo', 'jumper_3', 'jumper_4', 'jumper_5'),
    },
    notes: L05_NOTES,
    tags: ['desafio', 'dois botões', 'montagem livre', 'experimento', 'exemplo'],
  });
  return [guided, challenge];
}

// --- Lesson 6 ------------------------------------------------------------------------------------

const L06_NOTES = `Objetivo: a resistência pode variar de forma contínua; o potenciômetro regula o brilho sem degraus.
Como saber que deu certo: guiada — o brilho muda em tempo real ao girar, sem degraus perceptíveis, confirmado em pergunta; desafio — prever para que lado girar para escurecer e conferir varrendo todo o curso.
${SIM} O botão giratório é um controle deslizante contínuo entre 220 Ω e 10 kΩ (a bancada limita a corrente em 15 mA, por isso o mínimo é 220 Ω).`;

function lesson06(): Lesson[] {
  const board = circuitL06();
  const qGradual = quiz(
    'q-gradual',
    'Quando você girou o botão, o brilho mudou…',
    [
      ['Aos pulos, em poucos degraus.', 'Passe o controle devagar: o brilho muda aos poucos, sem pulos.'],
      ['Aos poucos e continuamente.', 'Isso! O potenciômetro varia a resistência de forma contínua.'],
      ['Não mudou.', 'Gire de ponta a ponta com o LED aceso e observe o brilho.'],
    ],
    1
  );
  const guided = lesson({
    id: `${SEED_PREFIX}06-guiada`,
    title: 'Lição 6 — Controle proporcional: o potenciômetro (guiada)',
    instruction: 'Troque o resistor fixo por um que você pode girar.',
    kind: 'guided',
    board,
    steps: [
      explain(
        'e-pot',
        'Um resistor que gira',
        'O potenciômetro é um resistor que você regula com um botão giratório. Girando para um lado a resistência aumenta e a corrente diminui; para o outro, acontece o contrário. Diferente dos resistores fixos, ele tem infinitos valores entre o mínimo e o máximo.',
        artPot()
      ),
      ...build(
        board,
        [
          ['bat', 'Coloque a bateria.'],
          ['pot', 'Coloque o potenciômetro.'],
          ['led', 'Coloque o LED.'],
          ['w1', 'Jumper do + da bateria ao potenciômetro.'],
          ['w2', 'Jumper do LED de volta ao − da bateria.'],
        ],
        'Confira o circuito.'
      ),
      experiment(
        'x-gira',
        'Gire o botão',
        'Energize e arraste o controle de uma ponta à outra. Observe o brilho em tempo real.',
        {
          slider: { pieceId: 'pot', label: 'Resistência do potenciômetro' },
          goals: [
            { id: 'lit', label: 'Energize e veja o LED acender.', seen: ['lit'] },
            { id: 'baixo', label: 'Leve o controle até o lado de MENOS resistência.', seen: ['pot_low'] },
            { id: 'alto', label: 'Leve o controle até o lado de MAIS resistência.', seen: ['pot_high'] },
          ],
        }
      ),
      interact('i-gradual', 'Responda sobre o que viu.', qGradual),
    ],
    quizzes: [qGradual],
    settings: { tray: KIT('bateria', 'potenciometro', 'led', 'jumper_longo', 'jumper_4') },
    notes: L06_NOTES,
    tags: ['guiada', 'potenciômetro', 'experimento', 'exemplo'],
  });
  const qPred = quiz(
    'q-pred',
    'Antes de girar: para deixar o LED mais fraco, o controle deve ir para o lado de…',
    [
      ['mais resistência.', 'Boa previsão! Mais resistência → menos corrente → LED mais fraco. Agora confira!'],
      ['menos resistência.', 'Pense de novo: menos resistência deixa passar mais corrente.'],
    ],
    0
  );
  const qObs = quiz(
    'q-obs',
    'Depois de varrer o controle: o LED ficou mais fraco no lado de…',
    [
      ['mais resistência.', 'Isso! Compare com a sua previsão: bateu?'],
      ['menos resistência.', 'Olhe de novo: no lado de menos resistência o LED ficou mais forte.'],
    ],
    0
  );
  const challenge = lesson({
    id: `${SEED_PREFIX}06-desafio`,
    title: 'Lição 6 — Controle proporcional: o potenciômetro (desafio)',
    instruction:
      'O circuito já está montado. Preveja para que lado girar para o LED ficar mais fraco e depois confira.',
    kind: 'challenge',
    board,
    start: { pieces: board },
    steps: [
      interact('i-pred', 'Faça sua previsão antes de girar.', qPred),
      experiment('x-varre', 'Varra o potenciômetro', 'Energize e leve o controle de uma ponta à outra.', {
        board,
        slider: { pieceId: 'pot', label: 'Resistência do potenciômetro' },
        goals: [
          { id: 'lit', label: 'Energize e veja o LED acender.', seen: ['lit'] },
          { id: 'baixo', label: 'Passe pelo lado de MENOS resistência.', seen: ['pot_low'] },
          { id: 'alto', label: 'Passe pelo lado de MAIS resistência.', seen: ['pot_high'] },
        ],
      }),
      interact('i-obs', 'Confira com o que você viu.', qObs),
    ],
    quizzes: [qPred, qObs],
    notes: L06_NOTES,
    tags: ['desafio', 'previsão', 'experimento', 'exemplo'],
  });
  return [guided, challenge];
}

// --- Lesson 7 ------------------------------------------------------------------------------------

const L07_NOTES = `Objetivo: o capacitor guarda energia, então o LED apaga aos poucos (não de repente) quando a fonte é desligada.
Como saber que deu certo: guiada — o LED apaga gradualmente ao desligar; desafio — prever se o LED apaga mais rápido ou mais devagar com o capacitor maior e confirmar.
Montagem: o capacitor fica ligado entre as colunas do + e do − da fonte e esvazia pelo resistor e pelo LED (τ = R·C ≈ 0,5 s). Ligado só em paralelo com o LED, o brilho sumiria em poucos milissegundos e não daria para ver.
Limite do kit: há apenas capacitores de 1000 µF (até 2). “Dois capacitores de valores diferentes” vira 1 capacitor (1000 µF) contra 2 em paralelo (2000 µF).
${SIM} A descarga é um modelo exponencial; nenhum tempo foi medido na bancada.`;

function lesson07(): Lesson[] {
  const board = circuitL07(1);
  const qFade = quiz(
    'q-apaga',
    'Ao desligar a fonte, o LED…',
    [
      ['Apagou na hora.', 'Observe de novo: com o capacitor ele foi apagando devagar.'],
      ['Foi apagando aos poucos.', 'Isso! O capacitor devolveu a energia que tinha guardado.'],
      ['Ficou aceso para sempre.', 'A energia guardada é pequena e acaba — a luz some depois de um tempo.'],
    ],
    1
  );
  const guided = lesson({
    id: `${SEED_PREFIX}07-guiada`,
    title: 'Lição 7 — Guardando energia: o capacitor (guiada)',
    instruction: 'Coloque um capacitor no circuito e veja o que acontece quando a fonte é desligada.',
    kind: 'guided',
    board,
    steps: [
      explain(
        'e-cap',
        'Um tanque de energia elétrica',
        'Um capacitor é como um pequeno tanque: enquanto a bateria está ligada ele se enche de energia. Quando você desliga a fonte, ele esvazia pelo caminho que encontrar — aqui, pelo resistor e pelo LED.\n\nPreste atenção: o que você vai ver na luz depois de desligar?',
        artCapacitor()
      ),
      ...build(
        board,
        [
          ['bat', 'Coloque a bateria.'],
          ['res', 'Coloque o resistor de 470 Ω.'],
          ['led', 'Coloque o LED.'],
          ['cap1', 'Coloque o capacitor ligado entre as colunas do + e do −. Atenção: um capacitor como este tem lado — a faixa marca o −. Na bancada, ligá-lo ao contrário pode danificá-lo (aqui a tela não simula esse defeito).'],
          ['w1', 'Jumper do + da bateria ao resistor.'],
          ['w2', 'Jumper do LED de volta ao − da bateria.'],
        ],
        'Confira o circuito.'
      ),
      experiment(
        'x-descarga',
        'Ligue e desligue',
        'Energize, espere o LED estabilizar e então clique em Desligar. Observe a luz.',
        {
          goals: [
            { id: 'lit', label: 'Energize e veja o LED aceso.', seen: ['lit'] },
            { id: 'fade', label: 'Desligue e veja o LED apagar aos poucos até sumir.', seen: ['faded'] },
          ],
        }
      ),
      interact('i-apaga', 'O que você observou ao desligar?', qFade),
    ],
    quizzes: [qFade],
    settings: { tray: KIT('bateria', 'resistor_470', 'led', 'capacitor', 'jumper_longo', 'jumper_3') },
    notes: L07_NOTES,
    tags: ['guiada', 'capacitor', 'experimento', 'tempo', 'exemplo'],
  });
  const one = circuitL07(1);
  const two = circuitL07(2);
  const qPred = quiz(
    'q-pred',
    'Antes de testar: com o capacitor MAIOR (2 em paralelo = 2000 µF), o LED vai apagar…',
    [
      ['mais rápido.', 'Pense: um tanque maior guarda mais energia, então dura mais.'],
      ['mais devagar.', 'Boa previsão! Mais capacidade = mais energia guardada = apaga mais devagar. Agora teste.'],
      ['no mesmo tempo.', 'Se fosse igual, o tamanho do capacitor não importaria. Teste e compare!'],
    ],
    1
  );
  const qObs = quiz(
    'q-obs',
    'Depois de testar: com 2000 µF o LED levou…',
    [
      ['mais tempo para apagar do que com 1000 µF.', 'Isso! Compare os segundos mostrados abaixo da bancada.'],
      ['menos tempo para apagar.', 'Veja o “Última descarga” de cada teste: com 2000 µF o tempo é maior.'],
    ],
    0
  );
  const challenge = lesson({
    id: `${SEED_PREFIX}07-desafio`,
    title: 'Lição 7 — Guardando energia: o capacitor (desafio)',
    instruction: 'Preveja se o LED apaga mais rápido ou mais devagar com um capacitor maior e depois confirme.',
    kind: 'challenge',
    board: one,
    start: { pieces: one },
    steps: [
      interact('i-pred', 'Faça sua previsão antes do teste.', qPred),
      experiment(
        'x-compara',
        'Compare os capacitores',
        'Para cada opção: energize, depois desligue e observe quanto tempo o LED leva para apagar.',
        {
          board: one,
          presets: [
            { label: '1 capacitor (1000 µF)', pieces: one },
            { label: '2 capacitores em paralelo (2000 µF)', pieces: two },
          ],
          goals: [
            { id: 'lit', label: 'Energize com cada opção.', presetsLit: 2 },
            { id: 'fade', label: 'Desligue e espere o LED apagar com cada opção.', presetsFaded: 2 },
          ],
        }
      ),
      interact('i-obs', 'Confira sua previsão.', qObs),
    ],
    quizzes: [qPred, qObs],
    notes: L07_NOTES,
    tags: ['desafio', 'previsão', 'comparação', 'tempo', 'exemplo'],
  });
  return [guided, challenge];
}

// --- Lesson 8 ------------------------------------------------------------------------------------

const L08_NOTES = `Objetivo: relacionar o valor do resistor ao som do buzzer (força/altura).
Como saber que deu certo: guiada — o buzzer soa e o aluno percebe a diferença ao trocar o resistor; desafio — dois clipes de áudio com resistores diferentes e o aluno diz qual é o maior.
Limitações documentadas: (1) Não existem gravações do buzzer real no repositório; os sons são SINTETIZADOS no navegador por um modelo didático (volume proporcional à corrente; altura sobe de 450 Hz com 60 Hz por mA). A resposta de um buzzer físico não foi medida — verifique na bancada antes de afirmar a mesma coisa em aula. (2) O desafio usa dois clipes simulados (A = 1 kΩ, B = 220 Ω), não gravações.
${SIM}
Há duas versões guiadas: resistores fixos (220/470/1k) e potenciômetro.`;

function lesson08(): Lesson[] {
  const board = circuitL08();
  const qSom = quiz(
    'q-som',
    'Na simulação, com um resistor MAIOR o buzzer ficou…',
    [
      [
        'Mais fraco e mais grave.',
        'Isso! Mais resistência → menos corrente → som menor e mais grave (neste modelo simulado).',
      ],
      ['Mais forte e mais agudo.', 'Ao contrário: resistor maior segura a corrente.'],
      ['Igual.', 'Troque entre 220 Ω e 1 kΩ e escute de novo.'],
    ],
    0
  );
  const presets = (['resistor_220', 'resistor_470', 'resistor_1k'] as const).map((type, i) => ({
    label: `Resistor de ${['220 Ω', '470 Ω', '1 kΩ'][i]}`,
    pieces: circuitL08(type),
  }));
  const guided = lesson({
    id: `${SEED_PREFIX}08-guiada`,
    title: 'Lição 8 — Gerando som: o buzzer (guiada)',
    instruction: 'Monte um buzzer com resistor e descubra como o valor do resistor muda o som.',
    kind: 'guided',
    board,
    steps: [
      explain(
        'e-buz',
        'O resistor também controla o som',
        'O buzzer é uma peça que faz barulho quando passa corrente por ele. Quanto mais corrente, “mais forte” ele trabalha. O resistor limita essa corrente, então o valor dele muda o som.\n\nAtenção: o som que você escuta aqui é uma simulação feita pelo computador, para ensinar a ideia.',
        artBuzzer()
      ),
      ...build(
        board,
        [
          ['bat', 'Coloque a bateria.'],
          ['res', 'Coloque o resistor.'],
          ['buz', 'Coloque o buzzer.'],
          ['w1', 'Jumper do + da bateria ao resistor.'],
          ['w2', 'Jumper do buzzer de volta ao − da bateria.'],
        ],
        'Confira o circuito.'
      ),
      experiment(
        'x-troca',
        'Troque o resistor e escute',
        'Energize e troque entre os três resistores. Escute a diferença (som simulado).',
        {
          presets,
          goals: [
            { id: 'buz', label: 'Energize e escute o buzzer tocar.', seen: ['buzzed'] },
            { id: 'tres', label: 'Escute com os 3 resistores diferentes.', presetsLit: 3 },
          ],
        }
      ),
      interact('i-som', 'O que você notou?', qSom),
    ],
    quizzes: [qSom],
    settings: {
      tray: KIT('bateria', 'resistor_220', 'resistor_470', 'resistor_1k', 'buzzer', 'jumper_longo', 'jumper_3'),
    },
    notes: L08_NOTES,
    tags: ['guiada', 'buzzer', 'som simulado', 'experimento', 'exemplo'],
  });
  const potBoard = circuitL08Pot();
  const qPot = quiz(
    'q-pot',
    'Girando o potenciômetro para MAIS resistência, o som…',
    [
      [
        'Ficou mais fraco e mais grave (na simulação).',
        'Isso! É o mesmo efeito de trocar por um resistor maior, só que sem degraus.',
      ],
      ['Ficou mais forte.', 'Observe de novo: mais resistência, menos corrente.'],
    ],
    0
  );
  const potVersion = lesson({
    id: `${SEED_PREFIX}08-potenciometro`,
    title: 'Lição 8 — Gerando som: o buzzer (versão com potenciômetro)',
    instruction: 'Use um potenciômetro no lugar do resistor fixo e varie o som continuamente.',
    kind: 'guided',
    board: potBoard,
    steps: [
      explain(
        'e-pot',
        'Do degrau à rampa',
        'Com resistores fixos você troca de valor aos saltos. O potenciômetro permite passar por todos os valores no meio do caminho. O som simulado muda com ele.',
        artPot()
      ),
      ...build(
        potBoard,
        [
          ['bat', 'Coloque a bateria.'],
          ['pot', 'Coloque o potenciômetro.'],
          ['buz', 'Coloque o buzzer.'],
          ['w1', 'Jumper do + da bateria ao potenciômetro.'],
          ['w2', 'Jumper do buzzer de volta ao − da bateria.'],
        ],
        'Confira o circuito.'
      ),
      experiment(
        'x-pot',
        'Varie o som',
        'Energize e arraste o controle devagar de um lado ao outro, escutando o som (simulado).',
        {
          slider: { pieceId: 'pot', label: 'Resistência do potenciômetro' },
          goals: [
            { id: 'buz', label: 'Energize e escute o buzzer.', seen: ['buzzed'] },
            { id: 'baixo', label: 'Leve o controle ao lado de MENOS resistência.', seen: ['pot_low'] },
            { id: 'alto', label: 'Leve o controle ao lado de MAIS resistência.', seen: ['pot_high'] },
          ],
        }
      ),
      interact('i-pot', 'Conte o que escutou.', qPot),
    ],
    quizzes: [qPot],
    settings: { tray: KIT('bateria', 'potenciometro', 'buzzer', 'jumper_longo', 'jumper_4') },
    notes: L08_NOTES,
    tags: ['guiada', 'buzzer', 'potenciômetro', 'som simulado', 'exemplo'],
  });
  const qClip = quiz(
    'q-clipe',
    'Qual clipe foi feito com o resistor MAIOR?',
    [
      ['Clipe A (mais fraco e mais grave).', 'Isso! Mais resistência → menos corrente → som mais fraco e mais grave.'],
      ['Clipe B (mais forte e mais agudo).', 'O Clipe B é o do resistor menor: a corrente é maior.'],
    ],
    0
  );
  const challenge = lesson({
    id: `${SEED_PREFIX}08-desafio`,
    title: 'Lição 8 — Gerando som: o buzzer (desafio)',
    instruction: 'Escute dois clipes sem ver o valor dos resistores e descubra qual tem o resistor maior.',
    kind: 'challenge',
    board,
    start: { pieces: board },
    steps: [
      experiment('x-clipes', 'Escute os dois clipes', 'Toque o clipe A e o clipe B quantas vezes quiser.', {
        clips: { a: 1000, b: 220 },
        goals: [
          { id: 'a', label: 'Escute o Clipe A.', seen: ['heard_a'] },
          { id: 'b', label: 'Escute o Clipe B.', seen: ['heard_b'] },
        ],
      }),
      interact('i-clipe', 'Qual é qual?', qClip),
    ],
    quizzes: [qClip],
    notes: `${L08_NOTES}\nNo desafio os dois clipes são sintetizados pelo software (A = 1 kΩ, B = 220 Ω); ainda não existem gravações do buzzer real.`,
    tags: ['desafio', 'áudio', 'som simulado', 'exemplo'],
  });
  return [guided, potVersion, challenge];
}

// --- Lesson 9 ------------------------------------------------------------------------------------

const L09_NOTES = `Objetivo: reconhecer os dois acidentes mais comuns — curto-circuito e mau contato — e consertá-los antes da criação livre.
Como saber que deu certo: guiada — (1) mau contato: a peça meio encaixada faz o LED piscar; encaixar de verdade o estabiliza; (2) curto controlado: ligar um jumper do + ao − faz a tela alertar, a bancada cortar a energia e o mascote reagir; remover o jumper normaliza. Desafio — bancada com DOIS erros (jumper em curto + LED mal encaixado) que o aluno deve consertar sem disparar o alarme.
${SIM} O corte automático, o alerta e o pisca do mau contato são simulados; o hardware físico NÃO foi usado para demonstrar curto.
A bandeja tem só as peças do circuito; o mau contato aparece como peça “solta” (inclinada e marcada) que o aluno encaixa clicando nela.`;

function lesson09(): Lesson[] {
  const board = circuitL04();
  const loose = withPiece(board, 'w2', { loose: true });
  const qSint = quiz(
    'q-sintoma',
    'Qual é o sintoma típico de um mau contato?',
    [
      ['A luz fica piscando de forma irregular.', 'Isso! O contato abre e fecha sozinho.'],
      [
        'A luz fica sempre apagada.',
        'Apagada o tempo todo é um circuito aberto. O mau contato falha só de vez em quando.',
      ],
      ['A luz fica mais forte.', 'Mau contato não aumenta a corrente; ele a interrompe.'],
    ],
    0
  );
  const qCurto = quiz(
    'q-curto',
    'Por que a bancada corta a energia num curto-circuito?',
    [
      [
        'Porque a corrente fica enorme, sem nada que a limite, e pode esquentar fios e danificar a bateria.',
        'Exato! Por isso o curto é tão perigoso — e por isso a bancada protege você.',
      ],
      ['Porque o LED queimou.', 'No curto o LED nem participa: o fio passa por fora dele.'],
      ['Porque a bateria acabou.', 'É o contrário: a bateria entrega energia demais de uma vez.'],
    ],
    0
  );
  const tray = KIT('bateria', 'resistor_470', 'led', 'jumper_curto', 'jumper_longo', 'jumper_3', 'jumper_4');
  const guided = lesson({
    id: `${SEED_PREFIX}09-guiada`,
    title: 'Lição 9 — Segurança: curto-circuito e mau contato (guiada)',
    instruction: 'Aprenda a reconhecer e corrigir os dois acidentes mais comuns da bancada.',
    kind: 'guided',
    board: [],
    steps: [
      explain(
        'e-acidentes',
        'Dois acidentes comuns',
        'Curto-circuito: a corrente encontra um caminho curto demais, sem nada que a limite — ela fica enorme.\n\nMau contato: uma peça ou jumper mal encaixado deixa o caminho abrir e fechar sozinho — a luz pisca.\n\nVamos provocar os dois de forma controlada para você reconhecer os sinais.',
        artSafety()
      ),
      experiment(
        'x-contato',
        'Mau contato: encaixe direito',
        'Este circuito tem um jumper mal encaixado (inclinado e marcado “solto”). Energize e observe; depois encaixe o jumper clicando nele.',
        {
          board: loose,
          goals: [
            { id: 'pisca', label: 'Energize e veja o LED piscar de forma irregular.', seen: ['flicker'] },
            { id: 'encaixa', label: 'Clique no jumper “solto” para encaixá-lo de verdade.', seen: ['seated'] },
            { id: 'firme', label: 'Energize de novo: o LED fica aceso e firme.', now: ['lit', 'no_loose'] },
          ],
        }
      ),
      interact('i-sintoma', 'Como se reconhece um mau contato?', qSint),
      experiment(
        'x-curto',
        'Curto-circuito controlado',
        'Arraste um jumper curto para ligar o + ao − da bateria (as duas colunas da bateria) e clique em Energizar: veja o alerta. Depois remova o jumper e energize outra vez.',
        {
          board,
          goals: [
            {
              id: 'alerta',
              label: 'Ligue o + direto ao − e energize: a bancada corta a energia e mostra o alerta.',
              seen: ['short_cut'],
            },
            {
              id: 'volta',
              label: 'Tire o jumper do curto e energize: o circuito volta ao normal.',
              seen: ['short_cut'],
              now: ['no_short', 'lit'],
            },
          ],
        }
      ),
      interact('i-curto', 'Pense no que aconteceu.', qCurto),
      explain(
        'e-diag',
        'Como diagnosticar',
        'Sempre que algo estranho acontecer:\n\n1. Procure peças ou jumpers mal encaixados (inclinados, fora da coluna certa).\n2. Confira se nenhum fio liga o + direto ao − sem passar por pelo menos um resistor.\n3. Energize de novo e veja se a luz fica firme, sem piscar.'
      ),
    ],
    quizzes: [qSint, qCurto],
    settings: { tray },
    notes: L09_NOTES,
    tags: ['guiada', 'segurança', 'bancada com defeito', 'simulação de falha', 'exemplo'],
  });
  const faulty = [...withPiece(board, 'led', { loose: true }), P('curto', 'jumper_curto', 1, 2, 0)];
  const challenge = lesson({
    id: `${SEED_PREFIX}09-desafio`,
    title: 'Lição 9 — Segurança: curto-circuito e mau contato (desafio)',
    instruction:
      'A bancada tem dois erros ao mesmo tempo. Conserte para o LED acender com segurança, sem disparar o alarme de curto.',
    kind: 'challenge',
    board,
    start: { pieces: faulty },
    settings: { requireLit: true, tray },
    notes: `${L09_NOTES}\nDesafio: o instrutor entrega a bancada com DOIS erros — um jumper em curto no canto (+ direto no −) e um LED mal encaixado. O aluno só avança com o circuito certo, as peças encaixadas e o LED aceso.`,
    tags: ['desafio', 'bancada com defeito', 'dois erros', 'segurança', 'exemplo'],
  });
  return [guided, challenge];
}

// --- Lesson 10 -----------------------------------------------------------------------------------

const L10_NOTES = `Objetivo: integrar botão, resistores, LED e buzzer num alarme: ao apertar, o LED acende E o buzzer toca.
Como saber que deu certo: o LED acende e o buzzer soa ao mesmo tempo ao apertar o botão; o tutor só interfere depois de 2 tentativas consecutivas erradas no mesmo passo.
Circuito: o botão alimenta dois ramos em paralelo — resistor 1 → LED e resistor 2 → buzzer — que se juntam no nó 3.
${SIM} A corrente de cada ramo vem do modelo (LED: (5−2)/R; buzzer ≈ 250 Ω em série).`;

function lesson10(): Lesson[] {
  const board = circuitL10();
  const qParalelo = quiz(
    'q-paralelo',
    'Por que o LED e o buzzer funcionam ao mesmo tempo?',
    [
      [
        'Porque a corrente se divide em dois caminhos, um para cada um.',
        'Isso! São dois ramos em paralelo, ligados ao mesmo botão.',
      ],
      [
        'Porque o buzzer é ligado ao LED por dentro.',
        'Eles são peças separadas: o que os liga é o circuito que você montou.',
      ],
      ['Porque o botão manda dois sinais pelo ar.', 'Aqui tudo é corrente elétrica pelos fios da bancada.'],
    ],
    0
  );
  const guided = lesson({
    id: `${SEED_PREFIX}10-guiada`,
    title: 'Lição 10 — Desafio de integração: o alarme (guiada)',
    instruction:
      'Agora você vai montar um alarme: ao apertar o botão, o LED acende E o buzzer toca ao mesmo tempo. Você já sabe montar cada parte — o novo desafio é juntar tudo.',
    kind: 'guided',
    board,
    steps: [
      explain(
        'e-alarme',
        'Um alarme em blocos',
        'Um alarme junta o que você aprendeu: o botão liga tudo, cada resistor protege a sua peça, o LED mostra e o buzzer avisa. O botão alimenta dois ramos ao mesmo tempo.\n\nVocê vai montar com ajuda mínima: o tutor só fala depois de dois erros seguidos no mesmo passo.',
        artAlarm()
      ),
      ...build(
        board,
        [
          ['bat', 'Coloque a bateria.'],
          ['btn', 'Coloque o botão.'],
          ['res1', 'Coloque o resistor de 470 Ω do ramo do LED.'],
          ['led', 'Coloque o LED.'],
          ['res2', 'Coloque o resistor de 220 Ω do ramo do buzzer.'],
          ['buz', 'Coloque o buzzer.'],
          ['w1', 'Jumper do + da bateria ao botão.'],
          ['w3', 'Jumper do botão ao ramo do buzzer.'],
          ['w4', 'Jumper do buzzer ao ponto de retorno.'],
          ['w2', 'Jumper do retorno ao − da bateria.'],
        ],
        'Conecte os dois ramos e confira o circuito.'
      ),
      experiment('x-alarme', 'Teste o alarme', 'Energize e aperte o botão: o LED e o buzzer devem funcionar juntos.', {
        goals: [
          {
            id: 'ambos',
            label: 'Aperte o botão e veja o LED acender E escute o buzzer ao mesmo tempo.',
            seen: ['both_on'],
          },
          { id: 'solta', label: 'Solte o botão e veja tudo parar.', seen: ['released_dark'] },
        ],
      }),
      interact('i-paralelo', 'Para fechar o desafio…', qParalelo),
    ],
    quizzes: [qParalelo],
    settings: {
      hintAfter: 2,
      tray: KIT(
        'bateria',
        'botao',
        'resistor_470',
        'resistor_220',
        'led',
        'buzzer',
        'jumper_longo',
        'jumper_3',
        'jumper_4'
      ),
    },
    notes: L10_NOTES,
    tags: ['guiada', 'integração', 'paralelo', 'ajuda mínima', 'exemplo'],
  });
  return [guided];
}

// --- the whole curriculum ----------------------------------------------------------------------------

export function curriculumLessons(): Lesson[] {
  return [
    ...lesson01(),
    ...lesson02(),
    ...lesson03(),
    ...lesson04(),
    ...lesson05(),
    ...lesson06(),
    ...lesson07(),
    ...lesson08(),
    ...lesson09(),
    ...lesson10(),
  ];
}

export interface CurriculumModule {
  title: string;
  description: string;
  lessonIds: string[];
}

export function curriculumModules(): CurriculumModule[] {
  const id = (name: string) => `${SEED_PREFIX}${name}`;
  const track = (...names: string[]) => names.map(id);
  return [
    {
      title: 'Trilha 1 — Primeiros circuitos (lições 1 a 3)',
      description: 'Bancada e nós, primeiro circuito fechado e o resistor. Cada lição tem versão guiada e desafio.',
      lessonIds: track('01-guiada', '01-desafio', '02-guiada', '02-desafio', '03-guiada', '03-desafio'),
    },
    {
      title: 'Trilha 2 — Sentido do LED e botão (lições 4 e 5)',
      description: 'Polaridade do LED e controle por botão.',
      lessonIds: track('04-guiada', '04-desafio', '05-guiada', '05-desafio'),
    },
    {
      title: 'Trilha 3 — Potenciômetro, capacitor e buzzer (6 a 8)',
      description: 'Resistência variável, energia guardada e som. Inclui previsões e experimentos simulados.',
      lessonIds: track(
        '06-guiada',
        '06-desafio',
        '07-guiada',
        '07-desafio',
        '08-guiada',
        '08-potenciometro',
        '08-desafio'
      ),
    },
    {
      title: 'Trilha 4 — Segurança e integração (9 e 10)',
      description: 'Curto-circuito, mau contato e o alarme que junta tudo.',
      lessonIds: track('09-guiada', '09-desafio', '10-guiada'),
    },
    {
      title: 'Currículo completo — Fundamental II',
      description:
        'Todas as lições do currículo, na ordem de ensino: da bancada e dos nós até o alarme final.',
      lessonIds: track(
        '01-guiada',
        '01-desafio',
        '02-guiada',
        '02-desafio',
        '03-guiada',
        '03-desafio',
        '04-guiada',
        '04-desafio',
        '05-guiada',
        '05-desafio',
        '06-guiada',
        '06-desafio',
        '07-guiada',
        '07-desafio',
        '08-guiada',
        '08-potenciometro',
        '08-desafio',
        '09-guiada',
        '09-desafio',
        '10-guiada'
      ),
    },
  ];
}
