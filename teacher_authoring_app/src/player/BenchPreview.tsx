import { type ReactNode, useLayoutEffect, useMemo, useRef, useState } from 'react';
import '../bench/bench.css';
import FitStage from '../bench/FitStage.tsx';
import Bubble from '../components/Bubble.tsx';
import Icon from '../components/Icon.tsx';
import LessonPlayer from './LessonPlayer.tsx';
import { buildPhases } from './phases.ts';

const SCREEN_W = 1024;
const SCREEN_H = 600;

const PHASE_NAMES = {
  quiz: 'Pergunta',
  step: 'Montagem',
  interact: 'Pergunta na bancada',
  explain: 'Leitura',
  experiment: 'Experimento',
  challenge: 'Desafio',
};

/** The bench's 1024×600 monitor drawn at whatever size fits its box (the layout inside stays 1024×600). */
function ScaledScreen({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const measure = () => {
      const next = Math.min(el.clientWidth / SCREEN_W, el.clientHeight / SCREEN_H);
      if (next > 0) setScale((prev) => (Math.abs(prev - next) < 0.002 ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={box} className="bench-preview-box">
      <div className="bench-preview-frame" style={{ width: SCREEN_W * scale, height: SCREEN_H * scale }}>
        <div style={{ width: SCREEN_W, height: SCREEN_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * "Validador da lição": the lesson exactly as the student sees it on the bench, one screen at a time, with the
 * teacher's controls outside the screen and a step carousel to jump to any screen.
 */
export default function BenchPreview({
  lesson,
  onExit,
  toolbar,
  notice,
}: {
  lesson: any;
  onExit: () => void;
  toolbar?: ReactNode;
  notice?: string;
}) {
  const phases = useMemo(() => buildPhases(lesson), [lesson]);
  const screens = phases.length - 1; // the last phase is "done"
  const [current, setCurrent] = useState(0);
  const [run, setRun] = useState(0); // remounts the player to jump to a screen
  const [finished, setFinished] = useState(false);
  const [debug, setDebug] = useState(false);

  const jump = (target: number) => {
    setCurrent(Math.max(0, Math.min(screens - 1, target)));
    setFinished(false);
    setRun((n) => n + 1);
  };

  return (
    <div className="bench-preview">
      <section className="panel bench-preview-bar" aria-label="Controles do teste">
        {toolbar}
        <button type="button" className="btn-outline btn-icon" onClick={onExit}>
          <Icon name="edit" size={16} />
          Voltar ao editor
        </button>
        <div className="bench-preview-title">
          <strong>{lesson.title || 'Lição sem título'}</strong>
          {notice && <span className="player-notice">{notice}</span>}
        </div>
        <label className="bench-preview-check">
          <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} />
          Depurar validação
        </label>
      </section>

      <ScaledScreen>
        <div className="bench-shell bench-preview-shell">
          <header className="bench-header">
            <strong>TedTronics</strong>
            <span>prévia da bancada · {finished ? 'concluída' : `tela ${current + 1} de ${screens}`}</span>
          </header>
          <main className="bench-stage">
            <FitStage>
              {finished ? (
                <div className="bench-center">
                  <Bubble kind="hamster" tone="ok" message="Lição concluída! É assim que o aluno vai passar por ela." />
                  <button type="button" className="btn-primary" onClick={() => jump(0)}>
                    Testar de novo
                  </button>
                </div>
              ) : (
                <section className="bench-lesson">
                  <LessonPlayer
                    key={run}
                    lesson={lesson}
                    mascotKind="hamster"
                    bench
                    debug={debug}
                    startPhase={current}
                    onExit={onExit}
                    exitLabel="Voltar (Esc)"
                    onEvent={(event) => {
                      if (event.type === 'phase_done') setCurrent(Math.min(event.phase, screens - 1));
                      if (event.type === 'lesson_done') setFinished(true);
                    }}
                  />
                </section>
              )}
            </FitStage>
          </main>
        </div>
      </ScaledScreen>

      <nav className="bench-carousel" aria-label="Telas da lição">
        <button
          type="button"
          className="icon-btn icon-btn-outline"
          aria-label="Tela anterior"
          disabled={current === 0 && !finished}
          onClick={() => jump(finished ? screens - 1 : current - 1)}
        >
          ‹
        </button>
        <ol>
          {phases.slice(0, screens).map((phase, i) => {
            const name = PHASE_NAMES[phase.type] ?? 'Tela';
            const label = `Tela ${i + 1}: ${name}`;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: one dot per screen, fixed for the lesson
              <li key={`${phase.type}-${i}`}>
                <button
                  type="button"
                  className={`bench-dot${i === current && !finished ? ' active' : ''}${i < current || finished ? ' done' : ''} has-tip tip-up`}
                  data-tip={label}
                  aria-label={label}
                  aria-current={i === current && !finished ? 'step' : undefined}
                  onClick={() => jump(i)}
                />
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          className="icon-btn icon-btn-outline"
          aria-label="Próxima tela"
          disabled={finished || current >= screens - 1}
          onClick={() => jump(current + 1)}
        >
          ›
        </button>
      </nav>
    </div>
  );
}
