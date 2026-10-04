import { DEFS, KIT_LIMITS, NOMES, TYPES, countByType } from '../engine/sim.js';
import PieceView from './PieceView.jsx';

/** Bandeja com os componentes do kit (limites do MFR8). `onDragStart(type, event)` inicia o arraste. */
export default function Tray({ pieces, onDragStart }) {
  const used = countByType(pieces);
  return (
    <section style={{ width: 200, flex: 'none', background: 'var(--color-surface)', borderRadius: 28, padding: '18px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 17, margin: '0 0 2px' }}>Bandeja</h2>
      <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--color-neutral-600)' }}>Arraste para a bancada. Clique numa peça para girar; arraste para fora para remover.</p>
      {TYPES.map(type => {
        const left = KIT_LIMITS[type] - (used[type] || 0);
        return (
        <div key={type} className="tray-item" onPointerDown={(e) => { if (left > 0) onDragStart(type, e); }} role="button" aria-disabled={left <= 0} aria-label={NOMES[type]}
          style={{ opacity: left > 0 ? 1 : 0.4, cursor: left > 0 ? 'grab' : 'not-allowed' }}>
          <PieceView type={type} width={DEFS[type].len === 2 ? 56 : 44} height={22} pins={false} />
          <div>
            <div className="name">{NOMES[type]}</div>
            <div className="meta">{left} de {KIT_LIMITS[type]} no kit · {DEFS[type].len === 2 ? '3 colunas' : '2 colunas'}</div>
          </div>
        </div>
        );
      })}
    </section>
  );
}
