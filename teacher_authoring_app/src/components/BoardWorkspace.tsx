import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildPiece,
  colX,
  flip,
  nearestHole,
  nextPieceId,
  placementError,
  rowY,
  SOCKET,
  span,
} from '../engine/board.ts';
import { CAPSULE, DEFS, NOMES, POT_DEFAULT, POT_VALUES } from '../engine/sim.ts';
import type { CircuitTrail, Piece } from '../model/types.ts';
import Breadboard from './Breadboard.tsx';
import PieceView from './PieceView.tsx';
import Tray from './Tray.tsx';

const BODY_PAD = SOCKET / 2;

/**
 * Bandeja + bancada 11×6 com arrastar e soltar.
 *  - pieces/onChange: controlled list of { id, type, a, b, row }
 *  - trail: { edgeIds:Set, nodes:Set } of the energized path (or null)
 *  - ledMa: brightness input for lit LEDs
 *  - pressed/onPress(id, down): held pushbuttons (omit onPress for a non-interactive button)
 *  - readOnly: a preview — no tray, no dragging, no clearing
 *  - highlightIds: Set of piece ids drawn with an accent outline (e.g. the current step's piece)
 */
interface BoardWorkspaceProps {
  pieces: Piece[];
  onChange: (pieces: Piece[]) => void;
  trail?: CircuitTrail | null;
  ledMa?: number;
  pressed?: Set<string> | null;
  onPress?: (id: string, down: boolean) => void;
  onNotice?: (message: string) => void;
  readOnly?: boolean;
  highlightIds?: Set<string> | null;
}
export default function BoardWorkspace({
  pieces,
  onChange,
  trail = null,
  ledMa = 0,
  pressed = null,
  onPress,
  onNotice,
  readOnly = false,
  highlightIds = null,
}: BoardWorkspaceProps) {
  const boardRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [notice, setNotice] = useState(null);
  const dragRef = useRef(null);
  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;

  const say = useCallback(
    (msg) => {
      setNotice(msg);
      if (onNotice) onNotice(msg);
    },
    [onNotice]
  );

  const holeAt = useCallback((clientX, clientY) => {
    const r = boardRef.current.getBoundingClientRect();
    return nearestHole(clientX - r.left, clientY - r.top);
  }, []);

  const begin = useCallback((next) => {
    dragRef.current = next;
    setDrag(next);
  }, []);

  function startTrayDrag(type, e) {
    e.preventDefault();
    begin({ type, id: null, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: true });
  }

  function startPieceDrag(p, e) {
    e.preventDefault();
    e.stopPropagation();
    begin({
      type: p.type,
      id: p.id,
      dir: p.b >= p.a ? 1 : -1,
      x: e.clientX,
      y: e.clientY,
      sx: e.clientX,
      sy: e.clientY,
      moved: false,
    });
  }

  useEffect(() => {
    if (readOnly) return;

    function move(e) {
      const d = dragRef.current;
      if (!d) return;
      const moved = d.moved || Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 5;
      begin({ ...d, x: e.clientX, y: e.clientY, moved });
    }
    function up(e) {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      setDrag(null);
      const cur = piecesRef.current;
      if (d.id && !d.moved) {
        // click without moving: flip the piece
        onChange(cur.map((p) => (p.id === d.id ? flip(p) : p)));
        setNotice(null);
        return;
      }
      const hole = holeAt(e.clientX, e.clientY);
      if (!hole) {
        if (d.id) onChange(cur.filter((p) => p.id !== d.id));
        return;
      }
      const piece = buildPiece(d.type, d.id || nextPieceId(cur), hole.col, hole.row, d.dir || 1);
      const err = piece ? placementError(cur, piece, d.id) : 'A peça sai da bancada.';
      if (err) {
        say(err);
        return;
      }
      setNotice(null);
      onChange(d.id ? cur.map((p) => (p.id === d.id ? piece : p)) : [...cur, piece]);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange, say, holeAt, begin, readOnly]);

  function stepPot(p, dir) {
    const i = POT_VALUES.indexOf(p.value || POT_DEFAULT);
    const next = POT_VALUES[Math.min(POT_VALUES.length - 1, Math.max(0, i + dir))];
    onChange(piecesRef.current.map((x) => (x.id === p.id ? { ...x, value: next } : x)));
  }

  // Snap preview while dragging over the board.
  let preview = null;
  if (drag?.moved && boardRef.current) {
    const hole = holeAt(drag.x, drag.y);
    if (hole) {
      const piece = buildPiece(drag.type, drag.id || 'preview', hole.col, hole.row, drag.dir || 1);
      preview = piece ? { piece, err: placementError(pieces, piece, drag.id) } : null;
    }
  }

  const energizedIds = trail ? trail.edgeIds : new Set();
  const brilho = Math.min(1, ledMa / 8);

  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', justifyContent: 'center' }}>
      {!readOnly && <Tray pieces={pieces} onDragStart={startTrayDrag} />}
      <div>
        <Breadboard boardRef={boardRef} trail={trail}>
          {preview && (
            <div
              style={{
                position: 'absolute',
                left: colX(span(preview.piece)[0]) - BODY_PAD,
                top: rowY(preview.piece.row) - 16,
                width: colX(span(preview.piece)[1]) - colX(span(preview.piece)[0]) + 2 * BODY_PAD,
                height: 32,
                borderRadius: 8,
                border: `2px dashed ${preview.err ? 'var(--color-accent-700)' : 'var(--color-accent-2-600)'}`,
                background: preview.err ? 'rgba(198,113,57,.15)' : 'rgba(143,160,115,.18)',
                zIndex: 1,
              }}
            />
          )}

          {pieces.map((p) => {
            const [lo, hi] = span(p);
            const hidden = drag && drag.id === p.id && drag.moved;
            const glow = energizedIds.has(p.id);
            return (
              <div
                key={p.id}
                onPointerDown={readOnly ? undefined : (e) => startPieceDrag(p, e)}
                title={NOMES[p.type]}
                style={{
                  position: 'absolute',
                  left: colX(lo) - BODY_PAD,
                  top: rowY(p.row) - (p.type.startsWith('jumper') ? SOCKET / 2 : 14),
                  width: colX(hi) - colX(lo) + 2 * BODY_PAD,
                  zIndex: 3,
                  cursor: readOnly ? 'default' : 'grab',
                  opacity: hidden ? 0.25 : 1,
                  outline: highlightIds?.has(p.id) ? '3px solid var(--color-accent)' : 'none',
                  outlineOffset: 2,
                  borderRadius: 8,
                  filter:
                    glow && p.type !== 'led' && p.type !== 'buzzer'
                      ? 'drop-shadow(0 0 6px rgba(143,160,115,.9))'
                      : 'none',
                }}
              >
                <PieceView
                  type={p.type}
                  width={colX(hi) - colX(lo) + 2 * BODY_PAD}
                  height={p.type.startsWith('jumper') ? SOCKET : 28}
                  fill
                  reversed={p.a > p.b}
                  lit={glow && (p.type === 'led' || p.type === 'buzzer')}
                  brilho={brilho}
                  value={p.value}
                  onPotStep={!readOnly && p.type === 'potenciometro' ? (dir) => stepPot(p, dir) : undefined}
                  pressed={!!pressed && pressed.has(p.id)}
                  onButton={p.type === 'botao' && onPress ? (down) => onPress(p.id, down) : undefined}
                />
              </div>
            );
          })}
        </Breadboard>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 36, marginTop: 8 }}>
          {!readOnly && (
            <button
              type="button"
              className="btn-outline"
              disabled={pieces.length === 0}
              onClick={() => {
                setNotice(null);
                onChange([]);
              }}
            >
              Limpar bancada
            </button>
          )}
          <div style={{ fontSize: 13, color: 'var(--color-accent-800)' }} role="status">
            {notice}
          </div>
        </div>
      </div>

      {drag?.moved && (
        <div
          className="ghost-overlay"
          style={{
            left: drag.x,
            top: drag.y,
            background: CAPSULE[DEFS[drag.type].cor].bg,
            color: CAPSULE[DEFS[drag.type].cor].ink,
            border: DEFS[drag.type].cor === 'branco' ? '1px solid #b9b2a4' : 'none',
          }}
        >
          {NOMES[drag.type]}
        </div>
      )}
    </div>
  );
}
