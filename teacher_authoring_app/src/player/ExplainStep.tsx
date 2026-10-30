import { useSay } from '../audio/useTutorVoice.ts';
import Illustration from '../components/Illustration.tsx';
import NodeExplorer from '../components/NodeExplorer.tsx';
import type { LessonStep } from '../model/types.ts';

/** A reading card: a heading, a few short paragraphs, a drawing and (optionally) the node explorer. */
export default function ExplainStep({ step, onDone }: { step: LessonStep; onDone: () => void }) {
  const paragraphs = step.text.split(/\n{2,}/).filter((t) => t.trim());
  useSay([step.title, ...paragraphs]);
  return (
    <section className="panel" style={{ maxWidth: 720, width: '100%', textAlign: 'left' }}>
      {step.title && <h2 style={{ marginTop: 0 }}>{step.title}</h2>}
      {step.illustration && <Illustration art={step.illustration} />}
      {paragraphs.map((t) => (
        <p key={t} style={{ fontSize: 15, lineHeight: 1.55 }}>
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
