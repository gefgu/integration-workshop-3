import { useEffect, useRef, useState } from 'react';
import Icon, { type IconName } from '../components/Icon.tsx';

export interface MenuOption {
  id: string;
  label: string;
  icon: IconName | 'help' | 'resume';
  onSelect: () => void;
}

/**
 * The game menu: a long press on the joystick (Escape on a keyboard) opens it over the current screen.
 * Sound, help, ranking, camera and leaving live here, so the screens only show Voltar / Próximo / the choices.
 * The joystick moves between the tiles in any direction, the click picks one, a long press closes it.
 */
export default function BenchMenu({ options, onClose }: { options: MenuOption[]; onClose: () => void }) {
  const grid = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(0);
  // The highlight follows `selected` (not only the browser focus, which a kiosk window may not have).
  useEffect(() => {
    grid.current?.querySelectorAll<HTMLButtonElement>('button')[selected]?.focus();
  }, [selected]);
  // The menu owns the keys while open (capture phase: the screen underneath does not react).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tiles = [...(grid.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
      if (!tiles.length) return;
      const at = Math.min(selected, tiles.length - 1);
      // Like everywhere on the bench: → and ↑ go forward, ← and ↓ go back.
      const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: 1, ArrowDown: -1 };
      if (event.key in moves) {
        setSelected(Math.min(tiles.length - 1, Math.max(0, at + moves[event.key])));
      } else if (event.key === ' ' || event.key === 'Enter') {
        tiles[at].click();
      } else if (event.key === 'Escape') {
        onClose();
      } else {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, selected]);

  return (
    <div className="bench-menu" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="bench-menu-card">
        <h2>Menu</h2>
        <div className="bench-menu-grid" ref={grid}>
          {options.map((option, i) => (
            <button
              key={option.id}
              type="button"
              className={`bench-menu-tile${i === selected ? ' is-selected' : ''}`}
              onClick={() => {
                onClose();
                option.onSelect();
              }}
            >
              <MenuIcon name={option.icon} />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
        <p className="bench-menu-hint">Mova o joystick para escolher · clique para confirmar · segure para fechar</p>
      </div>
    </div>
  );
}

function MenuIcon({ name }: { name: MenuOption['icon'] }) {
  if (name === 'help') return <span className="bench-menu-glyph">?</span>;
  if (name === 'resume') return <Icon name="play" size={34} />;
  return <Icon name={name} size={34} />;
}
