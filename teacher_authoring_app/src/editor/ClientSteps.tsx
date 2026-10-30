import type { CSSProperties } from 'react';
import Illustration from '../components/Illustration.tsx';
import { newQuiz } from '../model/lesson.ts';
import { newStep } from '../model/steps.ts';
import type { LabGoal, Lesson, LessonStep, Piece } from '../model/types.ts';

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
const MAX_SVG = 60_000;

/** Missions a teacher can pick from, in plain language. `n` asks for a number (how many variations). */
export const MISSION_KINDS: { id: string; label: string; goal: Partial<LabGoal>; n?: keyof LabGoal }[] = [
  { id: 'lit', label: 'Energizar e ver a luz (ou o buzzer) funcionar', goal: { seen: ['lit'] } },
  { id: 'status', label: 'O LED de status da bancada acende (bateria encaixada)', goal: { now: ['status_led'] } },
  { id: 'pressed', label: 'Apertar o botão e ver acender', goal: { seen: ['pressed_lit'] } },
  { id: 'released', label: 'Soltar o botão e ver apagar', goal: { seen: ['released_dark'] } },
  { id: 'partial', label: 'Apertar só um de dois botões e ver que continua apagado', goal: { seen: ['partial_dark'] } },
  { id: 'reversed', label: 'Ver o LED invertido ficar apagado', goal: { seen: ['reversed_dark'] } },
  { id: 'low', label: 'Levar o potenciômetro ao lado de MENOS resistência', goal: { seen: ['pot_low'] } },
  { id: 'high', label: 'Levar o potenciômetro ao lado de MAIS resistência', goal: { seen: ['pot_high'] } },
  { id: 'fade', label: 'Desligar e ver o LED apagar aos poucos (capacitor)', goal: { seen: ['faded'] } },
  { id: 'flicker', label: 'Ver a luz piscar (mau contato)', goal: { seen: ['flicker'] } },
  { id: 'seated', label: 'Encaixar uma peça “solta” clicando nela', goal: { seen: ['seated'] } },
  { id: 'firm', label: 'Circuito aceso e firme, sem peça solta', goal: { now: ['lit', 'no_loose'] } },
  { id: 'short', label: 'Provocar um curto e ver a bancada cortar a energia', goal: { seen: ['short_cut'] } },
  { id: 'noshort', label: 'Circuito funcionando, sem curto', goal: { now: ['no_short', 'lit'] } },
  { id: 'buzz', label: 'Escutar o buzzer tocar', goal: { seen: ['buzzed'] } },
  { id: 'both', label: 'LED e buzzer funcionando ao mesmo tempo', goal: { seen: ['both_on'] } },
  { id: 'clipA', label: 'Escutar o clipe A', goal: { seen: ['heard_a'] } },
  { id: 'clipB', label: 'Escutar o clipe B', goal: { seen: ['heard_b'] } },
  { id: 'presetsLit', label: 'Ver funcionando N variações (troque e energize)', goal: {}, n: 'presetsLit' },
  { id: 'presetsFaded', label: 'Ver N variações apagarem depois de desligar', goal: {}, n: 'presetsFaded' },
];

function kindOf(g: LabGoal): string {
  const same = (a?: string[], b?: string[]) => (a ?? []).slice().sort().join() === (b ?? []).slice().sort().join();
  const hit = MISSION_KINDS.find(
    (k) =>
      (k.n ? g[k.n] != null : false) ||
      (!k.n && same(k.goal.seen, g.seen) && same(k.goal.now, g.now) && (k.goal.seen || k.goal.now))
  );
  return hit?.id ?? 'lit';
}

/** Adds an explanation or an experiment (and a question) at the end of the steps. */
export function AddClientButtons({
  lesson,
  setLesson,
  select,
}: {
  lesson: Lesson;
  setLesson: (fn: (l: Lesson) => Lesson) => void;
  select: (index: number) => void;
}) {
  const add = (step: LessonStep, quizPatch?: (l: Lesson) => Lesson) => {
    setLesson((l) => {
      const next = quizPatch ? quizPatch(l) : l;
      return { ...next, steps: [...next.steps, step] };
    });
    select(lesson.steps.length);
  };
  return (
    <>
      <button
        type="button"
        className="btn-outline"
        title="Um cartão com título, texto e uma ilustração: explica o conceito antes ou depois de uma atividade."
        onClick={() => add(newStep({ action: 'explain', title: '', text: '' }))}
      >
        + Explicação
      </button>
      <button
        type="button"
        className="btn-outline"
        title="Um laboratório simulado: o aluno muda algo na bancada e cumpre missões observando o que acontece."
        onClick={() =>
          add(
            newStep({
              action: 'experiment',
              title: '',
              text: '',
              experiment: { goals: [{ id: 'm1', label: 'Energize e veja o circuito funcionar.', seen: ['lit'] }] },
            })
          )
        }
      >
        + Experimento
      </button>
      <button
        type="button"
        className="btn-outline"
        title="Peça uma previsão antes do experimento e confira a resposta depois."
        onClick={() => {
          const q = newQuiz('step');
          add(newStep({ action: 'interact', quizId: q.id, text: 'Responda à pergunta.' }), (l) => ({
            ...l,
            quizzes: [...l.quizzes, q],
          }));
        }}
      >
        + Pergunta
      </button>
    </>
  );
}

/** Editing form for an `explain` or `experiment` step. */
export function ClientStepForm({
  lesson,
  step,
  patch,
}: {
  lesson: Lesson;
  step: LessonStep;
  patch: (fn: (s: LessonStep) => LessonStep) => void;
}) {
  if (step.action === 'explain') return <ExplainForm step={step} patch={patch} />;
  return <ExperimentForm lesson={lesson} step={step} patch={patch} />;
}

function ExplainForm({ step, patch }) {
  async function pickSvg(file: File | undefined) {
    if (!file) return;
    const svg = await file.text();
    if (!svg.trim().startsWith('<svg') || svg.length > MAX_SVG) {
      window.alert('Use um arquivo .svg (começando em <svg>) de até 60 KB.');
      return;
    }
    patch((s) => ({ ...s, illustration: { svg, alt: s.illustration?.alt ?? '', caption: s.illustration?.caption } }));
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        style={field}
        aria-label="Título da explicação"
        placeholder="Título (ex.: O que é um nó?)"
        value={step.title ?? ''}
        onChange={(e) => patch((s) => ({ ...s, title: e.target.value }))}
      />
      <textarea
        style={field}
        rows={6}
        aria-label="Texto da explicação"
        placeholder="Explique em palavras simples. Deixe uma linha em branco entre os parágrafos."
        value={step.text}
        onChange={(e) => patch((s) => ({ ...s, text: e.target.value }))}
      />
      <label
        style={{ fontSize: 13 }}
        title="Mostra uma bancada em que o aluno toca num furo e vê todos os furos do mesmo nó acenderem."
      >
        <input
          type="checkbox"
          checked={step.widget === 'nodes'}
          onChange={(e) => patch((s) => ({ ...s, widget: e.target.checked ? 'nodes' : null }))}
        />{' '}
        Incluir o explorador de nós (toque num furo e veja o nó)
      </label>
      {step.illustration ? (
        <>
          <Illustration art={step.illustration} />
          <input
            style={field}
            aria-label="Descrição da ilustração para leitores de tela"
            placeholder="Descrição da ilustração (acessibilidade)"
            value={step.illustration.alt}
            onChange={(e) => patch((s) => ({ ...s, illustration: { ...s.illustration, alt: e.target.value } }))}
          />
          <input
            style={field}
            aria-label="Legenda da ilustração"
            placeholder="Legenda (opcional)"
            value={step.illustration.caption ?? ''}
            onChange={(e) => patch((s) => ({ ...s, illustration: { ...s.illustration, caption: e.target.value } }))}
          />
          <button
            type="button"
            className="pill-link-btn muted"
            onClick={() => patch((s) => ({ ...s, illustration: null }))}
          >
            remover ilustração
          </button>
        </>
      ) : (
        <label style={{ fontSize: 13 }}>
          Ilustração (arquivo .svg, até 60 KB; fica salva com a lição e funciona sem internet){' '}
          <input type="file" accept=".svg,image/svg+xml" onChange={(e) => pickSvg(e.target.files?.[0])} />
        </label>
      )}
    </div>
  );
}

function ExperimentForm({ lesson, step, patch }) {
  const spec = step.experiment ?? { goals: [] };
  const setSpec = (fn) => patch((s) => ({ ...s, experiment: fn(s.experiment ?? { goals: [] }) }));
  const pots: Piece[] = (spec.board ?? lesson.board.pieces).filter((p) => p.type === 'potenciometro');
  const setGoal = (i: number, next: LabGoal) =>
    setSpec((e) => ({ ...e, goals: e.goals.map((g, k) => (k === i ? next : g)) }));
  const clone = (pieces: Piece[]) => pieces.map((p) => ({ ...p }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        style={field}
        aria-label="Título do experimento"
        placeholder="Título (ex.: Troque o resistor e compare)"
        value={step.title ?? ''}
        onChange={(e) => patch((s) => ({ ...s, title: e.target.value }))}
      />
      <textarea
        style={field}
        rows={2}
        aria-label="Instrução do experimento"
        placeholder="O que o aluno deve fazer e observar."
        value={step.text}
        onChange={(e) => patch((s) => ({ ...s, text: e.target.value }))}
      />
      <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <strong>Bancada do experimento</strong>
        <label>
          <input
            type="radio"
            name={`board-${step.id}`}
            checked={!spec.board}
            onChange={() => setSpec(({ board: _b, ...rest }) => rest)}
          />{' '}
          Continuar com a bancada que o aluno montou
        </label>
        <label>
          <input
            type="radio"
            name={`board-${step.id}`}
            checked={!!spec.board}
            disabled={lesson.board.pieces.length === 0}
            onChange={() => setSpec((e) => ({ ...e, board: clone(lesson.board.pieces) }))}
          />{' '}
          Começar com o circuito da lição já montado ({lesson.board.pieces.length} peças)
        </label>
        {spec.board && (
          <button
            type="button"
            className="pill-link-btn"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => setSpec((e) => ({ ...e, board: clone(lesson.board.pieces) }))}
          >
            atualizar com a bancada atual do editor
          </button>
        )}
      </div>

      <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <strong>Variações para comparar (opcional)</strong>
        <span style={{ color: 'var(--color-neutral-600)' }}>
          Cada variação é a bancada do editor naquele momento (ex.: com o resistor de 220 Ω; depois troque por 1 kΩ e
          adicione outra).
        </span>
        {(spec.presets ?? []).map((p, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: presets have no id; the label is editable
          <div key={`${p.label}-${i}`} style={{ display: 'flex', gap: 6 }}>
            <input
              style={field}
              aria-label={`Nome da variação ${i + 1}`}
              value={p.label}
              onChange={(e) =>
                setSpec((x) => ({
                  ...x,
                  presets: x.presets.map((q, k) => (k === i ? { ...q, label: e.target.value } : q)),
                }))
              }
            />
            <button
              type="button"
              className="pill-link-btn muted"
              aria-label="Remover variação"
              onClick={() => setSpec((x) => ({ ...x, presets: x.presets.filter((_, k) => k !== i) }))}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="pill-link-btn"
          style={{ alignSelf: 'flex-start' }}
          disabled={lesson.board.pieces.length === 0}
          onClick={() =>
            setSpec((x) => ({
              ...x,
              presets: [
                ...(x.presets ?? []),
                { label: `Variação ${(x.presets?.length ?? 0) + 1}`, pieces: clone(lesson.board.pieces) },
              ],
            }))
          }
        >
          + variação com a bancada atual do editor
        </button>
      </div>

      {pots.length > 0 && (
        <label style={{ fontSize: 13 }}>
          <input
            type="checkbox"
            checked={!!spec.slider}
            onChange={(e) =>
              setSpec(({ slider: _s, ...rest }) =>
                e.target.checked
                  ? { ...rest, slider: { pieceId: pots[0].id, label: 'Resistência do potenciômetro' } }
                  : rest
              )
            }
          />{' '}
          Dar ao aluno um controle deslizante contínuo para o potenciômetro
        </label>
      )}
      <label
        style={{ fontSize: 13 }}
        title="Dois sons simulados (sem mostrar o valor) para o aluno comparar e responder numa pergunta."
      >
        <input
          type="checkbox"
          checked={!!spec.clips}
          onChange={(e) =>
            setSpec(({ clips: _c, ...rest }) => (e.target.checked ? { ...rest, clips: { a: 1000, b: 220 } } : rest))
          }
        />{' '}
        Usar dois clipes de som simulados (resistor A × resistor B)
      </label>
      {spec.clips && (
        <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
          {(['a', 'b'] as const).map((k) => (
            <label key={k}>
              Clipe {k.toUpperCase()} (Ω){' '}
              <input
                style={{ ...field, width: 90 }}
                type="number"
                min={50}
                value={spec.clips[k]}
                onChange={(e) => setSpec((x) => ({ ...x, clips: { ...x.clips, [k]: Number(e.target.value) } }))}
              />
            </label>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <strong style={{ fontSize: 13 }}>Missões (o aluno só continua quando cumprir todas)</strong>
        {spec.goals.map((g, i) => {
          const kind = MISSION_KINDS.find((k) => k.id === kindOf(g)) ?? MISSION_KINDS[0];
          return (
            <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <input
                style={field}
                aria-label={`Texto da missão ${i + 1}`}
                value={g.label}
                placeholder="Texto que o aluno lê"
                onChange={(e) => setGoal(i, { ...g, label: e.target.value })}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <select
                  style={field}
                  aria-label={`Condição da missão ${i + 1}`}
                  value={kind.id}
                  onChange={(e) => {
                    const k = MISSION_KINDS.find((x) => x.id === e.target.value);
                    const base: LabGoal = { id: g.id, label: g.label };
                    setGoal(i, k.n ? { ...base, [k.n]: 2 } : { ...base, ...k.goal });
                  }}
                >
                  {MISSION_KINDS.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </select>
                {kind.n && (
                  <input
                    style={{ ...field, width: 70 }}
                    type="number"
                    min={1}
                    aria-label="Quantidade"
                    value={Number(g[kind.n] ?? 2)}
                    onChange={(e) => setGoal(i, { ...g, [kind.n]: Math.max(1, Number(e.target.value)) })}
                  />
                )}
                <button
                  type="button"
                  className="pill-link-btn muted"
                  aria-label="Remover missão"
                  onClick={() => setSpec((x) => ({ ...x, goals: x.goals.filter((_, k) => k !== i) }))}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
        <button
          type="button"
          className="pill-link-btn"
          style={{ alignSelf: 'flex-start', fontSize: 13 }}
          onClick={() =>
            setSpec((x) => ({
              ...x,
              goals: [
                ...x.goals,
                { id: `m${x.goals.length + 1}-${Date.now().toString(36)}`, label: '', seen: ['lit'] },
              ],
            }))
          }
        >
          + missão
        </button>
        <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
          O experimento é simulado no software: o app confere as missões; a câmera e o hardware não participam.
        </span>
      </div>
    </div>
  );
}

/** Challenge lessons: what happens after the build (explanations, experiments and questions). */
export function ChallengeSteps({
  lesson,
  setLesson,
  selected,
  setSelected,
}: {
  lesson: Lesson;
  setLesson: (fn: (l: Lesson) => Lesson) => void;
  selected: number | null;
  setSelected: (i: number | null) => void;
}) {
  const patchStep = (id: string, fn: (s: LessonStep) => LessonStep) =>
    setLesson((l) => ({ ...l, steps: l.steps.map((s) => (s.id === id ? fn(s) : s)) }));
  const move = (i: number, d: number) =>
    setLesson((l) => {
      const j = i + d;
      if (j < 0 || j >= l.steps.length) return l;
      const next = [...l.steps];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...l, steps: next };
    });
  const remove = (i: number) => {
    setLesson((l) => {
      const removed = l.steps[i];
      const steps = l.steps.filter((_, k) => k !== i);
      const orphan = removed.quizId && !steps.some((s) => s.quizId === removed.quizId);
      return { ...l, steps, quizzes: orphan ? l.quizzes.filter((q) => q.id !== removed.quizId) : l.quizzes };
    });
    setSelected(null);
  };
  const LABEL = { explain: 'Explicação', experiment: 'Experimento', interact: 'Pergunta' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-600)' }}>
        O aluno monta o circuito (só o resultado final é conferido). Depois você pode acrescentar explicações,
        experimentos e perguntas — por exemplo, para prever, testar e conferir.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <AddClientButtons lesson={lesson} setLesson={setLesson} select={setSelected} />
      </div>
      {lesson.steps.map((s, i) => (
        <div
          key={s.id}
          style={{
            background: 'var(--color-bg)',
            borderRadius: 20,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            outline: selected === i ? '2px solid var(--color-accent)' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              style={{
                border: 0,
                padding: 0,
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'inherit',
              }}
              onClick={() => setSelected(selected === i ? null : i)}
            >
              <strong style={{ fontFamily: 'var(--font-heading)', fontSize: 14 }}>Depois da montagem · {i + 1}</strong>{' '}
              <span style={{ fontSize: 12 }}>
                {LABEL[s.action] ?? s.action}
                {s.title ? ` — ${s.title}` : ''}
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
                disabled={i === lesson.steps.length - 1}
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
          {selected === i && s.action !== 'interact' && (
            <ClientStepForm lesson={lesson} step={s} patch={(fn) => patchStep(s.id, fn)} />
          )}
          {selected === i && s.action === 'interact' && (
            <span style={{ fontSize: 13 }}>Edite a pergunta em “Perguntas dos passos”, abaixo.</span>
          )}
        </div>
      ))}
    </div>
  );
}
