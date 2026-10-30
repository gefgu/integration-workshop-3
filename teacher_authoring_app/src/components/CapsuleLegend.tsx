import { explainReading } from '../engine/capsules.ts';
import { isCapsule } from '../engine/sim.ts';
import type { CapsuleReading, Piece } from '../model/types.ts';

/** "O que a tela mostra": explains the values on every smart capsule that is on the bench right now. */
export default function CapsuleLegend({
  pieces,
  readings,
}: {
  pieces: Piece[];
  readings: Record<string, CapsuleReading> | null;
}) {
  const caps = pieces.filter((p) => isCapsule(p.type));
  if (!caps.length) return null;
  return (
    <section
      className="panel"
      style={{ maxWidth: 720, width: '100%', textAlign: 'left' }}
      aria-label="O que a tela mostra"
    >
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>O que a tela da cápsula mostra</h3>
      {caps.map((p) => {
        const info = explainReading(p, readings?.[p.id]);
        return (
          <div key={p.id} style={{ marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>{info.title}</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.45 }}>
              {info.lines.filter(Boolean).map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        );
      })}
      <p style={{ margin: 0, fontSize: 12, color: 'var(--color-neutral-600)' }}>
        Valores simulados pelo software: não são medições da bancada física.
      </p>
    </section>
  );
}
