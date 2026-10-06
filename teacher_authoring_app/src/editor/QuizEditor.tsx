import type { CSSProperties } from 'react';
import { newOption, newQuiz } from '../model/lesson.ts';

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

/**
 * Edita a lista de perguntas de múltipla escolha de uma lição.
 * `only`: posições mostradas. As perguntas de passo ('step') são criadas pelo editor de passos,
 * então ali não há "+ Pergunta" nem escolha de quando aparece.
 */
export default function QuizEditor({ quizzes, onChange, only = ['before', 'after'] }) {
  const patch = (id, fn) => onChange(quizzes.map((q) => (q.id === id ? fn(q) : q)));
  const stepOnly = only.length === 1 && only[0] === 'step';
  const shown = quizzes.filter((q) => only.includes(q.position));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {shown.length === 0 && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-600)' }}>Nenhuma pergunta ainda.</p>
      )}
      {shown.map((q, i) => (
        <div
          key={q.id}
          style={{
            background: 'var(--color-bg)',
            borderRadius: 20,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong style={{ fontFamily: 'var(--font-heading)', fontSize: 14 }}>Pergunta {i + 1}</strong>
            {!stepOnly && (
              <select
                value={q.position}
                onChange={(e) => patch(q.id, (x) => ({ ...x, position: e.target.value }))}
                style={{ ...field, width: 'auto', marginLeft: 'auto' }}
                aria-label="Quando aparece"
              >
                <option value="before">Antes de montar</option>
                <option value="after">Depois de montar</option>
              </select>
            )}
            <button
              type="button"
              className="pill-link-btn muted"
              onClick={() => onChange(quizzes.filter((x) => x.id !== q.id))}
            >
              remover
            </button>
          </div>
          <textarea
            rows={2}
            style={field}
            placeholder="Enunciado da pergunta"
            value={q.prompt}
            onChange={(e) => patch(q.id, (x) => ({ ...x, prompt: e.target.value }))}
          />
          {q.options.map((o) => (
            <div key={o.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="radio"
                  name={`correct-${q.id}`}
                  checked={q.correctId === o.id}
                  onChange={() => patch(q.id, (x) => ({ ...x, correctId: o.id }))}
                  aria-label="Alternativa correta"
                />
                <input
                  style={field}
                  placeholder="Alternativa"
                  value={o.text}
                  onChange={(e) =>
                    patch(q.id, (x) => ({
                      ...x,
                      options: x.options.map((y) => (y.id === o.id ? { ...y, text: e.target.value } : y)),
                    }))
                  }
                />
                <button
                  type="button"
                  className="pill-link-btn muted"
                  disabled={q.options.length <= 2}
                  onClick={() =>
                    patch(q.id, (x) => ({
                      ...x,
                      options: x.options.filter((y) => y.id !== o.id),
                      correctId: x.correctId === o.id ? x.options.find((y) => y.id !== o.id).id : x.correctId,
                    }))
                  }
                  aria-label="Remover alternativa"
                >
                  ×
                </button>
              </div>
              <input
                style={{ ...field, marginLeft: 26, width: 'calc(100% - 26px)', fontSize: 12 }}
                placeholder="Retorno ao aluno (opcional)"
                value={o.feedback}
                onChange={(e) =>
                  patch(q.id, (x) => ({
                    ...x,
                    options: x.options.map((y) => (y.id === o.id ? { ...y, feedback: e.target.value } : y)),
                  }))
                }
              />
            </div>
          ))}
          {q.options.length < 4 && (
            <button
              type="button"
              className="pill-link-btn"
              style={{ alignSelf: 'flex-start', fontSize: 13 }}
              onClick={() => patch(q.id, (x) => ({ ...x, options: [...x.options, newOption()] }))}
            >
              + alternativa
            </button>
          )}
        </div>
      ))}
      {!stepOnly && (
        <button
          type="button"
          className="btn-outline"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => onChange([...quizzes, newQuiz()])}
        >
          + Pergunta
        </button>
      )}
    </div>
  );
}
