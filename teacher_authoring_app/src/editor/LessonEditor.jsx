import { useCallback, useState } from 'react';
import BoardWorkspace from '../components/BoardWorkspace.jsx';
import Bubble from '../components/Bubble.jsx';
import QuizEditor from './QuizEditor.jsx';
import { diagnose } from '../engine/diagnose.js';
import { lessonProblems } from '../model/lesson.js';

/**
 * Editor: monta o circuito-alvo na bancada 11×6, escreve título/instrução
 * e perguntas. `onSave`/`onExport` recebem a lição já validada.
 */
export default function LessonEditor({ lesson, setLesson, onSave, onExport, onTest, mascotKind, status }) {
  const [problems, setProblems] = useState([]);
  const setPieces = useCallback(
    (pieces) => setLesson(l => ({ ...l, board: { ...l.board, pieces } })),
    [setLesson]
  );
  const set = (patch) => setLesson(l => ({ ...l, ...patch }));
  const diag = diagnose(lesson.board.pieces);

  function guarded(action) {
    const p = lessonProblems(lesson);
    setProblems(p);
    if (p.length === 0) action(lesson);
  }

  return (
    <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
        <Bubble kind={mascotKind} tone={diag.tone} message={'Circuito-alvo: ' + diag.msg} />
        <BoardWorkspace pieces={lesson.board.pieces} onChange={setPieces} trail={diag.trail} ledMa={diag.mA} />
      </div>

      <section className="panel" style={{ flex: '1 1 340px', maxWidth: 460 }}>
        <h2>Lição</h2>
        <label className="field-label" htmlFor="title">Título</label>
        <input id="title" className="text-input" value={lesson.title} onChange={e => set({ title: e.target.value })} placeholder="Ex.: Acender um LED" />
        <label className="field-label" htmlFor="instruction">Instrução para o aluno</label>
        <textarea id="instruction" className="text-input" rows={3} value={lesson.instruction} onChange={e => set({ instruction: e.target.value })} placeholder="O que o aluno deve montar e por quê." />
        <label className="field-label" htmlFor="kind">Tipo</label>
        <select id="kind" className="text-input" value={lesson.kind} onChange={e => set({ kind: e.target.value })}>
          <option value="guided">Lição guiada</option>
          <option value="challenge">Desafio</option>
        </select>

        <h2 style={{ marginTop: 20 }}>Perguntas</h2>
        <QuizEditor quizzes={lesson.quizzes} onChange={(quizzes) => set({ quizzes })} />

        {problems.length > 0 && <ul className="problems">{problems.map(p => <li key={p}>{p}</li>)}</ul>}
        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={() => guarded(onSave)}>Salvar</button>
          <button className="btn-outline" onClick={() => guarded(onExport)}>Exportar .json</button>
          <button className="btn-outline" onClick={onTest}>Testar</button>
        </div>
        {status && <p role="status" style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--color-accent-2-700)' }}>{status}</p>}
      </section>
    </div>
  );
}
