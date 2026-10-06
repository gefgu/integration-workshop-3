import { countByType, DEFS, KIT_LIMITS, NOMES, TYPES } from '../engine/sim.ts';
import PieceView from './PieceView.tsx';

/** Bandeja com os componentes do kit (limites do MFR8). `onDragStart(type, event)` inicia o arraste. */
export default function Tray({ pieces, onDragStart }) {
  const used = countByType(pieces);
  return (
    <section
      style={{
        width: 420,
        flex: 'none',
        background: 'var(--color-surface)',
        borderRadius: 28,
        padding: '18px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 17, margin: '0 0 2px' }}>Bandeja</h2>
      <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--color-neutral-600)' }}>
        Arraste para a bancada. Clique numa peça para girar; arraste para fora para remover.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {TYPES.map((type) => {
          const left = KIT_LIMITS[type] - (used[type] || 0);
          return (
            // biome-ignore lint/a11y/useSemanticElements: This is a drag source with button semantics, not a form control.
            <div
              key={type}
              className="tray-item"
              onPointerDown={(e) => {
                if (left > 0) onDragStart(type, e);
              }}
              role="button"
              tabIndex={left > 0 ? 0 : -1}
              aria-disabled={left <= 0}
              aria-label={NOMES[type]}
              style={{ opacity: left > 0 ? 1 : 0.4, cursor: left > 0 ? 'grab' : 'not-allowed' }}
            >
              <PieceView
                type={type}
                width={type.startsWith('jumper') ? 40 + DEFS[type].len * 8 : 54}
                height={24}
                pins={false}
              />
              <div>
                <div className="name">{NOMES[type]}</div>
                <div className="meta">
                  {left} de {KIT_LIMITS[type]} no kit
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
