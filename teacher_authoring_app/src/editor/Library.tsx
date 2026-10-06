import { useRef } from 'react';

const KIND = { guided: 'Lição guiada', challenge: 'Desafio' };

export default function Library({ lessons, onNew, onOpen, onTest, onDuplicate, onExport, onDelete, onImport }) {
  const fileRef = useRef(null);
  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
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
      {lessons.length === 0 && (
        <p style={{ fontSize: 14, color: 'var(--color-neutral-600)' }}>
          Nenhuma lição salva neste navegador. Crie uma nova ou abra um arquivo .json.
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lessons.map((l) => (
          <div
            key={l.id}
            className="panel"
            style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '14px 18px' }}
          >
            <div style={{ flex: '1 1 220px' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16 }}>{l.title}</div>
              <div style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
                {KIND[l.kind]} · {l.board.pieces.length} peças
                {l.steps && l.steps.length > 0 ? ` · ${l.steps.length} passos` : ''} · {l.quizzes.length} perguntas ·{' '}
                {new Date(l.updatedAt).toLocaleString('pt-BR')}
              </div>
            </div>
            <button type="button" className="btn-outline" onClick={() => onOpen(l)}>
              Editar
            </button>
            <button type="button" className="btn-outline" onClick={() => onTest(l)}>
              Testar
            </button>
            <button type="button" className="pill-link-btn" onClick={() => onDuplicate(l)}>
              duplicar
            </button>
            <button type="button" className="pill-link-btn" onClick={() => onExport(l)}>
              exportar
            </button>
            <button type="button" className="pill-link-btn muted" onClick={() => onDelete(l)}>
              excluir
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
