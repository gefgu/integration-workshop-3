import { countByType, DEFS, isCapsule, KIT_LIMITS, NOMES, TYPES } from '../engine/sim.ts';
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
      <TrayGrid types={TYPES.filter((t) => !isCapsule(t))} used={used} onDragStart={onDragStart} />
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 14, margin: '8px 0 0' }}>Cápsulas inteligentes</h3>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--color-neutral-600)' }}>
        Cabem só nos 6 encaixes tracejados (E1–E6), com P1, P2 e P3 em 3 colunas. O amperímetro só funciona no E2.
        Clique na cápsula para mudar o modo; no máximo 3 ao mesmo tempo.
      </p>
      <TrayGrid types={TYPES.filter(isCapsule)} used={used} onDragStart={onDragStart} />
    </section>
  );
}

function TrayGrid({ types, used, onDragStart }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {types.map((type) => {
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
              width={type.startsWith('jumper') ? 40 + DEFS[type].len * 8 : isCapsule(type) ? 72 : 54}
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
  );
}
