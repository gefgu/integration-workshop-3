import { useMemo, useState } from 'react';
import BoardWorkspace from '../components/BoardWorkspace.jsx';
import Bubble from '../components/Bubble.jsx';
import { diagnose } from '../engine/diagnose.js';
import { matchesTarget } from '../model/lesson.js';

const PRAISE = ['Boa!', 'Isso aí!', 'Mandou bem!', 'Perfeito!', 'Show!', 'Exato!'];
const praise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];

function buildPhases(lesson) {
  const quiz = (pos) => lesson.quizzes.filter(q => q.position === pos).map(q => ({ type: 'quiz', quiz: q }));
  const build = lesson.board.pieces.length > 0 ? [{ type: 'build' }] : [];
  return [...quiz('before'), ...build, ...quiz('after'), { type: 'done' }];
}

/** "Testar": roda a lição como o aluno veria — perguntas, montagem, Energizar. */
export default function LessonPlayer({ lesson, onExit, mascotKind }) {
  const phases = useMemo(() => buildPhases(lesson), [lesson]);
  const [idx, setIdx] = useState(0);
  const phase = phases[idx];
  const next = () => setIdx(i => Math.min(i + 1, phases.length - 1));
  const steps = phases.length - 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', margin: 0, fontSize: 20 }}>{lesson.title || 'Lição sem título'}</h2>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>{phase.type === 'done' ? 'Concluída' : `Etapa ${idx + 1} de ${steps}`}</span>
        <button className="btn-outline" onClick={onExit}>Voltar ao editor</button>
      </div>
      {lesson.instruction && <p style={{ margin: 0, maxWidth: 720, fontSize: 14, lineHeight: 1.5 }}>{lesson.instruction}</p>}

      {phase.type === 'quiz' && <QuizStep key={phase.quiz.id} quiz={phase.quiz} onDone={next} mascotKind={mascotKind} />}
      {phase.type === 'build' && <BuildStep key="build" lesson={lesson} onDone={next} mascotKind={mascotKind} />}
      {phase.type === 'done' && (
        <>
          <Bubble kind={mascotKind} tone="ok" message="Lição concluída! É assim que o aluno vai passar por ela." />
          <button className="btn-primary" onClick={() => setIdx(0)}>Testar de novo</button>
        </>
      )}
    </div>
  );
}

function QuizStep({ quiz, onDone, mascotKind }) {
  const [picked, setPicked] = useState(null);
  const option = quiz.options.find(o => o.id === picked);
  const correct = picked === quiz.correctId;
  const msg = !option
    ? 'Escolha uma alternativa.'
    : (correct ? (option.feedback || praise()) : (option.feedback || 'Não foi dessa vez. Tente de novo.'));
  return (
    <>
      <Bubble kind={mascotKind} tone={!option ? 'info' : (correct ? 'ok' : 'erro')} message={msg} />
      <div className="panel" style={{ maxWidth: 720, width: '100%' }}>
        <h2>{quiz.prompt}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {quiz.options.map(o => (
            <button
              key={o.id}
              className="btn-outline"
              disabled={correct}
              style={{ textAlign: 'left', background: picked === o.id ? (correct ? 'var(--color-accent-2-200)' : 'var(--color-accent-200)') : 'transparent' }}
              onClick={() => setPicked(o.id)}
            >{o.text}</button>
          ))}
        </div>
        {correct && <button className="btn-primary" style={{ marginTop: 14 }} onClick={onDone}>Continuar</button>}
      </div>
    </>
  );
}

function BuildStep({ lesson, onDone, mascotKind }) {
  const [pieces, setPieces] = useState([]);
  const [energized, setEnergized] = useState(false);
  const diag = diagnose(pieces);
  const matches = matchesTarget(pieces, lesson.board.pieces);
  const complete = matches && energized;

  let tone = diag.tone, msg = diag.msg;
  if (complete) { tone = 'ok'; msg = 'Era isso! Circuito montado igual ao da lição.'; }
  else if (matches) { tone = 'ok'; msg = 'Montagem certa. Aperte Energizar.'; }
  else if (pieces.length > 0 && diag.code === 'valido') { tone = 'obs'; msg = 'O circuito funciona, mas não é o da lição. Confira as peças pedidas.'; }

  const lit = energized && diag.code === 'valido';
  return (
    <>
      <Bubble kind={mascotKind} tone={tone} message={msg} />
      <BoardWorkspace pieces={pieces} onChange={setPieces} trail={lit ? diag.trail : null} ledMa={lit ? diag.mA : 0} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button
          onClick={() => setEnergized(e => !e)}
          style={{ border: 0, cursor: 'pointer', fontFamily: 'var(--font-heading)', fontSize: 16, padding: '14px 30px', borderRadius: 999, background: energized ? 'var(--color-neutral-700)' : 'var(--color-accent)', color: 'var(--color-bg)', boxShadow: 'var(--shadow-md)' }}
        >{energized ? 'Desligar' : 'Energizar'}</button>
        <span style={{ fontSize: 14, fontWeight: 600, color: lit ? 'var(--color-accent-2-700)' : 'var(--color-neutral-600)' }}>
          {energized ? (lit ? diag.mA.toFixed(1) + ' mA no LED' : 'Sem corrente') : 'Bancada desligada'}
        </span>
        <button className="pill-link-btn muted" onClick={() => setPieces(lesson.board.pieces.map(p => ({ ...p })))}>preencher com o gabarito</button>
        {complete && <button className="btn-primary" onClick={onDone}>Continuar</button>}
      </div>
    </>
  );
}
