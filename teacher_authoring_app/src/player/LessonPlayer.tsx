import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { validateStep } from '../api/validator.ts';
import { TutorVoiceContext, useSay, useTutorVoice } from '../audio/useTutorVoice.ts';
import Bubble from '../components/Bubble.tsx';
import { BoardSlotContext } from '../components/boardSlot.ts';
import Icon from '../components/Icon.tsx';
import LabBoard from '../components/LabBoard.tsx';
import { capsuleConfig, formatOhms, isCapsule, NOMES } from '../engine/sim.ts';
import { cumulativeBoard, effectiveSteps, startPieces } from '../model/steps.ts';
import { BenchLiveContext, BenchModeContext, StepPartsContext, useBenchMode, useStepParts } from './benchMode.ts';
import ExperimentStep from './ExperimentStep.tsx';
import ExplainStep from './ExplainStep.tsx';
import { challengeHint } from './hints.ts';
import { cameraLessonPieces } from './cameraPolarity.ts';
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
  toolbar,
  notice,
  debug,
  livePieces = null,
  barExtra,
  voiceMuted,
}: {
  lesson: any;
  onExit: () => void;
  mascotKind: string;
  bench?: boolean;
  startPhase?: number;
  onEvent?: (event: PlayerEvent) => void;
  exitLabel?: string;
  /** extra controls for the teacher's controls box (the Sandbox / Validator switch) */
  toolbar?: React.ReactNode;
  /** a warning shown in the lesson box (e.g. testing an unsaved version) */
  notice?: string;
  /** forces the validation details on or off (the bench preview has its own switch) */
  debug?: boolean;
  /** bench with the camera on: what the camera sees on the real board (the screen board only mirrors it) */
  livePieces?: any[] | null;
  /** extra content in the bench's top bar (the camera status) */
  barExtra?: ReactNode;
  /** the bench's sound switch (in its game menu); the teacher's player keeps its own checkbox */
  voiceMuted?: boolean;
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
  const cameraPieces = useMemo(() => cameraLessonPieces(lesson, livePieces), [lesson, livePieces]);
  const [pieces, setPieces] = useState(() => cameraPieces ?? boardFor(first, boardBefore(lesson, first))); // kept across steps
  // With the camera on, the real board is the truth: the screen follows it and never resets it.
  useEffect(() => {
    if (cameraPieces) setPieces(cameraPieces);
  }, [cameraPieces]);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [prediction, setPrediction] = useState<string | null>(null);
  const [clipsSwapped, setClipsSwapped] = useState(() => Math.random() < 0.5);
  const startedAt = useRef(Date.now());
  const outcome = useRef<{ expired: boolean }>({ expired: false });
  const phase = phases[idx];
  const steps = phases.length - 1;
  const stepParts = useMemo(() => partsForPhase(lesson, phase), [lesson, phase]);
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
    if (!livePieces) setPieces((cur) => boardFor(nextIdx, cur));
    setIdx(nextIdx);
  };
  const restart = () => {
    if (!livePieces) setPieces(boardFor(0, boardBefore(lesson, 0)));
    startedAt.current = Date.now();
    outcome.current.expired = false;
    setPrediction(null);
    setClipsSwapped(Math.random() < 0.5);
    setIdx(0);
  };
  const stepKey = 'step' in phase ? phase.step.id : 'challenge';
  const voice = useTutorVoice(lesson, bench);
  const [muted, setMuted] = useState(!!voiceMuted);
  // The bench's game menu owns the sound switch: follow it.
  useEffect(() => {
    if (voiceMuted === undefined) return;
    setMuted(voiceMuted);
    voice.setMuted(voiceMuted);
  }, [voiceMuted, voice]);
  // Bench: the lesson opens on its own screen (title + what we will do) before the first step.
  const [intro, setIntro] = useState(bench && first === 0);
  /** Bench joystick ←: the previous step; from the first step back to the lesson's opening; from there, leave. */
  const prev = () => {
    if (intro) return onExit?.();
    if (idx === 0) return setIntro(true);
    const prevIdx = idx - 1;
    if (!livePieces) setPieces((cur) => boardFor(prevIdx, cur));
    setIdx(prevIdx);
  };
  // teacher's validator: the board is drawn in a fixed left half (see BoardSlotContext)
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <TutorVoiceContext.Provider value={voice}>
      <LessonIntroVoice title={lesson.title} instruction={lesson.instruction} enabled={idx === 0} />
      <BenchModeContext.Provider value={bench}>
        <BenchLiveContext.Provider value={bench && !!livePieces}>
          <StepPartsContext.Provider value={bench ? stepParts : null}>
            <BoardSlotContext.Provider value={bench ? null : slot}>
              <div
                className={bench ? undefined : 'player-desk'}
                style={
                  bench
                    ? { display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center' }
                    : undefined
                }
              >
                {bench ? (
                  <div className="bench-bar">
                    <button
                      type="button"
                      className="bench-bar-back"
                      data-pad="step-back"
                      onClick={prev}
                      aria-label={intro ? (exitLabel ?? 'Sair da lição') : 'Voltar ao passo anterior'}
                    >
                      <Icon name="back" size={22} />
                      Voltar
                    </button>
                    <span className="bench-bar-title">{intro ? '' : lesson.title || 'Lição sem título'}</span>
                    {!intro && phase.type !== 'done' && (
                      <span className="bench-bar-steps" role="img" aria-label={`Etapa ${idx + 1} de ${steps}`}>
                        {Array.from({ length: steps }, (_, i) => (
                          <span
                            // biome-ignore lint/suspicious/noArrayIndexKey: one dot per step, fixed for the lesson
                            key={i}
                            className={i === idx ? 'active' : i < idx ? 'done' : ''}
                          />
                        ))}
                      </span>
                    )}
                    {barExtra}
                  </div>
                ) : (
                  <div className="board-slot" ref={setSlot} />
                )}
                <div
                  className={bench ? 'player-steps-bench' : 'player-right'}
                  style={bench ? { display: 'contents' } : undefined}
                >
                  {!bench && (
                    <div className="player-bar">
                      <section className="panel player-tools" aria-label="Controles do teste">
                        {toolbar}
                        <button type="button" className="btn-outline btn-icon" onClick={onExit}>
                          <Icon name="edit" size={16} />
                          {exitLabel ?? 'Voltar ao editor'}
                        </button>
                        <div className="player-switches">
                          <label>
                            <input
                              type="checkbox"
                              checked={debugEnabled}
                              onChange={(e) => setDebugEnabled(e.target.checked)}
                            />
                            Depurar validação
                          </label>
                          <label>
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
                        </div>
                        <AudioStatus lesson={lesson} />
                      </section>
                      <section className="panel player-info" aria-label="Lição em teste">
                        <div className="player-info-head">
                          <h2>{lesson.title || 'Lição sem título'}</h2>
                          <span className="player-step-chip">
                            {phase.type === 'done' ? 'Concluída' : `Etapa ${idx + 1} de ${steps}`}
                          </span>
                        </div>
                        {lesson.instruction && <p className="player-instruction">{lesson.instruction}</p>}
                        {notice && (
                          <p role="status" className="player-notice">
                            {notice}
                          </p>
                        )}
                      </section>
                    </div>
                  )}
                  <div
                    className={bench ? 'player-steps-bench' : 'player-body'}
                    style={bench ? { display: 'contents' } : undefined}
                  >
                    {bench && intro && (
                      <section className="bench-intro">
                        <span className="bench-intro-kind">
                          {lesson.kind === 'challenge' ? 'Desafio' : 'Lição guiada'}
                        </span>
                        <h1>{lesson.title || 'Lição sem título'}</h1>
                        {lesson.instruction && <Bubble kind={mascotKind} tone="info" message={lesson.instruction} />}
                        <button
                          type="button"
                          className="btn-primary bench-big-btn"
                          data-pad="next"
                          onClick={() => setIntro(false)}
                        >
                          Começar
                        </button>
                      </section>
                    )}
                    {!(bench && intro) && phase.type === 'quiz' && (
                      <QuizStep
                        key={phase.quiz.id}
                        quiz={phase.quiz}
                        onDone={next}
                        mascotKind={mascotKind}
                        onAnswer={(correct) => onEvent?.({ type: 'quiz', quizId: phase.quiz.id, correct })}
                        onPrediction={setPrediction}
                      />
                    )}
                    {!(bench && intro) && phase.type === 'explain' && (
                      <ExplainStep key={stepKey} step={phase.step} onDone={next} />
                    )}
                    {!(bench && intro) && phase.type === 'experiment' && (
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
                    {!(bench && intro) && phase.type === 'interact' && (
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
                    {!(bench && intro) && (phase.type === 'step' || phase.type === 'challenge') && (
                      <BuildStep
                        key={stepKey}
                        lesson={lesson}
                        stepIdx={phase.type === 'step' ? phase.idx : 0}
                        final={phase.type === 'challenge' || phase.step.action === 'connect_circuit'}
                        text={phase.type === 'step' ? phase.step.text : ''}
                        pieces={pieces}
                        setPieces={setPieces}
                        debugEnabled={debug ?? debugEnabled}
                        timeLimitS={phase.type === 'challenge' ? lesson.timeLimitS : null}
                        onDone={next}
                        onExpired={() => {
                          outcome.current.expired = true;
                        }}
                        mascotKind={mascotKind}
                        bench={bench}
                        autoBuild={bench && !livePieces && lesson.kind !== 'challenge' && phase.type === 'step'}
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
                </div>
              </div>
            </BoardSlotContext.Provider>
          </StepPartsContext.Provider>
        </BenchLiveContext.Provider>
      </BenchModeContext.Provider>
    </TutorVoiceContext.Provider>
  );
}

function LessonIntroVoice({ title, instruction, enabled }: { title: string; instruction: string; enabled: boolean }) {
  useSay([title, instruction], -1, enabled);
  return null;
}

/**
 * The part types a step asks the student to take from the tray: the pieces this step adds to the board (a guided
 * build step) or every part of the circuit (a challenge). null leaves the whole tray available.
 */
function partsForPhase(lesson: any, phase: any): Map<string, number> | null {
  const count = (types: string[]) => {
    const counts = new Map<string, number>();
    for (const t of types) counts.set(t, (counts.get(t) ?? 0) + 1);
    return counts.size ? counts : null;
  };
  if (!phase) return null;
  if (phase.type === 'challenge') {
    const start = new Set(startPieces(lesson).map((p) => p.id));
    return count(lesson.board.pieces.filter((p) => !start.has(p.id)).map((p) => p.type));
  }
  if (phase.type === 'experiment') {
    // An experiment comes with its board: parts are swapped by its own buttons (presets), so the tray shows
    // nothing, except the short-circuit one, which asks for a short jumper.
    const spec = phase.step.experiment;
    const shorts = spec?.goals?.some((g) => g.seen?.includes('short_cut'));
    return new Map(shorts && !spec?.presets?.length ? [['jumper_curto', 1]] : []);
  }
  if (phase.type !== 'step') return null;
  const before = new Set((phase.idx > 0 ? cumulativeBoard(lesson, phase.idx - 1) : []).map((p) => p.id));
  const added = cumulativeBoard(lesson, phase.idx).filter((p) => !before.has(p.id));
  if (added.length) return count(added.map((p) => p.type));
  const own = phase.step.pieceId && lesson.board.pieces.find((p) => p.id === phase.step.pieceId);
  return own ? count([own.type]) : null;
}

/** "o LED", "a bateria": the article for a part's name in the tutor's sentences. */
function withArticle(type: string, name: string) {
  const feminine = /^(bateria|capsula|chave)/.test(type) || /^(Bateria|Cápsula|Chave)/.test(name);
  return `${feminine ? 'a' : 'o'} ${name.charAt(0) === name.charAt(0).toUpperCase() && !/^[A-Z]{2}/.test(name) ? name.charAt(0).toLowerCase() + name.slice(1) : name}`;
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
  return <span className="player-audio-status">{text}</span>;
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
  const bench = useBenchMode();
  const [picked, setPicked] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const option = quiz.options.find((o) => o.id === picked);
  const correct = quiz.prediction ? !!option : verify ? !!verdict?.approved : picked === quiz.correctId;
  // While the validator checks the answer there is no verdict yet: the pick is neither right nor wrong.
  const checking = !!option && !quiz.prediction && !!verify && !verdict;
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
  const bubble = (
    <Bubble
      kind={mascotKind}
      tone={quiz.prediction || !option || (verify && !verdict) ? 'info' : correct ? 'ok' : 'erro'}
      message={msg}
    />
  );
  return (
    <>
      {!bench && bubble}
      <div className="panel quiz-card" style={{ maxWidth: 720, width: '100%' }}>
        <h2>{quiz.prompt}</h2>
        <div className="quiz-options" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {quiz.options.map((o) => (
            <button
              type="button"
              key={o.id}
              className="btn-outline"
              data-pad="item"
              disabled={correct || checking}
              aria-busy={checking && picked === o.id}
              style={{
                textAlign: 'left',
                background:
                  picked !== o.id
                    ? 'transparent'
                    : checking
                      ? 'var(--color-neutral-200)'
                      : correct
                        ? 'var(--color-accent-2-200)'
                        : 'var(--color-accent-200)',
              }}
              onClick={() => pick(o)}
            >
              {o.text}
            </button>
          ))}
        </div>
        {bench && option && <div className="quiz-feedback">{bubble}</div>}
        {correct && (
          <button type="button" className="btn-primary" data-pad="next" style={{ marginTop: 14 }} onClick={onDone}>
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
        <button type="button" className="btn-outline" data-pad="next" onClick={onDone}>
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
      {phase.step.text && (
        <p className="quiz-lead" style={{ margin: 0, maxWidth: 720, fontSize: 'calc(14px * var(--text-scale, 1))' }}>
          {phase.step.text}
        </p>
      )}
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
  autoBuild = false,
}) {
  const settings = lesson.settings;
  const [expired, setExpired] = useState(false);
  // Bench simulation of a guided lesson: the screen builds the step itself, one part at a time, announcing each
  // ("Vamos colocar o LED…") and waiting before it appears, so the student follows along. Challenges are by hand.
  const [placing, setPlacing] = useState<string | null>(null);
  const [autoDone, setAutoDone] = useState(!autoBuild);
  const [placedNames, setPlacedNames] = useState<string[]>([]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per step (the step remounts BuildStep)
  useEffect(() => {
    if (!autoBuild) return undefined;
    const have = new Set(pieces.map((p) => p.id));
    const missing = cumulativeBoard(lesson, stepIdx).filter((p) => !have.has(p.id));
    if (!missing.length) {
      setAutoDone(true);
      return undefined;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const ANNOUNCE_MS = 2600; // the announcement stays this long before the part appears
    const EACH_MS = 4200; // one part every this many ms
    missing.forEach((piece, i) => {
      const name = NOMES[piece.type] ?? piece.type;
      timers.push(
        setTimeout(() => setPlacing(`${i === 0 ? 'Vamos colocar' : 'Agora vamos colocar'} ${withArticle(piece.type, name)} na bancada…`), i * EACH_MS),
        setTimeout(() => {
          setPieces((cur) => [...cur.filter((p) => p.id !== piece.id), { ...piece }]);
          setPlacedNames((names) => [...names, name]);
        }, i * EACH_MS + ANNOUNCE_MS)
      );
    });
    timers.push(
      setTimeout(() => {
        setPlacing(null);
        setAutoDone(true);
      }, (missing.length - 1) * EACH_MS + ANNOUNCE_MS + 1200)
    );
    return () => timers.forEach(clearTimeout);
  }, []);
  const initial = useRef(pieces);
  const touched = pieces !== initial.current;
  const v = useStepValidation({ lesson, pieces, stepIdx, debug: debugEnabled });
  const lab = useLab(pieces, settings);
  // Bench: a step that adds no part (e.g. closing the circuit with everything already placed) needs no tray.
  const stepNeeds = useStepParts();
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
      setShown({ tone: toneFor(res.category), msg: challengeHint(lesson, pieces, misses, res.hint || res.message) });
    }
  }, [res, misses, lesson, pieces]);

  const looseLeft = pieces.some((p) => p.loose);
  // The circuit matches; the lesson may also want to see it work (energized and lit) with firm contacts.
  const built = !!res?.approved && !looseLeft;
  const working = lab.energized && diag.code === 'valido';
  const predictionBeforeExperiment = lesson.kind === 'guided' && lesson.quizzes.some((q) => q.prediction);
  const needsWork = final && !!settings?.requireLit && !predictionBeforeExperiment;
  const ready = built && (!needsWork || working);

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
  } else if (built && needsWork && !working) {
    tone = 'ok';
    msg = 'Montagem certa! Agora clique em Energizar e confira se funciona.';
  } else if (ready) {
    tone = 'ok';
    msg =
      !touched && final && lesson.kind === 'guided'
        ? 'Esta etapa está conferida. Observe a montagem e clique em Continuar.'
        : (shown?.msg ?? 'Muito bem!') + (working && !diag.limited ? ' Circuito fechado ✓' : '');
  } else if (shown && (touched || misses > 0 || res?.approved)) ({ tone, msg } = { tone: shown.tone, msg: shown.msg });

  if (autoBuild && placing) {
    tone = 'info';
    msg = placing;
  } else if (autoBuild && !autoDone) {
    tone = 'info';
    msg = text || msg;
  } else if (autoBuild && ready && placedNames.length) {
    tone = 'ok';
    msg = `Pronto! ${placedNames.join(' e ')} ${placedNames.length > 1 ? 'estão' : 'está'} no lugar. Vamos em frente ▶`;
  }

  // A timeout scores zero and permits continuing to the explanation in both player modes.
  const approved = ready && (bench || !expired) && autoDone;
  const fillAnswer = () =>
    setPieces(
      (lesson.kind === 'challenge' ? lesson.board.pieces : cumulativeBoard(lesson, stepIdx)).map((p) => ({ ...p }))
    );
  useSay([msg]);
  return (
    <div className="lab-step">
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
        energizeLocked={bench && !final}
        hideTray={bench && (approved || !stepNeeds || autoBuild)}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
        {!bench && (
          <button type="button" className="pill-link-btn muted" onClick={fillAnswer}>
            preencher com o gabarito
          </button>
        )}
        {(approved || expired) && (
          <button type="button" className="btn-primary" data-pad="next" onClick={onDone}>
            Continuar
          </button>
        )}
      </div>
    </div>
  );
}
