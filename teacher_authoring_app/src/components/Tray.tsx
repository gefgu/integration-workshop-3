import { useState } from 'react';
import { countByType, DEFS, isCapsule, KIT_LIMITS, NOMES, TYPES } from '../engine/sim.ts';
import type { PieceType } from '../model/types.ts';
import { useBenchMode, useLiveBoard, useStepParts } from '../player/benchMode.ts';
import PieceView from './PieceView.tsx';
import Tabs from './Tabs.tsx';

/** Bandeja com os componentes do kit (limites do MFR8). `onDragStart(type, event)` inicia o arraste. */
export default function Tray({
  pieces,
  onDragStart,
  types = null,
}: {
  pieces: any[];
  onDragStart: any;
  types?: PieceType[] | null;
}) {
  const used = countByType(pieces);
  const bench = useBenchMode();
  const live = useLiveBoard();
  const needed = useStepParts();
  // On the bench a step shows only the parts it asks for; elsewhere a lesson may offer only some parts
  // (settings.tray), by default the whole kit.
  const offered = bench && needed ? (types ?? TYPES).filter((t) => needed.has(t)) : (types ?? TYPES);
  const plain = offered.filter((t) => !isCapsule(t));
  const smart = offered.filter(isCapsule);
  // Tabs keep the tray short: components, jumpers and smart capsules one group at a time.
  const groups = [
    { id: 'parts', label: 'Componentes', types: plain.filter((t) => !t.startsWith('jumper')) },
    { id: 'jumpers', label: 'Jumpers', types: plain.filter((t) => t.startsWith('jumper')) },
    { id: 'capsules', label: 'Cápsulas', types: smart },
  ].filter((g) => g.types.length > 0);
  // Bench: once the step's parts are on the board the tray has nothing left to offer, so it goes away.
  // Open on the group that has what this step asks for (the tray remounts with each step).
  const [group, setGroup] = useState(
    () => groups.find((g) => needed && g.types.some((t) => needed.has(t)))?.id ?? 'parts'
  );
  const current = groups.find((g) => g.id === group) ?? groups[0];
  if (bench && groups.length === 0) return null;
  return (
    <section
      className="tray-box"
      style={{
        width: 340,
        flex: 'none',
        background: 'var(--color-surface)',
        borderRadius: 28,
        padding: '18px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 17, margin: '0 0 2px' }}>
        {bench && needed ? 'Pegue na bandeja' : 'Bandeja'}
      </h2>
      {!(bench && needed) && (
        <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--color-neutral-600)' }}>
          Arraste para a bancada. Clique numa peça para girar; arraste para fora para remover.
        </p>
      )}
      {groups.length > 1 && !(bench && needed) && (
        <Tabs
          label="Grupos de peças"
          value={current.id}
          tabs={groups.map((g) => ({ id: g.id, label: g.label }))}
          onChange={setGroup}
        />
      )}
      {current?.id === 'capsules' && !(bench && needed) && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--color-neutral-600)' }}>
          Cabem só nos 6 encaixes tracejados (E1–E6), com P1, P2 e P3 em 3 colunas. O amperímetro só funciona no E2.
          Clique na cápsula para mudar o modo; no máximo 3 ao mesmo tempo.
        </p>
      )}
      {current && (
        <TrayGrid
          types={bench && needed ? groups.flatMap((g) => g.types) : current.types}
          used={used}
          onDragStart={onDragStart}
          needed={bench ? needed : null}
          dragging={!live}
        />
      )}
    </section>
  );
}

function TrayGrid({ types, used, onDragStart, needed = null, dragging = true }) {
  return (
    <div className="tray-grid">
      {types.map((type) => {
        // Bench: only the parts of this step are active; the camera reads the real board, so nothing is dragged.
        const off = needed ? !needed.has(type) : false;
        const left = off || !dragging ? 0 : KIT_LIMITS[type] - (used[type] || 0);
        return (
          // biome-ignore lint/a11y/useSemanticElements: This is a drag source with button semantics, not a form control.
          <div
            key={type}
            className={`tray-item${needed && !off ? ' needed' : ''}${off ? ' off' : ''}`}
            onPointerDown={(e) => {
              if (left > 0) onDragStart(type, e);
            }}
            role="button"
            tabIndex={left > 0 ? 0 : -1}
            aria-disabled={left <= 0}
            aria-label={NOMES[type]}
            style={{
              opacity: off ? 0.3 : left > 0 || !dragging ? 1 : 0.4,
              cursor: left > 0 ? 'grab' : dragging ? 'not-allowed' : 'default',
            }}
          >
            <PieceView
              type={type}
              width={type.startsWith('jumper') ? 40 + DEFS[type].len * 8 : isCapsule(type) ? 72 : 54}
              height={24}
              pins={false}
            />
            <div>
              <div className="name">{NOMES[type]}</div>
              {type.startsWith('jumper') && (
                <div className="meta">Alcance: {DEFS[type].len + 1} colunas, de ponta a ponta</div>
              )}
              {type === 'potenciometro' && <div className="meta">100 Ω – 10 kΩ (−/+ em sete valores)</div>}
              {needed ? (
                <div className="meta tray-need">
                  Use {needed.get(type) ?? 1} {(needed.get(type) ?? 1) > 1 ? 'peças' : 'peça'}
                </div>
              ) : (
                <div className="meta">
                  {left} de {KIT_LIMITS[type]} no kit
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
