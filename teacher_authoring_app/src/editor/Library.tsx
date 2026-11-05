import { useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.tsx';
import Modal from '../components/Modal.tsx';
import { SchematicDiagram } from '../components/SchematicPreview.tsx';
import TeacherNotes from '../components/TeacherNotes.tsx';
import { orderLessons } from '../model/library.ts';

const KIND = { guided: 'Lição guiada', challenge: 'Desafio' };

export default function Library({ lessons, onNew, onOpen, onTest, onDuplicate, onExport, onDelete, onImport }) {
  const fileRef = useRef(null);
  const [tag, setTag] = useState('');
  const [creating, setCreating] = useState(false);
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of lessons)
      for (const t of new Set([
        ...(l.tags ?? []).filter((t) => !['guiada', 'desafio'].includes(t)),
        l.kind === 'challenge' ? 'desafio' : 'guiada',
      ]))
        counts.set(t, (counts.get(t) ?? 0) + 1);
    const members = (tag: string) =>
      lessons
        .filter((l) => l.tags?.includes(tag))
        .map((l) => l.id)
        .sort()
        .join('|');
    return [...counts.entries()]
      .filter(
        ([t, n]) =>
          (n < lessons.length || t === 'currículo') && !(t === 'exemplo' && members(t) === members('currículo'))
      )
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [lessons]);
  // The teacher's own lessons first (newest first), then the curriculum in teaching order (ids are numbered).
  const ordered = useMemo(() => orderLessons(lessons), [lessons]);
  const hasCurriculum = lessons.some((l) => l.tags?.includes('currículo'));
  const shown = tag
    ? ordered.filter((l) =>
        tag === 'guiada' ? l.kind === 'guided' : tag === 'desafio' ? l.kind === 'challenge' : l.tags?.includes(tag)
      )
    : ordered;
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return (
    <div className="lesson-library">
      <div className="lesson-library-toolbar">
        <div>
          <h2>Suas lições</h2>
          <p>Crie atividades e acompanhe seus circuitos.</p>
        </div>
        <div className="lesson-library-buttons">
          <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
            Nova lição
          </button>
          <button
            type="button"
            className="icon-btn icon-btn-outline has-tip"
            data-tip="Importar lição .json"
            aria-label="Importar lição .json"
            onClick={() => fileRef.current.click()}
          >
            <Icon name="plus" size={20} />
          </button>
        </div>
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
        <div className="lesson-tag-filter" role="group" aria-label="Filtrar por etiqueta">
          <button
            type="button"
            className={tag ? 'btn-outline' : 'btn-primary'}
            aria-pressed={!tag}
            onClick={() => setTag('')}
          >
            Todas ({lessons.length})
          </button>
          {tags.slice(0, 6).map(([t, n]) => (
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
          {tags.length > 6 && (
            <select
              className="select-pill"
              aria-label="Mais etiquetas"
              value={tags.slice(6).some(([t]) => t === tag) ? tag : ''}
              onChange={(e) => setTag(e.target.value)}
            >
              <option value="">Mais etiquetas…</option>
              {tags.slice(6).map(([t, n]) => (
                <option key={t} value={t}>
                  {t} ({n})
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      {hasCurriculum && !tag && (
        <p style={{ margin: '0 0 10px', fontSize: 13 }}>
          Começando agora? As lições do currículo ficam depois das suas, na ordem de ensino: comece pela “Lição 1” e use
          a versão guiada antes do desafio. Em <strong>Módulos</strong> há trilhas já montadas.
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
            <div
              className="lesson-card-schematic"
              role="img"
              aria-label={`Esquema do circuito: ${l.title || 'Lição sem título'}`}
            >
              <SchematicDiagram pieces={l.board.pieces} />
            </div>
            <div className="lesson-card-content">
              <div className="lesson-card-heading">
                <span className="lesson-kind">{KIND[l.kind]}</span>
                <h3>{l.title || 'Lição sem título'}</h3>
              </div>
              {l.tags?.length > 0 && (
                <div className="lesson-card-tags">
                  {l.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              )}
              <div className="lesson-card-meta">
                <span>{count(l.board.pieces.length, 'peça', 'peças')}</span>
                <span>{count(l.steps?.length || 0, 'passo', 'passos')}</span>
                <span>{count(l.quizzes.length, 'pergunta', 'perguntas')}</span>
              </div>
              {l.teacherNotes && <TeacherNotes text={l.teacherNotes} />}
              <p className="lesson-card-date">Atualizada em {new Date(l.updatedAt).toLocaleDateString('pt-BR')}</p>
              <div className="lesson-card-actions">
                <button type="button" className="btn-primary btn-icon" onClick={() => onOpen(l)}>
                  <Icon name="edit" />
                  Editar
                </button>
                <button type="button" className="btn-outline btn-icon" onClick={() => onTest(l)}>
                  <Icon name="play" />
                  Testar
                </button>
              </div>
              <div className="lesson-card-utilities">
                <button
                  type="button"
                  className="icon-btn icon-btn-quiet has-tip tip-up"
                  data-tip="Duplicar: cria uma cópia sua para adaptar"
                  aria-label="Duplicar"
                  onClick={() => onDuplicate(l)}
                >
                  <Icon name="copy" size={18} />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn-quiet has-tip tip-up"
                  data-tip="Exportar"
                  aria-label="Exportar"
                  onClick={() => onExport(l)}
                >
                  <Icon name="download" size={18} />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn-quiet danger has-tip tip-up"
                  data-tip="Excluir"
                  aria-label="Excluir"
                  onClick={() => onDelete(l)}
                >
                  <Icon name="trash" size={18} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {creating && <NewLessonDialog onClose={() => setCreating(false)} onCreate={onNew} />}
    </div>
  );
}

/** "Nova lição": the basics first (title and kind), then the editor opens with them filled in. */
function NewLessonDialog({ onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('guided');
  return (
    <Modal title="Nova lição" onClose={onClose}>
      <form
        className="workspace-form modal-form"
        onSubmit={(event) => {
          event.preventDefault();
          onCreate(kind === 'guided' ? { title, kind: 'guided', timeLimitS: null } : { title, kind: 'challenge' });
        }}
      >
        <label className="field-label" htmlFor="new-lesson-title">
          Título
        </label>
        <input
          id="new-lesson-title"
          className="text-input"
          required
          // biome-ignore lint/a11y/noAutofocus: the dialog opens to type the title
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex.: Acender um LED"
        />
        <label className="field-label" htmlFor="new-lesson-kind">
          Tipo
        </label>
        <select id="new-lesson-kind" className="text-input" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="guided">Lição guiada (passo a passo)</option>
          <option value="challenge">Desafio (o aluno monta sozinho)</option>
        </select>
        <div className="modal-actions">
          <button className="btn-primary" type="submit">
            Criar e abrir no editor
          </button>
          <button className="btn-outline" type="button" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}
