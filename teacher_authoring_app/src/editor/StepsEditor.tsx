import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { feedbackCatalog, lintLesson } from '../api/validator.ts';
import BoardWorkspace from '../components/BoardWorkspace.tsx';
import { BOARD_H, BOARD_W } from '../engine/board.ts';
import { NOMES } from '../engine/sim.ts';
import { newQuiz } from '../model/lesson.ts';
import {
  autoSplit,
  CATEGORIES,
  connectionStep,
  cumulativeBoard,
  newStep,
  overrideRows,
  reconcile,
  rowsToOverrides,
  stepText,
} from '../model/steps.ts';
import type { Piece } from '../model/types.ts';
import QuizEditor from './QuizEditor.tsx';

const field: CSSProperties = {
  width: '100%',
  border: '1px solid var(--color-divider)',
  borderRadius: 12,
  padding: '8px 10px',
  font: 'inherit',
  fontSize: 13,
  background: 'var(--color-neutral-100)',
  color: 'var(--color-text)',
  userSelect: 'text',
};
const ACTION_LABEL = {
  place_component: 'Colocar peça',
  place_connection: 'Colocar jumper',
  connect_circuit: 'Conectar circuito',
  interact: 'Pergunta',
};
const CATEGORY_LABEL = {
  missing_component: 'Falta uma peça',
  missing_connection: 'Falta um fio',
  excess_connection: 'Peça sobrando',
  excess_component: 'Peça sobrando',
  incorrect_connection: 'Ligação no lugar errado',
  reversed_polarity: 'Polaridade invertida',
  wrong_value: 'Valor errado',
  wrong_component: 'Peça errada',
  wrong_config: 'Cápsula com outro modo',
  misconnected_component: 'Peça presente, ligação incorreta',
  open_circuit: 'Circuito aberto',
  short_circuit: 'Curto-circuito',
};

/** Debounced advisory lint from graph_validator; `null` = not checked yet, `{offline}` = service down. */
function useLint(lesson) {
  const [lint, setLint] = useState(null);
  const _key = JSON.stringify([
    lesson.kind,
    lesson.board.pieces,
    lesson.steps,
    lesson.quizzes.map((q) => [q.id, q.correctId]),
  ]);
  useEffect(() => {
    if (lesson.steps.length === 0) {
      setLint(null);
      return undefined;
    }
    let live = true;
    const t = setTimeout(async () => {
      const r = await lintLesson(lesson);
      if (live) setLint(r.ok ? { byStep: r.byStep, problems: r.problems } : { offline: !!r.offline, error: r.error });
    }, 500);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.steps.length, lesson]);
  return lint;
}

function useCatalog() {
  const [cat, setCat] = useState(null);
  useEffect(() => {
    let live = true;
    feedbackCatalog().then((r) => {
      if (live && r.ok) setCat(r);
    });
    return () => {
      live = false;
    };
  }, []);
  return cat;
}

/** Passos de uma lição guiada (ou o tempo limite de um desafio). */
export default function StepsEditor({ lesson, setLesson, selected, setSelected }) {
  const set = (patch) => setLesson((l) => ({ ...l, ...patch }));
  const lint = useLint(lesson);
  const catalog = useCatalog();

  if (lesson.kind === 'challenge') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-600)' }}>
          No desafio só o circuito final é conferido, sem passos.
        </p>
        <label className="field-label" htmlFor="time-limit" style={{ margin: 0 }}>
          Tempo limite (segundos)
        </label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            id="time-limit"
            className="text-input"
            type="number"
            min="1"
            style={{ maxWidth: 140 }}
            value={lesson.timeLimitS == null ? '' : lesson.timeLimitS}
            placeholder="sem limite"
            onChange={(e) => set({ timeLimitS: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
          />
          {lesson.timeLimitS != null && (
            <button type="button" className="pill-link-btn muted" onClick={() => set({ timeLimitS: null })}>
              sem limite
            </button>
          )}
        </div>
      </div>
    );
  }

  const steps = lesson.steps;
  const { unassigned, dangling } = reconcile(lesson);
  const pieceById = new Map<string, Piece>(lesson.board.pieces.map((p) => [p.id, p]));
  const setSteps = (next) => set({ steps: next });
  const patchStep = (id, fn) => setSteps(steps.map((s) => (s.id === id ? fn(s) : s)));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next);
    if (selected === i) setSelected(j);
  };
  const remove = (i) => {
    setSteps(steps.filter((_, k) => k !== i));
    setSelected(null);
  };
  const generate = () => {
    if (
      steps.length &&
      !window.confirm('Gerar passos de novo vai substituir os passos atuais (textos e mensagens). Continuar?')
    )
      return;
    setSteps(autoSplit(lesson.board.pieces));
    setSelected(null);
  };
  const addMissing = () => {
    const more = autoSplit(unassigned).filter((s) => s.action !== 'connect_circuit');
    const circuitIndex = steps.findIndex((s) => s.action === 'connect_circuit');
    const next = [...steps];
    next.splice(circuitIndex < 0 ? steps.length : circuitIndex, 0, ...more);
    if (circuitIndex < 0 && lesson.board.pieces.length) next.push(connectionStep());
    setSteps(next);
  };
  const addCircuitCheck = () => {
    if (steps.some((s) => s.action === 'connect_circuit')) return;
    const interactionsAt = steps.findIndex((s) => s.action === 'interact');
    const next = [...steps];
    next.splice(interactionsAt < 0 ? next.length : interactionsAt, 0, connectionStep());
    setSteps(next);
  };
  const addInteract = (at = steps.length) => {
    const q = newQuiz('step');
    setLesson((l) => {
      const next = [...l.steps];
      next.splice(at, 0, newStep({ action: 'interact', quizId: q.id, text: 'Responda à pergunta.' }));
      return { ...l, quizzes: [...l.quizzes, q], steps: next };
    });
    setSelected(at);
  };
  const stepQuizzes = lesson.quizzes.filter((q) => q.position === 'step');
  const lintFor = (id) => (lint?.byStep ? lint.byStep.filter((m) => m.stepId === id).map((m) => m.message) : []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn-outline" disabled={lesson.board.pieces.length === 0} onClick={generate}>
          Gerar passos
        </button>
        <button type="button" className="btn-outline" onClick={() => addInteract()}>
          + Pergunta no final
        </button>
        <button
          type="button"
          className="btn-outline"
          onClick={addCircuitCheck}
          disabled={steps.some((s) => s.action === 'connect_circuit')}
        >
          + Conectar circuito
        </button>
      </div>
      {steps.length === 0 && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-600)' }}>
          Monte o circuito final na bancada e clique em “Gerar passos”. Sem passos, a lição é dividida automaticamente,
          peça por peça.
        </p>
      )}
      {steps.length > 0 && unassigned.length > 0 && (
        <p className="problems" style={{ margin: 0 }}>
          {unassigned.length} peça(s) da bancada sem passo.{' '}
          <button type="button" className="pill-link-btn" onClick={addMissing}>
            criar passos para elas
          </button>
        </p>
      )}
      {lint?.offline && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--color-neutral-600)' }}>
          Validador offline: a checagem avançada dos passos está indisponível (rode <code>npm run validator</code>).
        </p>
      )}
      {lint?.problems && lint.problems.length === 0 && steps.length > 0 && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--color-accent-2-700)' }}>
          Validador: passos corretos (uma ação por passo).
        </p>
      )}

      {steps.map((s, i) => {
        const piece = s.pieceId ? pieceById.get(s.pieceId) : null;
        const open = selected === i;
        const problems = lintFor(s.id);
        const isDangling = dangling.includes(s);
        return (
          <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div
              style={{
              background: 'var(--color-bg)',
              borderRadius: 20,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              outline: open ? '2px solid var(--color-accent)' : 'none',
              }}
            >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => setSelected(open ? null : i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  border: 0,
                  padding: 0,
                  background: 'transparent',
                  color: 'inherit',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <strong style={{ fontFamily: 'var(--font-heading)', fontSize: 14 }}>Passo {i + 1}</strong>
                <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>
                  {ACTION_LABEL[s.action]}
                  {piece ? ` · ${NOMES[piece.type]}` : ''}
                </span>
              </button>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  className="pill-link-btn muted"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  aria-label="Subir passo"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="pill-link-btn muted"
                  disabled={i === steps.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label="Descer passo"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="pill-link-btn muted"
                  onClick={() => remove(i)}
                  aria-label="Remover passo"
                >
                  ×
                </button>
              </span>
            </div>
            <input
              style={field}
              aria-label={`Texto do passo ${i + 1}`}
              value={s.text}
              placeholder={piece ? stepText(piece) : 'Texto do passo'}
              onChange={(e) => patchStep(s.id, (x) => ({ ...x, text: e.target.value }))}
            />
            {isDangling && (
              <p className="problems" style={{ margin: 0 }}>
                A peça deste passo não está mais na bancada. Exclua o passo.
              </p>
            )}
            {problems.map((m) => (
              <p key={m} className="problems" style={{ margin: 0 }}>
                {m}
              </p>
            ))}
            {open && (
              <StepDetails
                lesson={lesson}
                step={s}
                patch={(fn) => patchStep(s.id, fn)}
                catalog={catalog}
                stepQuizzes={stepQuizzes}
              />
            )}
            </div>
            <button
              type="button"
              className="pill-link-btn"
              style={{ alignSelf: 'center', fontSize: 13 }}
              onClick={() => addInteract(i + 1)}
              aria-label={`Adicionar pergunta depois do passo ${i + 1}`}
            >
              + Pergunta depois do passo {i + 1}
            </button>
          </div>
        );
      })}

      {selected != null && steps[selected] && <StepPreview lesson={lesson} idx={selected} />}

      {stepQuizzes.length > 0 && (
        <details open={selected != null && steps[selected]?.action === 'interact'}>
          <summary style={{ fontSize: 13, cursor: 'pointer' }}>Perguntas dos passos de interação</summary>
          <div style={{ marginTop: 8 }}>
            <QuizEditor quizzes={lesson.quizzes} onChange={(quizzes) => set({ quizzes })} only={['step']} />
          </div>
        </details>
      )}
    </div>
  );
}

function StepDetails({ lesson, step, patch, catalog, stepQuizzes }) {
  const rows = overrideRows(step.overrides);
  const setRows = (next) => patch((s) => ({ ...s, overrides: rowsToOverrides(next) }));
  const families = catalog ? catalog.families : [{ family: '*', name: 'qualquer peça' }];
  const defaultMsg = (category) => catalog?.categories.find((c) => c.category === category)?.defaultMessage || '';
  const usedByOthers = new Set(lesson.steps.filter((s) => s.id !== step.id && s.quizId).map((s) => s.quizId));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        borderTop: '1px solid var(--color-divider)',
        paddingTop: 10,
      }}
    >
      {step.action === 'interact' ? (
        <label style={{ fontSize: 13 }}>
          Pergunta deste passo
          <select
            style={{ ...field, marginTop: 4 }}
            value={step.quizId || ''}
            onChange={(e) => patch((s) => ({ ...s, quizId: e.target.value || null }))}
          >
            <option value="">— escolha —</option>
            {stepQuizzes
              .filter((q) => !usedByOthers.has(q.id))
              .map((q) => (
                <option key={q.id} value={q.id}>
                  {q.prompt || '(sem enunciado)'}
                </option>
              ))}
          </select>
        </label>
      ) : (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
          {(step.action === 'place_component' || step.action === 'connect_circuit') && (
            <label title="Exige o mesmo valor de resistor/potenciômetro">
              <input
                type="checkbox"
                checked={step.options.matchValues}
                onChange={(e) => patch((s) => ({ ...s, options: { ...s.options, matchValues: e.target.checked } }))}
              />{' '}
              Conferir valores
            </label>
          )}
          {step.action === 'connect_circuit' && (
            <label title="Desmarcado: as peças podem ficar em outras posições ou em outra ordem (em série ou em paralelo), desde que o circuito seja eletricamente equivalente.">
              <input
                type="checkbox"
                checked={!!step.options?.strictPositions}
                onChange={(e) => patch((s) => ({ ...s, options: { ...s.options, strictPositions: e.target.checked } }))}
              />{' '}
              Fixar posições como no gabarito
            </label>
          )}
          {step.action === 'place_connection' && (
            <span>
              Este passo confere apenas a presença do jumper; as ligações serão verificadas em “Conectar circuito”.
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <strong style={{ fontSize: 13 }}>Mensagens de ajuda deste passo</strong>
        {rows.length === 0 && (
          <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>Usando as mensagens padrão.</span>
        )}
        {rows.map((r, i) => (
          <div key={`${r.category}:${r.family}`} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                style={field}
                aria-label="Quando"
                value={r.category}
                onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, category: e.target.value } : x)))}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
              <select
                style={field}
                aria-label="Peça"
                value={r.family}
                onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, family: e.target.value } : x)))}
              >
                <option value="*">qualquer peça</option>
                {families
                  .filter((f) => f.family !== '*')
                  .map((f) => (
                    <option key={f.family} value={f.family}>
                      {f.name.replace(/^(o|a) /, '')}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="pill-link-btn muted"
                onClick={() => setRows(rows.filter((_, k) => k !== i))}
                aria-label="Remover mensagem"
              >
                ×
              </button>
            </div>
            <input
              style={field}
              aria-label="Mensagem"
              value={r.text}
              placeholder={defaultMsg(r.category) || 'Mensagem para o aluno'}
              onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))}
            />
          </div>
        ))}
        {step.action !== 'interact' && (
          <button
            type="button"
            className="pill-link-btn"
            style={{ alignSelf: 'flex-start', fontSize: 13 }}
            onClick={() =>
              setRows([
                ...rows.filter((r) => !(r.category === 'reversed_polarity' && r.family === '*')),
                { category: 'reversed_polarity', family: '*', text: '' },
              ])
            }
          >
            + mensagem
          </button>
        )}
      </div>
    </div>
  );
}

/** Read-only cumulative board after the selected step, scaled down. */
function StepPreview({ lesson, idx }) {
  const scale = 0.62;
  const pieces = useMemo(() => cumulativeBoard(lesson, idx, lesson.steps), [lesson, idx]);
  const hl = useMemo(() => new Set(lesson.steps[idx].pieceId ? [lesson.steps[idx].pieceId] : []), [lesson, idx]);
  return (
    <div>
      <strong style={{ fontSize: 13 }}>Bancada ao fim do passo {idx + 1}</strong>
      <div style={{ width: BOARD_W * scale, height: BOARD_H * scale, overflow: 'hidden', marginTop: 6 }}>
        <div
          style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: BOARD_W, pointerEvents: 'none' }}
        >
          <BoardWorkspace pieces={pieces} onChange={() => {}} readOnly highlightIds={hl} />
        </div>
      </div>
    </div>
  );
}
