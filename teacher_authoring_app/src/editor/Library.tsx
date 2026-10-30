import { useMemo, useRef, useState } from 'react';
import CircuitPreview from '../components/CircuitPreview.tsx';

const KIND = { guided: 'Lição guiada', challenge: 'Desafio' };

export default function Library({ lessons, onNew, onOpen, onTest, onDuplicate, onExport, onDelete, onImport }) {
  const fileRef = useRef(null);
  const [tag, setTag] = useState('');
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of lessons) for (const t of l.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [lessons]);
  // The teacher's own lessons first (newest first), then the curriculum in teaching order (ids are numbered).
  const ordered = useMemo(() => {
    const own = lessons.filter((l) => !l.tags?.includes('currículo'));
    const curriculum = lessons.filter((l) => l.tags?.includes('currículo'));
    own.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    // Same lesson number: the guided version before its challenge.
    const lessonKey = (l) => l.id.replace(/-(guiada|desafio|potenciometro)$/, '');
    curriculum.sort(
      (a, b) =>
        lessonKey(a).localeCompare(lessonKey(b)) || Number(a.kind === 'challenge') - Number(b.kind === 'challenge')
    );
    return [...own, ...curriculum];
  }, [lessons]);
  const hasCurriculum = lessons.some((l) => l.tags?.includes('currículo'));
  const shown = tag ? ordered.filter((l) => l.tags?.includes(tag)) : ordered;
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return (
    <div className="lesson-library">
      <div className="lesson-library-toolbar">
        <div>
          <h2>Suas lições</h2>
          <p>Crie atividades e acompanhe seus circuitos.</p>
        </div>
        <button type="button" className="btn-primary" onClick={onNew}>
          Nova lição
        </button>
        <button type="button" className="btn-outline" onClick={() => fileRef.current.click()}>
          Abrir .json
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files[0];
            e.target.value = '';
            if (f) onImport(f);
          }}
        />
      </div>
      {tags.length > 0 && (
        // biome-ignore lint/a11y/useSemanticElements: a row of toggle buttons; a fieldset would add a border and legend
        <div
          className="lesson-tag-filter"
          role="group"
          aria-label="Filtrar por etiqueta"
          style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '4px 0 12px' }}
        >
          <button
            type="button"
            className={tag ? 'btn-outline' : 'btn-primary'}
            aria-pressed={!tag}
            onClick={() => setTag('')}
          >
            Todas ({lessons.length})
          </button>
          {tags.map(([t, n]) => (
            <button
              key={t}
              type="button"
              className={tag === t ? 'btn-primary' : 'btn-outline'}
              aria-pressed={tag === t}
              onClick={() => setTag(t)}
            >
              {t} ({n})
            </button>
          ))}
        </div>
      )}
      {hasCurriculum && !tag && (
        <p style={{ margin: '0 0 10px', fontSize: 13 }}>
          Começando agora? As lições do currículo ficam depois das suas, na ordem de ensino: comece pela “Lição 1” e
          use a versão guiada antes do desafio. Em <strong>Módulos</strong> há trilhas já montadas.
        </p>
      )}
      {tag === 'exemplo' && (
        <p style={{ margin: '0 0 10px', fontSize: 13 }}>
          Estes são exemplos prontos: abra para ver como foram feitos, use “Duplicar” para adaptar a uma cópia sua.
        </p>
      )}
      {lessons.length === 0 && (
        <p className="lesson-library-empty">Nenhuma lição salva. Crie uma nova ou abra um arquivo .json.</p>
      )}
      <div className="lesson-card-grid">
        {shown.map((l) => (
          <article key={l.id} className="lesson-card panel">
            <CircuitPreview pieces={l.board.pieces} label={`Prévia do circuito: ${l.title || 'Lição sem título'}`} />
            <div className="lesson-card-content">
              <div className="lesson-card-heading">
                <span className="lesson-kind">{KIND[l.kind]}</span>
                <h3>{l.title || 'Lição sem título'}</h3>
              </div>
              {l.tags?.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', fontSize: 11 }}>
                  {l.tags.map((t) => (
                    <span
                      key={t}
                      style={{ background: 'var(--color-neutral-200)', borderRadius: 8, padding: '1px 6px' }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="lesson-card-meta">
                <span>{count(l.board.pieces.length, 'peça', 'peças')}</span>
                <span>{count(l.steps?.length || 0, 'passo', 'passos')}</span>
                <span>{count(l.quizzes.length, 'pergunta', 'perguntas')}</span>
              </div>
              {l.teacherNotes && (
                <details style={{ fontSize: 12 }}>
                  <summary style={{ cursor: 'pointer' }}>Notas do professor</summary>
                  <p style={{ whiteSpace: 'pre-wrap', margin: '4px 0 0' }}>{l.teacherNotes}</p>
                </details>
              )}
              <p className="lesson-card-date">Atualizada em {new Date(l.updatedAt).toLocaleDateString('pt-BR')}</p>
              <div className="lesson-card-actions">
                <button type="button" className="btn-primary" onClick={() => onOpen(l)}>
                  Editar
                </button>
                <button type="button" className="btn-outline" onClick={() => onTest(l)}>
                  Testar
                </button>
              </div>
              <div className="lesson-card-utilities">
                <button
                  type="button"
                  className="pill-link-btn"
                  title="Cria uma cópia sua para adaptar"
                  onClick={() => onDuplicate(l)}
                >
                  Duplicar
                </button>
                <button type="button" className="pill-link-btn" onClick={() => onExport(l)}>
                  Exportar
                </button>
                <button type="button" className="pill-link-btn muted" onClick={() => onDelete(l)}>
                  Excluir
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
