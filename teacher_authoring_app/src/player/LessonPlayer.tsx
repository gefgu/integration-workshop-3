import { useEffect, useMemo, useRef, useState } from 'react';
import { validateStep } from '../api/validator.ts';
import BoardWorkspace from '../components/BoardWorkspace.tsx';
import Bubble from '../components/Bubble.tsx';
import { useCapsules } from '../components/useCapsules.ts';
import { mergeTrails } from '../engine/capsules.ts';
import { diagnose } from '../engine/diagnose.ts';
import { capsuleConfig, formatOhms, isCapsule, NOMES } from '../engine/sim.ts';
import { cumulativeBoard, effectiveSteps } from '../model/steps.ts';

const PRAISE = ['Boa!', 'Isso aí!', 'Mandou bem!', 'Perfeito!', 'Show!', 'Exato!'];
const praise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];

function buildPhases(lesson) {
  const quiz = (pos) => lesson.quizzes.filter((q) => q.position === pos).map((q) => ({ type: 'quiz', quiz: q }));
  let middle = [];
  if (lesson.kind === 'challenge') {
    if (lesson.board.pieces.length > 0) middle = [{ type: 'challenge' }];
  } else {
    middle = effectiveSteps(lesson).map((step, idx) =>
      step.action === 'interact'
        ? { type: 'interact', idx, step, quiz: lesson.quizzes.find((q) => q.id === step.quizId) }
        : { type: 'step', idx, step }
    );
  }
  return [...quiz('before'), ...middle, ...quiz('after'), { type: 'done' }];
}

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
      ? `Potenciômetro ${formatOhms(piece.value)}`
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

/** "Testar": roda a lição como o aluno veria — perguntas, passos de montagem validados pelo graph_validator. */
export default function LessonPlayer({ lesson, onExit, mascotKind }) {
  const phases = useMemo(() => buildPhases(lesson), [lesson]);
  const [idx, setIdx] = useState(0);
  const [pieces, setPieces] = useState([]); // the student's board, kept across steps
  const [debugEnabled, setDebugEnabled] = useState(false);
  const phase = phases[idx];
  const next = () => setIdx((i) => Math.min(i + 1, phases.length - 1));
  const steps = phases.length - 1;
  const restart = () => {
    setPieces([]);
    setIdx(0);
  };
  const stepKey = phase.type === 'step' || phase.type === 'interact' ? phase.step.id : 'challenge';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', margin: 0, fontSize: 20 }}>
          {lesson.title || 'Lição sem título'}
        </h2>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>
          {phase.type === 'done' ? 'Concluída' : `Etapa ${idx + 1} de ${steps}`}
        </span>
        <button type="button" className="btn-outline" onClick={onExit}>
          Voltar ao editor
        </button>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={debugEnabled} onChange={(e) => setDebugEnabled(e.target.checked)} />
          Depurar validação
        </label>
      </div>
      {lesson.instruction && (
        <p style={{ margin: 0, maxWidth: 720, fontSize: 14, lineHeight: 1.5 }}>{lesson.instruction}</p>
      )}

      {phase.type === 'quiz' && (
        <QuizStep key={phase.quiz.id} quiz={phase.quiz} onDone={next} mascotKind={mascotKind} />
      )}
      {phase.type === 'interact' && (
        <InteractStep
          key={stepKey}
          lesson={lesson}
          phase={phase}
          pieces={pieces}
          onDone={next}
          mascotKind={mascotKind}
        />
      )}
      {(phase.type === 'step' || phase.type === 'challenge') && (
        <BuildStep
          key={stepKey}
          lesson={lesson}
          stepIdx={phase.type === 'step' ? phase.idx : 0}
          text={phase.type === 'step' ? phase.step.text : ''}
          pieces={pieces}
          setPieces={setPieces}
          debugEnabled={debugEnabled}
          timeLimitS={phase.type === 'challenge' ? lesson.timeLimitS : null}
          onDone={next}
          mascotKind={mascotKind}
        />
      )}
      {phase.type === 'done' && (
        <>
          <Bubble kind={mascotKind} tone="ok" message="Lição concluída! É assim que o aluno vai passar por ela." />
          <button type="button" className="btn-primary" onClick={restart}>
            Testar de novo
          </button>
        </>
      )}
    </div>
  );
}

/** `verify(optionId)` (optional): async server-side check returning { approved, message }. */
function QuizStep({
  quiz,
  onDone,
  mascotKind,
  verify,
}: {
  quiz: any;
  onDone: () => void;
  mascotKind: string;
  verify?: (id: string) => Promise<any>;
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

  async function pick(o) {
    setPicked(o.id);
    if (verify) {
      setVerdict(null);
      setVerdict(await verify(o.id));
    }
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
function InteractStep({ lesson, phase, pieces, onDone, mascotKind }) {
  const quiz = phase.quiz;
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

function BuildStep({ lesson, stepIdx, text, pieces, setPieces, debugEnabled, timeLimitS, onDone, mascotKind }) {
  const [energized, setEnergized] = useState(false);
  const [held, setHeld] = useState<Set<string>>(() => new Set());
  const [expired, setExpired] = useState(false);
  const initial = useRef(pieces);
  const touched = pieces !== initial.current;
  const press = (id, down) =>
    setHeld((h) => {
      const n = new Set(h);
      if (down) n.add(id);
      else n.delete(id);
      return n;
    });
  const v = useStepValidation({ lesson, pieces, stepIdx, debug: debugEnabled });
  const diag = diagnose(pieces, held);
  const cap = useCapsules(pieces, held, energized);

  // The bubble shows the step's instruction until the student touches the board, then the
  // validator's message — a hint only arrives when the graph actually changed (SFR7).
  const [shown, setShown] = useState(null);
  const res = v.status === 'ok' ? v.result : null;
  useEffect(() => {
    if (!res) return;
    if (res.approved) setShown({ tone: 'ok', msg: res.message });
    else if (touched && res.hint) setShown({ tone: toneFor(res.category), msg: res.hint });
  }, [res, touched]);

  let tone = 'info',
    msg = text || 'Monte o circuito.';
  if (expired) {
    tone = 'erro';
    msg = 'O tempo acabou! Clique em “Testar de novo” para tentar outra vez.';
  } else if (v.status === 'offline') {
    tone = 'erro';
    msg = 'Validador offline. Inicie o serviço (npm run validator) e tente de novo.';
  } else if (v.status === 'error') {
    tone = 'erro';
    msg = v.error + (v.problems?.length ? ` ${v.problems.join(' ')}` : '');
  } else if (shown && (touched || res?.approved)) ({ tone, msg } = { tone: shown.tone, msg: shown.msg });

  const approved = !!res?.approved && !expired;
  const fillAnswer = () =>
    setPieces(
      (lesson.kind === 'challenge' ? lesson.board.pieces : cumulativeBoard(lesson, stepIdx)).map((p) => ({ ...p }))
    );
  const valid = diag.code === 'valido';
  const lit = energized && (valid || !!cap.driven);
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
      <BoardWorkspace
        pieces={pieces}
        onChange={setPieces}
        trail={lit ? mergeTrails(valid ? diag.trail : null, cap.driven) : null}
        ledMa={lit ? Math.max(valid ? diag.mA : 0, cap.drivenMa) : 0}
        readings={cap.readings}
        pressed={held}
        onPress={press}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setEnergized((e) => !e)}
          style={{
            border: 0,
            cursor: 'pointer',
            fontFamily: 'var(--font-heading)',
            fontSize: 16,
            padding: '14px 30px',
            borderRadius: 999,
            background: energized ? 'var(--color-neutral-700)' : 'var(--color-accent)',
            color: 'var(--color-bg)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {energized ? 'Desligar' : 'Energizar'}
        </button>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: lit ? 'var(--color-accent-2-700)' : 'var(--color-neutral-600)',
          }}
        >
          {energized ? (lit ? `${diag.mA.toFixed(1)} mA no LED` : 'Sem corrente') : 'Bancada desligada'}
        </span>
        {timeLimitS != null && (
          <Countdown seconds={timeLimitS} running={!expired && !approved} onExpire={() => setExpired(true)} />
        )}
        <button type="button" className="pill-link-btn muted" onClick={fillAnswer}>
          preencher com o gabarito
        </button>
        {approved && (
          <button type="button" className="btn-primary" onClick={onDone}>
            Continuar
          </button>
        )}
      </div>
    </>
  );
}
