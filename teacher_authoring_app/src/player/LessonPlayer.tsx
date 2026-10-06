import { useEffect, useMemo, useRef, useState } from 'react';
import { validateStep } from '../api/validator.ts';
import BoardWorkspace from '../components/BoardWorkspace.tsx';
import Bubble from '../components/Bubble.tsx';
import { diagnose } from '../engine/diagnose.ts';
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
function useStepValidation({ lesson, pieces, stepIdx, answer = null }) {
  const prevHash = useRef(null);
  const seq = useRef(0);
  const [state, setState] = useState<any>({ status: 'checking' });
  const [_tries, setTries] = useState(0);
  useEffect(() => {
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      const r = await validateStep({ lesson, pieces, stepIdx, previousHash: prevHash.current, answer });
      if (mine !== seq.current) return;
      if (r.ok === true) {
        prevHash.current = r.result.graphHash;
        setState({ status: 'ok', result: r.result });
      } else setState({ status: r.offline ? 'offline' : 'error', error: r.error, problems: r.problems });
    }, 250);
    return () => clearTimeout(t);
  }, [lesson, pieces, stepIdx, answer]);
  return {
    ...state,
    retry: () => {
      setState({ status: 'checking' });
      setTries((n) => n + 1);
    },
  };
}

const toneFor = (category) => (category === 'missing_component' || category === 'missing_connection' ? 'obs' : 'erro');

/** "Testar": roda a lição como o aluno veria — perguntas, passos de montagem validados pelo graph_validator. */
export default function LessonPlayer({ lesson, onExit, mascotKind }) {
  const phases = useMemo(() => buildPhases(lesson), [lesson]);
  const [idx, setIdx] = useState(0);
  const [pieces, setPieces] = useState([]); // the student's board, kept across steps
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

function BuildStep({ lesson, stepIdx, text, pieces, setPieces, timeLimitS, onDone, mascotKind }) {
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
  const v = useStepValidation({ lesson, pieces, stepIdx });
  const diag = diagnose(pieces, held);

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
  const lit = energized && diag.code === 'valido';
  return (
    <>
      <Bubble kind={mascotKind} tone={tone} message={msg} />
      {v.status === 'offline' && (
        <button type="button" className="btn-outline" onClick={v.retry}>
          Tentar de novo
        </button>
      )}
      <BoardWorkspace
        pieces={pieces}
        onChange={setPieces}
        trail={lit ? diag.trail : null}
        ledMa={lit ? diag.mA : 0}
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
