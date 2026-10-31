import { useEffect, useMemo, useRef, useState } from 'react';
import { validateStep } from '../api/validator.ts';
import { TutorVoiceContext, useSay, useTutorVoice } from '../audio/useTutorVoice.ts';
import Bubble from '../components/Bubble.tsx';
import LabBoard from '../components/LabBoard.tsx';
import { capsuleConfig, formatOhms, isCapsule, NOMES } from '../engine/sim.ts';
import { cumulativeBoard, effectiveSteps, startPieces } from '../model/steps.ts';
import ExperimentStep from './ExperimentStep.tsx';
import ExplainStep from './ExplainStep.tsx';
import { boardBefore, buildPhases, challengeScore, type PlayerEvent } from './phases.ts';
import { useLab } from './useLab.ts';

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
  const [_tries, setTries] = useState(0);
  useEffect(() => {
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      const r = await validateStep({ lesson, pieces, stepIdx, previousHash: prevHash.current, answer, debug });
      if (mine !== seq.current) return;
      if (r.ok === true) {
        prevHash.current = r.result.graphHash;
        setState({ status: 'ok', result: r.result });
      } else setState({ status: r.offline ? 'offline' : 'error', error: r.error, problems: r.problems });
    }, 250);
    return () => clearTimeout(t);
  }, [lesson, pieces, stepIdx, answer, debug]);
  return {
    ...state,
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
              {result.debug.expectedNets.map((net) => (
                <li key={net}>{net}</li>
              ))}
            </ul>
            {result.debug.expectedCircuit && <p>Circuito: {result.debug.expectedCircuit}</p>}
          </div>
          <div>
            <strong>Ligações na bancada</strong>
            <ul>
              {result.debug.actualNets.map((net) => (
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
    if (target.type === 'experiment' && target.step.experiment?.board) return target.step.experiment.board.map((p) => ({ ...p }));
    return current;
  };
  const [idx, setIdx] = useState(first);
  const [pieces, setPieces] = useState(() => boardFor(first, boardBefore(lesson, first))); // kept across steps
  const [debugEnabled, setDebugEnabled] = useState(false);
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
  else if (audio.status !== 'ok') text = `Sem áudio (${audio.detail || audio.status}).`;
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
}: {
  quiz: any;
  onDone: () => void;
  mascotKind: string;
  verify?: (id: string) => Promise<any>;
  onAnswer?: (correct: boolean) => void;
}) {
  const [picked, setPicked] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const option = quiz.options.find((o) => o.id === picked);
  const correct = verify ? !!verdict?.approved : picked === quiz.correctId;
  let msg: string;
  if (!option) msg = 'Escolha uma alternativa.';
  else if (verify && !verdict) msg = 'Conferindo…';
  else if (correct) msg = option.feedback || praise();
  else msg = option.feedback || (verify && verdict.message) || 'Não foi dessa vez. Tente de novo.';

  useSay([quiz.prompt, ...quiz.options.map((o) => o.text)]);
  useSay(option ? [msg] : [], 1);

  async function pick(o) {
    setPicked(o.id);
    if (verify) {
      setVerdict(null);
      setVerdict(await verify(o.id));
    } else onAnswer?.(o.id === quiz.correctId);
  }
  return (
    <>
      <Bubble
        kind={mascotKind}
        tone={!option || (verify && !verdict) ? 'info' : correct ? 'ok' : 'erro'}
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
function InteractStep({ lesson, phase, pieces, onDone, mascotKind, onAnswer }) {
  const quiz = phase.quiz;
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
      <QuizStep quiz={quiz} onDone={onDone} mascotKind={mascotKind} verify={verify} />
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
      style={{
        fontSize: 14,
        fontWeight: 700,
        color: left <= 10 ? 'var(--color-accent-700)' : 'var(--color-neutral-700)',
      }}
    >
      ⏱ {Math.max(0, left)} s
    </span>
  );
}

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

  // The bubble shows the step's instruction until the student touches the board, then the
  // validator's message — a hint only arrives when the graph actually changed (SFR7). With
  // settings.hintAfter the hint waits until the same mistake happened that many times in a row.
  const [shown, setShown] = useState(null);
  const streak = useRef<{ category: string | null; n: number }>({ category: null, n: 0 });
  const res = v.status === 'ok' ? v.result : null;
  useEffect(() => {
    if (!res) return;
    if (res.approved) {
      streak.current = { category: null, n: 0 };
      setShown({ tone: 'ok', msg: res.message });
    } else if (touched && res.hint) {
      // Consecutive misses count whatever the mistake was: a student trying different wrong fixes still gets help.
      streak.current = { category: res.category, n: streak.current.n + 1 };
      const wait = settings?.hintAfter ?? 1;
      if (streak.current.n >= wait) setShown({ tone: toneFor(res.category), msg: res.hint });
      else setShown({ tone: 'obs', msg: 'Ainda não é isso. Observe o circuito com calma e tente de novo.' });
    }
  }, [res, touched, settings?.hintAfter]);

  const looseLeft = pieces.some((p) => p.loose);
  // The circuit matches; the lesson may also want to see it work (energized and lit) with firm contacts.
  const built = !!res?.approved && !looseLeft;
  const working = lab.energized && diag.code === 'valido';
  const needsWork = final && !!settings?.requireLit;
  const ready = built && (!needsWork || working);

  let tone = 'info',
    msg =
      text ||
      (lesson.kind === 'challenge' && lesson.start?.pieces.length
        ? 'Encontre o que está errado no circuito e conserte.'
        : 'Monte o circuito.');
  if (expired) {
    tone = 'erro';
    msg = bench
      ? 'O tempo acabou! Termine o circuito para ver sua pontuação.'
      : 'O tempo acabou! Vamos para a explicação, e depois você pode tentar de novo com “Testar de novo”.';
  } else if (v.status === 'offline') {
    tone = 'erro';
    msg = 'Validador offline. Inicie o serviço (npm run validator) e tente de novo.';
  } else if (v.status === 'error') {
    tone = 'erro';
    msg = v.error + (v.problems?.length ? ` ${v.problems.join(' ')}` : '');
  } else if (lab.alarm) {
    tone = 'erro';
    msg = lab.alarm;
  } else if (res?.approved && looseLeft) {
    tone = 'obs';
    msg = 'O circuito está certo, mas uma peça está mal encaixada (marcada como “solta”). Clique nela para encaixar de verdade.';
  } else if (built && needsWork && !working) {
    tone = 'ok';
    msg = 'Montagem certa! Agora clique em Energizar e confira se funciona.';
  } else if (ready) {
    tone = 'ok';
    msg =
      !touched && final && lesson.kind === 'guided'
        ? 'Conferi o circuito inteiro: todas as ligações estão certas. Clique em Continuar.'
        : (shown?.msg ?? 'Muito bem!') + (working && !diag.limited ? ' Circuito fechado ✓' : '');
  } else if (shown && (touched || res?.approved)) ({ tone, msg } = { tone: shown.tone, msg: shown.msg });

  // On the bench an expired challenge can still be finished (and scores 0); the editor preview stops.
  const approved = ready && (bench || !expired);
  const fillAnswer = () =>
    setPieces(
      (lesson.kind === 'challenge' ? lesson.board.pieces : cumulativeBoard(lesson, stepIdx)).map((p) => ({ ...p }))
    );
  useSay([msg]);
  return (
    <>
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
      <LabBoard lab={lab} pieces={pieces} setPieces={setPieces} settings={settings} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
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
        {!bench && (
          <button type="button" className="pill-link-btn muted" onClick={fillAnswer}>
            preencher com o gabarito
          </button>
        )}
        {(approved || (expired && !bench)) && (
          <button type="button" className="btn-primary" onClick={onDone}>
            Continuar
          </button>
        )}
      </div>
    </>
  );
}
