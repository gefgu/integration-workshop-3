import { useEffect, useRef, useState } from 'react';
import {
  COLS, ROWS, BANK_ROWS, SOCKET, BOARD_W, BOARD_H, CHANNEL_TOP, CHANNEL_BOTTOM,
  colX, rowY, span, nearestHole, buildPiece, placementError, flip, nextPieceId
} from '../engine/board.js';
import { DEFS, NOMES } from '../engine/sim.js';
import PieceView from './PieceView.jsx';
import Tray from './Tray.jsx';

const BODY_PAD = SOCKET / 2;

/**
 * Bandeja + bancada 11×6 com arrastar e soltar.
 *  - pieces/onChange: controlled list of { id, type, a, b, row }
 *  - trail: { edgeIds:Set, nodes:Set } of the energized path (or null)
 *  - ledMa: brightness input for lit LEDs
 */
export default function BoardWorkspace({ pieces, onChange, trail = null, ledMa = 0, onNotice }) {
  const boardRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [notice, setNotice] = useState(null);
  const dragRef = useRef(null);
  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;

  const say = (msg) => { setNotice(msg); if (onNotice) onNotice(msg); };

  function holeAt(clientX, clientY) {
    const r = boardRef.current.getBoundingClientRect();
    return nearestHole(clientX - r.left, clientY - r.top);
  }

  function begin(next) { dragRef.current = next; setDrag(next); }

  function startTrayDrag(type, e) {
    e.preventDefault();
    begin({ type, id: null, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: true });
  }

  function startPieceDrag(p, e) {
    e.preventDefault();
    e.stopPropagation();
    begin({ type: p.type, id: p.id, dir: p.b >= p.a ? 1 : -1, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false });
  }

  useEffect(() => {
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
        onChange(cur.map(p => (p.id === d.id ? flip(p) : p)));
        setNotice(null);
        return;
      }
      const hole = holeAt(e.clientX, e.clientY);
      if (!hole) {
        if (d.id) onChange(cur.filter(p => p.id !== d.id));
        return;
      }
      const piece = buildPiece(d.type, d.id || nextPieceId(cur), hole.col, hole.row, d.dir || 1);
      const err = piece ? placementError(cur, piece, d.id) : 'A peça sai da bancada.';
      if (err) { say(err); return; }
      setNotice(null);
      onChange(d.id ? cur.map(p => (p.id === d.id ? piece : p)) : [...cur, piece]);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange]);

  // Snap preview while dragging over the board.
  let preview = null;
  if (drag && drag.moved && boardRef.current) {
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
      <Tray pieces={pieces} onDragStart={startTrayDrag} />
      <div>
        <div ref={boardRef} style={{ position: 'relative', width: BOARD_W, height: BOARD_H, background: 'var(--color-neutral-200)', borderRadius: 24, boxShadow: 'inset 0 2px 0 rgba(255,255,255,.5), var(--shadow-md)' }}>
          <div style={{ position: 'absolute', left: 14, top: 10, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-neutral-500)' }}>
            2 bancos de {COLS} × {BANK_ROWS} · cada coluna é um único nó elétrico
          </div>
          <div style={{ position: 'absolute', left: 14, top: CHANNEL_TOP, width: BOARD_W - 28, height: CHANNEL_BOTTOM - CHANNEL_TOP, borderRadius: 10, background: 'var(--color-neutral-400)', opacity: 0.28 }} />

          {Array.from({ length: COLS }).map((_, ci) => (
            <div key={'n' + ci} style={{ position: 'absolute', left: colX(ci + 1) - 9, top: 26, width: 18, textAlign: 'center', fontSize: 10, color: trail && trail.nodes.has(ci + 1) ? 'var(--color-accent-2-700)' : 'var(--color-neutral-500)', fontWeight: 700 }}>{ci + 1}</div>
          ))}

          {Array.from({ length: COLS }).map((_, ci) => (
            Array.from({ length: ROWS }).map((__, r) => {
              const on = trail && trail.nodes.has(ci + 1);
              return (
                <div key={ci + '-' + r} style={{
                  position: 'absolute', left: colX(ci + 1) - SOCKET / 2, top: rowY(r) - SOCKET / 2, width: SOCKET, height: SOCKET, borderRadius: 6,
                  background: on ? 'var(--color-accent-2-500)' : 'var(--color-neutral-300)',
                  boxShadow: on ? '0 0 8px rgba(143,160,115,.8)' : 'inset 0 2px 3px rgba(0,0,0,.28)'
                }} />
              );
            })
          ))}

          {preview && (
            <div style={{
              position: 'absolute', left: colX(span(preview.piece)[0]) - BODY_PAD, top: rowY(preview.piece.row) - 16,
              width: colX(span(preview.piece)[1]) - colX(span(preview.piece)[0]) + 2 * BODY_PAD, height: 32, borderRadius: 8,
              border: `2px dashed ${preview.err ? 'var(--color-accent-700)' : 'var(--color-accent-2-600)'}`,
              background: preview.err ? 'rgba(198,113,57,.15)' : 'rgba(143,160,115,.18)', zIndex: 1
            }} />
          )}

          {pieces.map(p => {
            const [lo, hi] = span(p);
            const hidden = drag && drag.id === p.id && drag.moved;
            const glow = energizedIds.has(p.id);
            return (
              <div
                key={p.id}
                onPointerDown={(e) => startPieceDrag(p, e)}
                title={NOMES[p.type]}
                style={{
                  position: 'absolute', left: colX(lo) - BODY_PAD, top: rowY(p.row) - 14, width: colX(hi) - colX(lo) + 2 * BODY_PAD,
                  zIndex: 3, cursor: 'grab', opacity: hidden ? 0.25 : 1,
                  filter: glow && p.type !== 'led' ? 'drop-shadow(0 0 6px rgba(143,160,115,.9))' : 'none'
                }}
              >
                <PieceView type={p.type} width={colX(hi) - colX(lo) + 2 * BODY_PAD} height={28} reversed={p.a > p.b} lit={glow && p.type === 'led'} brilho={brilho} />
              </div>
            );
          })}
        </div>
        <div style={{ minHeight: 22, marginTop: 8, fontSize: 13, color: 'var(--color-accent-800)' }} role="status">{notice}</div>
      </div>

      {drag && drag.moved && (
        <div className="ghost-overlay" style={{ left: drag.x, top: drag.y, background: DEFS[drag.type].color, color: DEFS[drag.type].ink }}>
          {NOMES[drag.type]}
        </div>
      )}
    </div>
  );
}
