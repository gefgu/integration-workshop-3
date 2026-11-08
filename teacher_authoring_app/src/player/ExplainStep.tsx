import { useState } from 'react';
import { useSay } from '../audio/useTutorVoice.ts';
import Illustration from '../components/Illustration.tsx';
import NodeExplorer from '../components/NodeExplorer.tsx';
import type { LessonStep } from '../model/types.ts';
import { pageParagraphs, useBenchMode } from './benchMode.ts';

/**
 * A reading card: a heading, a few short paragraphs, a drawing and (optionally) the node explorer. On the bench a
 * long reading becomes several screens (two short paragraphs each) and the explorer gets a screen of its own.
 */
export default function ExplainStep({ step, onDone }: { step: LessonStep; onDone: () => void }) {
  const bench = useBenchMode();
  const paragraphs = step.text.split(/\n{2,}/).filter((t) => t.trim());
  if (bench) return <BenchExplain step={step} paragraphs={paragraphs} onDone={onDone} />;
  return <FullExplain step={step} paragraphs={paragraphs} onDone={onDone} />;
}

function FullExplain({ step, paragraphs, onDone }: { step: LessonStep; paragraphs: string[]; onDone: () => void }) {
  useSay([step.title, ...paragraphs]);
  return (
    <section className="panel explain-card" style={{ maxWidth: 720, width: '100%', textAlign: 'left' }}>
      {step.title && <h2 style={{ marginTop: 0 }}>{step.title}</h2>}
      {step.illustration && <Illustration art={step.illustration} />}
      {paragraphs.map((t) => (
        <p key={t} style={{ fontSize: 'calc(15px * var(--text-scale, 1))', lineHeight: 1.55 }}>
          {t}
        </p>
      ))}
      {step.widget === 'nodes' && <NodeExplorer />}
      <button type="button" className="btn-primary" style={{ marginTop: 14 }} onClick={onDone}>
        Entendi, continuar
      </button>
    </section>
  );
}

interface Page {
  text: string[];
  figure: boolean;
  explorer: boolean;
}

function BenchExplain({ step, paragraphs, onDone }: { step: LessonStep; paragraphs: string[]; onDone: () => void }) {
  const explorer = step.widget === 'nodes';
  // With the explorer, the last paragraph ("toque nos furos…") goes with it on its own screen.
  const reading = explorer && paragraphs.length > 1 ? paragraphs.slice(0, -1) : paragraphs;
  const pages: Page[] = pageParagraphs(reading).map((text) => ({ text, figure: !!step.illustration, explorer: false }));
  if (explorer) pages.push({ text: paragraphs.length > 1 ? paragraphs.slice(-1) : [], figure: false, explorer: true });
  if (pages.length === 0) pages.push({ text: [], figure: !!step.illustration, explorer: false });
  const [index, setIndex] = useState(0);
  const page = pages[index];
  const last = index === pages.length - 1;
  useSay(index === 0 ? [step.title, ...page.text] : page.text, 0, true);

  return (
    <section
      key={index}
      className={`panel explain-card bench-read${page.figure || page.explorer ? ' with-figure' : ''}${page.explorer ? ' with-explorer' : ''}`}
      aria-label={step.title || 'Leitura'}
    >
      <div className="bench-read-text">
        {step.title && <h2>{step.title}</h2>}
        {page.text.map((t) => (
          <p key={t}>{t}</p>
        ))}
        <div className="bench-read-actions">
          {index > 0 && (
            <button type="button" className="btn-outline" data-pad="back" onClick={() => setIndex(index - 1)}>
              Voltar
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            data-pad="next"
            onClick={() => (last ? onDone() : setIndex(index + 1))}
          >
            {last ? 'Entendi, continuar' : 'Próximo'}
          </button>
          {pages.length > 1 && (
            <span className="bench-read-count">
              {index + 1}/{pages.length}
            </span>
          )}
        </div>
      </div>
      {page.figure && step.illustration && (
        <div className="bench-read-figure">
          <Illustration art={step.illustration} />
        </div>
      )}
      {page.explorer && (
        <div className="bench-read-figure">
          <NodeExplorer />
        </div>
      )}
    </section>
  );
}
