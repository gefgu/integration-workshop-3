import { useCallback, useMemo, useState } from 'react';
import BoardWorkspace from '../components/BoardWorkspace.tsx';
import SchematicPreview from '../components/SchematicPreview.tsx';
import { diagnose } from '../engine/diagnose.ts';
import { lessonProblems } from '../model/lesson.ts';
import QuizEditor from './QuizEditor.tsx';
import StepsEditor from './StepsEditor.tsx';

/**
 * Editor: monta o circuito-alvo na bancada 11×6, escreve título/instrução
 * e perguntas. `onSave`/`onExport` recebem a lição já validada.
 */
export default function LessonEditor({ lesson, setLesson, onSave, onExport, onTest, status }) {
  const [problems, setProblems] = useState([]);
  const [selected, setSelected] = useState(null); // index of the step being edited
  const setPieces = useCallback((pieces) => setLesson((l) => ({ ...l, board: { ...l.board, pieces } })), [setLesson]);
  const set = (patch) => setLesson((l) => ({ ...l, ...patch }));
  const diag = diagnose(lesson.board.pieces);
  const selectedStep = selected != null ? lesson.steps[selected] : null;
  const highlightIds = useMemo(() => new Set(selectedStep?.pieceId ? [selectedStep.pieceId] : []), [selectedStep]);

  function guarded(action) {
    const p = lessonProblems(lesson);
    setProblems(p);
    if (p.length === 0) action(lesson);
  }

  return (
    <div className="lesson-editor-layout">
      <div className="lesson-editor-workspace">
        <BoardWorkspace
          pieces={lesson.board.pieces}
          onChange={setPieces}
          trail={diag.trail}
          ledMa={diag.mA}
          highlightIds={highlightIds}
          trayFooter={<SchematicPreview pieces={lesson.board.pieces} />}
        />
      </div>

      <section className="panel" style={{ flex: '1 1 340px', maxWidth: 460 }}>
        <h2>Lição</h2>
        <label className="field-label" htmlFor="title">
          Título
        </label>
        <input
          id="title"
          className="text-input"
          value={lesson.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Ex.: Acender um LED"
        />
        <label className="field-label" htmlFor="instruction">
          Instrução para o aluno
        </label>
        <textarea
          id="instruction"
          className="text-input"
          rows={3}
          value={lesson.instruction}
          onChange={(e) => set({ instruction: e.target.value })}
          placeholder="O que o aluno deve montar e por quê."
        />
        <label className="field-label" htmlFor="kind">
          Tipo
        </label>
        <select
          id="kind"
          className="text-input"
          value={lesson.kind}
          onChange={(e) => {
            set(e.target.value === 'guided' ? { kind: 'guided', timeLimitS: null } : { kind: 'challenge' });
            setSelected(null);
          }}
        >
          <option value="guided">Lição guiada</option>
          <option value="challenge">Desafio</option>
        </select>

        <h2 style={{ marginTop: 20 }}>{lesson.kind === 'challenge' ? 'Desafio' : 'Passos'}</h2>
        <StepsEditor lesson={lesson} setLesson={setLesson} selected={selected} setSelected={setSelected} />

        <h2 style={{ marginTop: 20 }}>Perguntas</h2>
        <QuizEditor quizzes={lesson.quizzes} onChange={(quizzes) => set({ quizzes })} />

        {problems.length > 0 && (
          <ul className="problems">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={() => guarded(onSave)}>
            Salvar
          </button>
          <button type="button" className="btn-outline" onClick={() => guarded(onExport)}>
            Exportar .json
          </button>
          <button type="button" className="btn-outline" onClick={onTest}>
            Testar
          </button>
        </div>
        {status && (
          <p role="status" style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--color-accent-2-700)' }}>
            {status}
          </p>
        )}
      </section>
    </div>
  );
}
