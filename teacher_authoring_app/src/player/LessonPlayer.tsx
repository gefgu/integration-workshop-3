import { useEffect, useMemo, useRef, useState } from 'react';
import { validateStep } from '../api/validator.ts';
import { TutorVoiceContext, useSay, useTutorVoice } from '../audio/useTutorVoice.ts';
import Bubble from '../components/Bubble.tsx';
import { groupChecklist } from '../curriculum/stepHints.ts';
import { missingLink } from '../engine/linkHint.ts';
import GoalBar from './GoalBar.tsx';
import LabBoard from '../components/LabBoard.tsx';
import { capsuleConfig, formatOhms, isCapsule, NOMES } from '../engine/sim.ts';
import { cumulativeBoard, effectiveSteps, startPieces } from '../model/steps.ts';
import ExperimentStep from './ExperimentStep.tsx';
import ExplainStep from './ExplainStep.tsx';
import { boardBefore, buildPhases, challengeScore, type PlayerEvent } from './phases.ts';
import { useLab } from './useLab.ts';
import { challengeHint } from './hints.ts';

export { boardBefore, buildPhases, challengeScore, type PlayerEvent };

const PRAISE = ['Boa!', 'Isso aí!', 'Mandou bem!', 'Perfeito!', 'Show!', 'Exato!'];
const praise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];

/**
 * Checks the student's board against step `stepIdx` with graph_validator (debounced).
 * Returns { status: 'checking'|'ok'|'offline'|'error', result?, error?, problems?, retry }.
 * The service only returns a `hint` when the graph changed since the last answer (SFR7).
 */
function useStepValidation({ lesson, pieces, stepIdx, answer = null, debug = false }) {
  const prevHash = useRef(null);
  const seq = useRef(0);
  const [state, setState] = useState<any>({ status: 'checking' });
  const [tries, setTries] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: tries deliberately retriggers an offline validation
  useEffect(() => {
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      const r = await validateStep({ lesson, pieces, stepIdx, previousHash: prevHash.current, answer, debug });
      if (mine !== seq.current) return;
      if (r.ok === true) {
        prevHash.current = r.result.graphHash;
        setState({ status: 'ok', result: r.result, pieces });
      } else setState({ status: r.offline ? 'offline' : 'error', error: r.error, problems: r.problems });
    }, 250);
    return () => clearTimeout(t);
  }, [lesson, pieces, stepIdx, answer, debug, tries]);
  return {
    ...state,
    ...(state.status === 'ok' && state.pieces !== pieces ? { status: 'checking', result: null } : {}),
    retry: () => {
      setState({ status: 'checking' });
      setTries((n) => n + 1);
    },
  };
}

const toneFor = (category) =>
  category === 'missing_component' || category === 'missing_connection' || category === 'open_circuit' ? 'obs' : 'erro';
const ISSUE_LABELS = {
  missing_component: 'Falta uma peça',
  missing_connection: 'Falta uma ligação',
  excess_connection: 'Ligação a mais',
  excess_component: 'Peça sobrando',
  incorrect_connection: 'Ligação incorreta',
  reversed_polarity: 'Polaridade invertida',
  wrong_value: 'Valor diferente',
  wrong_component: 'Peça diferente',
  wrong_config: 'Cápsula com outro modo',
  misconnected_component: 'Peça presente, ligação incorreta',
  open_circuit: 'Circuito aberto',
  short_circuit: 'Curto-circuito',
};

function pieceDescription(piece, withPosition = true) {
  let name =
    piece.type === 'potenciometro' && piece.value
      ? `${NOMES[piece.type]} ${formatOhms(piece.value)}`
      : NOMES[piece.type] || piece.type;
  if (isCapsule(piece.type)) {
    const setting = Object.values(capsuleConfig(piece)).join(' · ');
    if (setting) name += ` (${setting})`;
  }
  if (!withPosition) return name;
  const cols = piece.c != null ? [piece.a, piece.b, piece.c] : [piece.a, piece.b];
  return `${name} (colunas ${Math.min(...cols)}–${Math.max(...cols)}, linha ${piece.row + 1})`;
}

function ValidationDebug({ lesson, stepIdx, pieces, result, error, problems }) {
  const expected =
    result?.debug?.expectedPieces ??
    (lesson.kind === 'challenge' ? lesson.board.pieces : cumulativeBoard(lesson, stepIdx));
  const actual = result?.debug?.actualPieces ?? pieces;
  const step = effectiveSteps(lesson)[stepIdx];
  const matchValues = result?.debug?.matchValues ?? step?.options.matchValues ?? false;
  const strictPositions = result?.debug?.strictPositions ?? step?.options.strictPositions ?? false;
  const expectedById = new Map(expected.map((piece) => [piece.id, piece]));
  const actualById = new Map(actual.map((piece) => [piece.id, piece]));

  return (
    <section className="validation-debug" aria-label="Detalhes da validação">
      <h3>Depuração da validação</h3>
      <p>
        Conferir valores: <strong>{matchValues ? 'sim' : 'não'}</strong> · Posições fixas:{' '}
        <strong>{strictPositions ? 'sim' : 'não'}</strong>
      </p>
      {error && <p className="validation-debug-error">Resposta do validador: {error}</p>}
      {problems.length > 0 && (
        <ul className="validation-debug-error">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      <div className="validation-debug-columns">
        <div>
          <strong>Esperado nesta etapa</strong>
          {expected.length ? (
            <ul>
              {expected.map((piece) => (
                <li key={piece.id}>{pieceDescription(piece)}</li>
              ))}
            </ul>
          ) : (
            <p>Nenhuma peça.</p>
          )}
        </div>
        <div>
          <strong>Na bancada</strong>
          {actual.length ? (
            <ul>
              {actual.map((piece) => (
                <li key={piece.id}>{pieceDescription(piece)}</li>
              ))}
            </ul>
          ) : (
            <p>Nenhuma peça.</p>
          )}
        </div>
      </div>
      {!strictPositions && (result?.debug?.expectedNets?.length > 0 || result?.debug?.actualNets?.length > 0) && (
        <div className="validation-debug-columns">
          <div>
            <strong>Ligações esperadas</strong>
            <ul>
              {[...new Set<string>(result.debug.expectedNets)].map((net) => (
                <li key={net}>{net}</li>
              ))}
            </ul>
            {result.debug.expectedCircuit && <p>Circuito: {result.debug.expectedCircuit}</p>}
          </div>
          <div>
            <strong>Ligações na bancada</strong>
            <ul>
              {[...new Set<string>(result.debug.actualNets)].map((net) => (
                <li key={net}>{net}</li>
              ))}
            </ul>
            {result.debug.actualCircuit && <p>Circuito: {result.debug.actualCircuit}</p>}
          </div>
        </div>
      )}
      {result?.issues?.length > 0 && (
        <div>
          <strong>Diferenças apontadas</strong>
          <ul>
            {result.issues.map((issue, index) => {
              const missing = ['missing_component', 'missing_connection'].includes(issue.category);
              const expectedPiece = expectedById.get(issue.expectedPartId || (missing ? issue.partId : ''));
              const actualPiece = actualById.get(issue.actualPartId || (!missing ? issue.partId : ''));
              const detail =
                issue.category === 'misconnected_component'
                  ? `Esperado: ${expectedPiece ? pieceDescription(expectedPiece, strictPositions) : issue.family}; encontrado: ${actualPiece ? pieceDescription(actualPiece, strictPositions) : 'não encontrado'}`
                  : expectedPiece
                    ? pieceDescription(expectedPiece, strictPositions)
                    : actualPiece
                      ? pieceDescription(actualPiece, strictPositions)
                      : issue.family;
              return (
                <li key={`${issue.category}-${issue.partId || index}`}>
                  {ISSUE_LABELS[issue.category] || issue.category}: {detail}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {result?.approved && <p>O validador aprovou o circuito desta etapa.</p>}
    </section>
  );
}

/**
 * "Testar": roda a lição como o aluno veria — perguntas, passos de montagem validados pelo graph_validator.
 * `bench` mode is the workbench screen: no teacher tools, starts at `startPhase`, reports `onEvent`.
 */
export default function LessonPlayer({
  lesson,
  onExit,
  mascotKind,
  bench = false,
  startPhase = 0,
  onEvent,
  exitLabel,
}: {
  lesson: any;
  onExit: () => void;
  mascotKind: string;
  bench?: boolean;
  startPhase?: number;
  onEvent?: (event: PlayerEvent) => void;
  exitLabel?: string;
}) {
  const phases = useMemo(() => buildPhases(lesson), [lesson]);
  const first = Math.min(Math.max(0, startPhase), phases.length - 1);
  /** The board a phase begins with: the lesson's starting bench for a challenge build, an experiment's own board. */
  const boardFor = (phaseIdx: number, current: any[]) => {
    const target = phases[phaseIdx];
    if (target.type === 'challenge') return startPieces(lesson);
    if (target.type === 'experiment' && target.step.experiment?.board)
      return target.step.experiment.board.map((p) => ({ ...p }));
    return current;
  };
  const [idx, setIdx] = useState(first);
  const [pieces, setPieces] = useState(() => boardFor(first, boardBefore(lesson, first))); // kept across steps
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [prediction, setPrediction] = useState<string | null>(null);
  const [clipsSwapped, setClipsSwapped] = useState(() => Math.random() < 0.5);
  const startedAt = useRef(Date.now());
  const outcome = useRef<{ expired: boolean }>({ expired: false });
  const phase = phases[idx];
  const steps = phases.length - 1;
  const next = () => {
    const current = phases[idx];
    const nextIdx = Math.min(idx + 1, phases.length - 1);
    onEvent?.({
      type: 'phase_done',
      phase: nextIdx,
      phases: steps,
      stepIdx: 'idx' in current ? current.idx : null,
    });
    if (phases[nextIdx].type === 'done') {
      const durationS = (Date.now() - startedAt.current) / 1000;
      const score =
        lesson.kind === 'challenge' ? challengeScore(durationS, lesson.timeLimitS, outcome.current.expired) : null;
      onEvent?.({ type: 'lesson_done', durationS, score });
    }
    setPieces((cur) => boardFor(nextIdx, cur));
    setIdx(nextIdx);
  };
  const restart = () => {
    setPieces(boardFor(0, boardBefore(lesson, 0)));
    startedAt.current = Date.now();
    outcome.current.expired = false;
    setPrediction(null);
    setClipsSwapped(Math.random() < 0.5);
    setIdx(0);
  };
  const stepKey = 'step' in phase ? phase.step.id : 'challenge';
  const voice = useTutorVoice(lesson);
  const [muted, setMuted] = useState(false);
  useSay([lesson.title, lesson.instruction], -1, idx === 0); // again on "Testar de novo"

  return (
    <TutorVoiceContext.Provider value={voice}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', margin: 0, fontSize: 20 }}>
            {lesson.title || 'Lição sem título'}
          </h2>
          <span style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>
            {phase.type === 'done' ? 'Concluída' : `Etapa ${idx + 1} de ${steps}`}
          </span>
          <button type="button" className="btn-outline" onClick={onExit}>
            {exitLabel ?? 'Voltar ao editor'}
          </button>
          {!bench && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={debugEnabled} onChange={(e) => setDebugEnabled(e.target.checked)} />
              Depurar validação
            </label>
          )}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={!muted}
              onChange={(e) => {
                setMuted(!e.target.checked);
                voice.setMuted(!e.target.checked);
              }}
            />
            Voz do tutor
          </label>
          {!bench && <AudioStatus lesson={lesson} />}
        </div>
        {lesson.instruction && (
          <p style={{ margin: 0, maxWidth: 720, fontSize: 14, lineHeight: 1.5 }}>{lesson.instruction}</p>
        )}

        {phase.type === 'quiz' && (
          <QuizStep
            key={phase.quiz.id}
            quiz={phase.quiz}
            onDone={next}
            mascotKind={mascotKind}
            onAnswer={(correct) => onEvent?.({ type: 'quiz', quizId: phase.quiz.id, correct })}
            onPrediction={setPrediction}
          />
        )}
        {phase.type === 'explain' && <ExplainStep key={stepKey} step={phase.step} onDone={next} />}
        {phase.type === 'experiment' && (
          <ExperimentStep
            key={stepKey}
            lesson={lesson}
            step={phase.step}
            pieces={pieces}
            setPieces={setPieces}
            onDone={next}
            mascotKind={mascotKind}
            prediction={prediction}
            clipsSwapped={clipsSwapped}
          />
        )}
        {phase.type === 'interact' && (
          <InteractStep
            key={stepKey}
            lesson={lesson}
            phase={phase}
            pieces={pieces}
            onDone={next}
            mascotKind={mascotKind}
            onAnswer={(correct) => onEvent?.({ type: 'quiz', quizId: phase.quiz?.id, correct })}
            onPrediction={setPrediction}
            clipsSwapped={clipsSwapped}
          />
        )}
        {(phase.type === 'step' || phase.type === 'challenge') && (
          <BuildStep
            key={stepKey}
            lesson={lesson}
            stepIdx={phase.type === 'step' ? phase.idx : 0}
            final={phase.type === 'challenge' || phase.step.action === 'connect_circuit'}
            text={phase.type === 'step' ? phase.step.text : ''}
            pieces={pieces}
            setPieces={setPieces}
            debugEnabled={debugEnabled}
            timeLimitS={phase.type === 'challenge' ? lesson.timeLimitS : null}
            onDone={next}
            onExpired={() => {
              outcome.current.expired = true;
            }}
            mascotKind={mascotKind}
            bench={bench}
          />
        )}
        {phase.type === 'done' && !bench && (
          <>
            <SpokenBubble
              kind={mascotKind}
              tone="ok"
              message="Lição concluída! É assim que o aluno vai passar por ela."
            />
            <button type="button" className="btn-primary" onClick={restart}>
              Testar de novo
            </button>
          </>
        )}
      </div>
    </TutorVoiceContext.Provider>
  );
}

/** A tutor bubble whose message is also spoken (when its text has audio). */
function SpokenBubble({ kind, tone, message }) {
  useSay([message]);
  return <Bubble kind={kind} tone={tone} message={message} />;
}

/** Tells the teacher when the preview will be silent, and why. */
function AudioStatus({ lesson }) {
  const audio = lesson.audio;
  let text = '';
  if (!audio) text = 'Sem áudio: salve a lição para gerar a voz.';
  else if (audio.status !== 'ok') text = 'Sem voz do tutor. Você pode ler os textos na tela.';
  if (!text) return null;
  return <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>{text}</span>;
}

/** `verify(optionId)` (optional): async server-side check returning { approved, message }. */
function QuizStep({
  quiz,
  onDone,
  mascotKind,
  verify,
  onAnswer,
  onPrediction,
}: {
  quiz: any;
  onDone: () => void;
  mascotKind: string;
  verify?: (id: string) => Promise<any>;
  onAnswer?: (correct: boolean) => void;
  onPrediction?: (text: string) => void;
}) {
  const [picked, setPicked] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const option = quiz.options.find((o) => o.id === picked);
  const correct = quiz.prediction ? !!option : verify ? !!verdict?.approved : picked === quiz.correctId;
  let msg: string;
  if (!option) msg = 'Escolha uma alternativa.';
  else if (quiz.prediction) msg = 'Hipótese anotada! Continue para testar e comparar com o resultado.';
  else if (verify && !verdict) msg = 'Conferindo…';
  else if (correct) msg = option.feedback || praise();
  else msg = option.feedback || (verify && verdict.message) || 'Não foi dessa vez. Tente de novo.';

  useSay([quiz.prompt, ...quiz.options.map((o) => o.text)]);
  useSay(option ? [msg] : [], 1);

  async function pick(o) {
    setPicked(o.id);
    if (quiz.prediction) {
      onPrediction?.(o.text);
      return;
    }
    if (verify) {
      setVerdict(null);
      setVerdict(await verify(o.id));
    } else onAnswer?.(o.id === quiz.correctId);
  }
  return (
    <>
      <Bubble
        kind={mascotKind}
        tone={quiz.prediction || !option || (verify && !verdict) ? 'info' : correct ? 'ok' : 'erro'}
        message={msg}
      />
      <div className="panel" style={{ maxWidth: 720, width: '100%' }}>
        <h2>{quiz.prompt}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {quiz.options.map((o) => (
            <button
              type="button"
              key={o.id}
              className="btn-outline"
              disabled={correct}
              style={{
                textAlign: 'left',
                background:
                  picked === o.id ? (correct ? 'var(--color-accent-2-200)' : 'var(--color-accent-200)') : 'transparent',
              }}
              onClick={() => pick(o)}
            >
              {o.text}
            </button>
          ))}
        </div>
        {correct && (
          <button type="button" className="btn-primary" style={{ marginTop: 14 }} onClick={onDone}>
            Continuar
          </button>
        )}
      </div>
    </>
  );
}

/** SFR19: a step that leaves the circuit unchanged — approved by the validator from the student's answer. */
function InteractStep({ lesson, phase, pieces, onDone, mascotKind, onAnswer, onPrediction, clipsSwapped }) {
  const sourceQuiz = phase.quiz;
  const clipQuestion = sourceQuiz?.options.length === 2 && sourceQuiz.options.every((o) => /^Clipe [AB]$/.test(o.text));
  const quiz =
    clipQuestion && clipsSwapped
      ? {
          ...sourceQuiz,
          correctId: sourceQuiz.options.find((o) => o.id !== sourceQuiz.correctId).id,
          options: sourceQuiz.options.map((o, i) => ({ ...o, feedback: sourceQuiz.options[1 - i].feedback })),
        }
      : sourceQuiz;
  useSay([phase.step.text], -0.5, !!quiz);
  if (!quiz) {
    return (
      <>
        <Bubble
          kind={mascotKind}
          tone="erro"
          message="Este passo de interação ainda não tem pergunta. Volte ao editor e escolha uma."
        />
        <button type="button" className="btn-outline" onClick={onDone}>
          Pular passo
        </button>
      </>
    );
  }
  async function verify(optionId) {
    // A challenge's follow-up questions are the app's own; the validator only knows the final circuit.
    if (phase.local) {
      const approved = optionId === quiz.correctId;
      onAnswer?.(approved);
      return { approved, message: 'Quase! Pense no que você observou e tente de novo.' };
    }
    const r = await validateStep({ lesson, pieces, stepIdx: phase.idx, answer: optionId });
    if (!r.ok)
      return {
        approved: false,
        message: r.offline ? 'Validador offline. Rode npm run validator.' : r.error || 'Não deu para conferir.',
      };
    return r.result;
  }
  return (
    <>
      {phase.step.text && <p style={{ margin: 0, maxWidth: 720, fontSize: 14 }}>{phase.step.text}</p>}
      <QuizStep quiz={quiz} onDone={onDone} mascotKind={mascotKind} verify={verify} onPrediction={onPrediction} />
    </>
  );
}

function Countdown({ seconds, running, onExpire }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => setLeft((n) => n - 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  useEffect(() => {
    if (left <= 0) onExpire();
  }, [left, onExpire]);
  return (
    <span
      role="timer"
      aria-label="Tempo restante do desafio"
      style={{
        fontSize: 22,
        fontWeight: 700,
        padding: '10px 18px',
        border: '2px solid currentColor',
        borderRadius: 12,
        color: left <= 10 ? 'var(--color-accent-700)' : 'var(--color-neutral-700)',
      }}
    >
      ⏱ {Math.max(0, left)} s
    </span>
  );
}

/** Spoken by the tutor (it is part of the system phrase pack). */
export const ENERGIZE_NUDGE = 'Montagem certa! Tente energizar!';

function BuildStep({
  lesson,
  stepIdx,
  final,
  text,
  pieces,
  setPieces,
  debugEnabled,
  timeLimitS,
  onDone,
  onExpired = undefined,
  mascotKind,
  bench = false,
}) {
  const settings = lesson.settings;
  const [expired, setExpired] = useState(false);
  const initial = useRef(pieces);
  const touched = pieces !== initial.current;
  const v = useStepValidation({ lesson, pieces, stepIdx, debug: debugEnabled });
  const lab = useLab(pieces, settings);
  const { diag, cap } = lab;

  // Count deliberate board changes and power-on attempts, not responses or the starting board.
  const [shown, setShown] = useState(null);
  const [misses, setMisses] = useState(0);
  const lastBoard = useRef(pieces);
  useEffect(() => {
    if (pieces !== lastBoard.current) {
      lastBoard.current = pieces;
      setMisses((n) => n + 1);
    }
  }, [pieces]);
  const res = v.status === 'ok' ? v.result : null;
  useEffect(() => {
    if (!res) return;
    if (res.approved) {
      setMisses(0);
      setShown({ tone: 'ok', msg: res.message });
    } else if (misses > 0) {
      setShown({
        tone: toneFor(res.category),
        msg: challengeHint(lesson, pieces, misses, res.hint || res.message, res.category),
      });
    }
  }, [res, misses, lesson, pieces]);

  const looseLeft = pieces.some((p) => p.loose);
  // The circuit matches; the lesson may also want to see it work (energized and lit) with firm contacts.
  const built = !!res?.approved && !looseLeft;
  const working = lab.energized && diag.code === 'valido';
  const predictionBeforeExperiment = lesson.kind === 'guided' && lesson.quizzes.some((q) => q.prediction);
  const needsWork = final && !!settings?.requireLit && !predictionBeforeExperiment;
  const ready = built && (!needsWork || working);
  const canEnergize = lesson.board.pieces.length > 1; // a lone battery (lesson 1) has nothing to power

  let tone = 'info',
    msg =
      text ||
      (lesson.kind === 'challenge' && lesson.start?.pieces.length
        ? 'Encontre o que está errado no circuito e conserte.'
        : lesson.instruction || 'Monte o circuito.');
  if (expired) {
    tone = 'erro';
    msg = 'O tempo acabou! Clique em Continuar para ver a explicação. Você pode refazer a lição depois.';
  } else if (v.status === 'offline') {
    tone = 'erro';
    msg = 'Validador offline. Inicie o serviço (npm run validator) e tente de novo.';
  } else if (v.status === 'error') {
    tone = 'erro';
    msg = v.error + (v.problems?.length ? ` ${v.problems.join(' ')}` : '');
  } else if (lab.alarm) {
    tone = 'erro';
    msg = lab.alarm;
  } else if (lab.energized && diag.limited) {
    tone = 'obs';
    msg = 'Funcionou na simulação, mas veja o aviso de limite de corrente antes de continuar.';
  } else if (built && lab.energized && !working && needsWork) {
    tone = 'obs';
    msg = diag.msg || 'O caminho está aberto: siga do + da bateria até o LED e confira onde cada jumper termina.';
  } else if (res?.approved && looseLeft) {
    tone = 'obs';
    msg =
      'O circuito está certo, mas uma peça está mal encaixada (marcada como “solta”). Clique nela para encaixar de verdade.';
  } else if (built && final && canEnergize && !lab.energized) {
    // Right, but the student has not powered it yet: the next move is the Energizar button.
    tone = 'ok';
    msg = ENERGIZE_NUDGE;
  } else if (ready) {
    tone = 'ok';
    msg =
      !touched && final && lesson.kind === 'guided'
        ? 'Esta etapa está conferida. Observe a montagem e clique em Continuar.'
        : (shown?.msg ?? 'Muito bem!') + (working && !diag.limited ? ' Circuito fechado ✓' : '');
  } else if (shown && (touched || misses > 0 || res?.approved)) ({ tone, msg } = { tone: shown.tone, msg: shown.msg });

  // A timeout scores zero and permits continuing to the explanation in both player modes.
  const approved = ready && (bench || !expired);
  const fillAnswer = () =>
    setPieces(
      (lesson.kind === 'challenge' ? lesson.board.pieces : cumulativeBoard(lesson, stepIdx)).map((p) => ({ ...p }))
    );
  useSay([msg]);
  // After a deliberate mistake that is a missing connection, show where the component must be connected.
  // A challenge waits for the same attempt that unlocks its verbal hint, so the line never comes before it.
  const connectionMistake =
    !!res &&
    !res.approved &&
    ['open_circuit', 'missing_connection', 'incorrect_connection', 'misconnected_component'].includes(res.category) &&
    misses > 0 &&
    (lesson.kind !== 'challenge' || misses >= (settings?.hintAfter ?? 1));
  const linkHint = connectionMistake
    ? missingLink(pieces, lesson.kind === 'challenge' ? lesson.board.pieces : cumulativeBoard(lesson, stepIdx))
    : null;
  // What the step asks for stays pinned; the bubble above it is free to show hints and warnings.
  const goal =
    text ||
    (lesson.kind === 'challenge' ? lesson.instruction : '') ||
    (final ? 'Monte o circuito completo e confira se está certo.' : '');
  // A build step with several pieces gets a live checklist: each piece on the bench, then "connected".
  const buildStepDef = lesson.kind === 'guided' ? effectiveSteps(lesson)[stepIdx] : undefined;
  const checklist =
    buildStepDef?.pieceIds && buildStepDef.pieceIds.length > 0
      ? (() => {
          const group = new Set(buildStepDef.pieceIds);
          const upTo = cumulativeBoard(lesson, stepIdx);
          return groupChecklist(
            upTo.filter((p) => group.has(p.id)),
            upTo.filter((p) => !group.has(p.id)),
            pieces,
            built
          );
        })()
      : [];
  return (
    <>
      <GoalBar text={goal} items={checklist} />
      <Bubble kind={mascotKind} tone={tone} message={msg} />
      {debugEnabled && (
        <ValidationDebug
          lesson={lesson}
          stepIdx={stepIdx}
          pieces={pieces}
          result={res}
          error={v.status === 'error' ? v.error : null}
          problems={v.problems || []}
        />
      )}
      {v.status === 'offline' && (
        <button type="button" className="btn-outline" onClick={v.retry}>
          Tentar de novo
        </button>
      )}
      {timeLimitS != null && (
        <Countdown
          seconds={timeLimitS}
          running={!expired && !approved}
          onExpire={() => {
            setExpired(true);
            onExpired?.();
          }}
        />
      )}
      <LabBoard
        lab={{
          ...lab,
          toggle: () => {
            if (!lab.energized && !ready) setMisses((n) => n + 1);
            lab.toggle();
          },
        }}
        pieces={pieces}
        setPieces={setPieces}
        settings={settings}
        linkHint={linkHint}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
        {!bench && (
          <button type="button" className="pill-link-btn muted" onClick={fillAnswer}>
            preencher com o gabarito
          </button>
        )}
        {(approved || expired) && (
          <button type="button" className="btn-primary" onClick={onDone}>
            Continuar
          </button>
        )}
      </div>
    </>
  );
}
