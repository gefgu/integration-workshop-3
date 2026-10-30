import { useState } from 'react';
import { NOMES, TYPES } from '../engine/sim.ts';
import { FAULTS, type Fault, makeStart } from '../model/start.ts';
import type { Lesson, LessonSettings } from '../model/types.ts';

const FLAGS: { key: keyof LessonSettings; label: string; hint: string }[] = [
  {
    key: 'requireLit',
    label: 'O aluno precisa energizar e ver o circuito funcionando para continuar',
    hint: 'Vale na conferência final da montagem.',
  },
  {
    key: 'allowNoResistor',
    label: 'Permitir LED sem resistor (simplificação didática)',
    hint: 'A simulação limita a corrente em 15 mA. Use só em lições que ainda não apresentaram o resistor.',
  },
  {
    key: 'statusLed',
    label: 'Mostrar o LED de status da bancada',
    hint: 'Acende quando há bateria encaixada (simulado na tela).',
  },
  {
    key: 'matchValues',
    label: 'Na conferência final, exigir os mesmos valores (resistor, potenciômetro)',
    hint: '',
  },
];

/** Notes, labels, behaviour switches, the parts on offer and the starting bench of a lesson. */
export default function LessonOptions({
  lesson,
  setLesson,
}: {
  lesson: Lesson;
  setLesson: (fn: (l: Lesson) => Lesson) => void;
}) {
  const settings = lesson.settings ?? {};
  const setSettings = (patch: Partial<LessonSettings>) =>
    setLesson((l) => {
      const next: LessonSettings = { ...(l.settings ?? {}), ...patch };
      for (const k of Object.keys(next)) if (next[k] === false || next[k] === undefined) delete next[k];
      return { ...l, settings: Object.keys(next).length ? next : undefined };
    });
  const [faults, setFaults] = useState<Fault[]>([]);
  const [note, setNote] = useState('');
  const tray = settings.tray;

  function applyFaults() {
    const { start, skipped } = makeStart(lesson.board.pieces, faults);
    setLesson((l) => ({ ...l, start }));
    setNote(
      skipped.length
        ? `Bancada inicial criada. Não deu para aplicar: ${skipped.map((f) => FAULTS.find((x) => x.id === f)?.label).join(', ')}.`
        : `Bancada inicial criada com ${start.pieces.length} peças.`
    );
  }

  return (
    <details style={{ marginTop: 12 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Opções avançadas, bancada inicial e notas</summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
        <label className="field-label" htmlFor="teacher-notes">
          Notas para o professor
        </label>
        <textarea
          id="teacher-notes"
          className="text-input"
          rows={4}
          value={lesson.teacherNotes ?? ''}
          placeholder="Objetivo, critério de sucesso, o que é simulado, observações. Só o professor vê."
          onChange={(e) => setLesson((l) => ({ ...l, teacherNotes: e.target.value || undefined }))}
        />
        <label className="field-label" htmlFor="tags">
          Etiquetas (separadas por vírgula)
        </label>
        <input
          id="tags"
          className="text-input"
          defaultValue={(lesson.tags ?? []).join(', ')}
          key={lesson.id}
          placeholder="ex.: guiada, previsão, experimento"
          onBlur={(e) =>
            setLesson((l) => {
              const tags = e.target.value
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean);
              return { ...l, tags: tags.length ? tags : undefined };
            })
          }
        />

        <strong style={{ fontSize: 13 }}>Comportamento</strong>
        {FLAGS.map((f) => (
          <label key={f.key} style={{ fontSize: 13 }} title={f.hint}>
            <input
              type="checkbox"
              checked={!!settings[f.key]}
              onChange={(e) => setSettings({ [f.key]: e.target.checked })}
            />{' '}
            {f.label}
            {f.hint && <span style={{ color: 'var(--color-neutral-600)' }}> — {f.hint}</span>}
          </label>
        ))}
        <label style={{ fontSize: 13 }}>
          Dar a dica só depois de{' '}
          <input
            className="text-input"
            style={{ width: 70, display: 'inline-block' }}
            type="number"
            min={2}
            value={settings.hintAfter ?? ''}
            placeholder="—"
            onChange={(e) => setSettings({ hintAfter: e.target.value ? Number(e.target.value) : undefined })}
          />{' '}
          erros iguais seguidos (vazio: dar a dica sempre)
        </label>

        <strong style={{ fontSize: 13 }}>Peças na bandeja do aluno</strong>
        <label style={{ fontSize: 13 }}>
          <input
            type="checkbox"
            checked={!tray}
            onChange={(e) =>
              setSettings({ tray: e.target.checked ? undefined : [...TYPES] })
            }
          />{' '}
          O kit inteiro
        </label>
        {tray && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
            {TYPES.map((t) => (
              <label key={t}>
                <input
                  type="checkbox"
                  checked={tray.includes(t)}
                  onChange={(e) => setSettings({ tray: e.target.checked ? [...tray, t] : tray.filter((x) => x !== t) })}
                />{' '}
                {NOMES[t]}
              </label>
            ))}
          </div>
        )}

        {lesson.kind === 'challenge' && (
          <>
            <strong style={{ fontSize: 13 }}>Bancada inicial do desafio</strong>
            <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
              Sem bancada inicial o aluno começa com a bancada vazia. Monte primeiro o circuito CORRETO na bancada; aqui
              você cria, a partir dele, uma bancada com defeito para o aluno consertar.
            </span>
            {FAULTS.map((f) => (
              <label key={f.id} style={{ fontSize: 13 }} title={f.hint}>
                <input
                  type="checkbox"
                  checked={faults.includes(f.id)}
                  onChange={(e) => setFaults(e.target.checked ? [...faults, f.id] : faults.filter((x) => x !== f.id))}
                />{' '}
                {f.label} <span style={{ color: 'var(--color-neutral-600)' }}>— {f.hint}</span>
              </label>
            ))}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-outline"
                disabled={!faults.length || !lesson.board.pieces.length}
                onClick={applyFaults}
              >
                Criar bancada inicial com defeito
              </button>
              <button
                type="button"
                className="btn-outline"
                disabled={!lesson.board.pieces.length}
                title="O aluno começa já com o circuito pronto (útil para desafios de previsão e experimento)."
                onClick={() => setLesson((l) => ({ ...l, start: { pieces: l.board.pieces.map((p) => ({ ...p })) } }))}
              >
                Começar com o circuito pronto
              </button>
              {lesson.start && (
                <button
                  type="button"
                  className="pill-link-btn muted"
                  onClick={() => setLesson((l) => ({ ...l, start: null }))}
                >
                  voltar à bancada vazia
                </button>
              )}
            </div>
            <span role="status" style={{ fontSize: 12 }}>
              {note ||
                (lesson.start
                  ? `Bancada inicial definida: ${lesson.start.pieces.length} peças${lesson.start.removeOneOf ? ' (um jumper sorteado sai)' : ''}.`
                  : 'Bancada inicial: vazia.')}
            </span>
          </>
        )}
      </div>
    </details>
  );
}
