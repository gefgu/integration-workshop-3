import { useRef } from 'react';
import CircuitPreview from '../components/CircuitPreview.tsx';

const KIND = { guided: 'Lição guiada', challenge: 'Desafio' };

export default function Library({ lessons, onNew, onOpen, onTest, onDuplicate, onExport, onDelete, onImport }) {
  const fileRef = useRef(null);
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
      {lessons.length === 0 && (
        <p className="lesson-library-empty">Nenhuma lição salva. Crie uma nova ou abra um arquivo .json.</p>
      )}
      <div className="lesson-card-grid">
        {lessons.map((l) => (
          <article key={l.id} className="lesson-card panel">
            <CircuitPreview pieces={l.board.pieces} label={`Prévia do circuito: ${l.title || 'Lição sem título'}`} />
            <div className="lesson-card-content">
              <div className="lesson-card-heading">
                <span className="lesson-kind">{KIND[l.kind]}</span>
                <h3>{l.title || 'Lição sem título'}</h3>
              </div>
              <div className="lesson-card-meta">
                <span>{l.board.pieces.length} peças</span>
                <span>{l.steps?.length || 0} passos</span>
                <span>{l.quizzes.length} perguntas</span>
              </div>
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
                <button type="button" className="pill-link-btn" onClick={() => onDuplicate(l)}>
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
