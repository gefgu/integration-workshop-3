import {
  COLS, BANK_ROWS, SOCKET, BOARD_W, BOARD_H, CHANNEL_TOP, CHANNEL_BOTTOM,
  colX, rowY
} from '../engine/board.ts';

/** The visual breadboard surface: numbered columns, two hole banks, and center channel. */
export default function Breadboard({ boardRef, trail = null, children }) {
  return (
    <div ref={boardRef} style={{ position: 'relative', width: BOARD_W, height: BOARD_H, background: 'var(--color-neutral-200)', borderRadius: 24, boxShadow: 'inset 0 2px 0 rgba(255,255,255,.5), var(--shadow-md)' }}>
      <div style={{ position: 'absolute', left: 14, top: CHANNEL_TOP, width: BOARD_W - 28, height: CHANNEL_BOTTOM - CHANNEL_TOP, borderRadius: 10, background: 'var(--color-neutral-400)', opacity: 0.28 }} />

      {Array.from({ length: COLS }).map((_, ci) => (
        <div key={'n' + ci} style={{ position: 'absolute', left: colX(ci + 1) - 9, top: 26, width: 18, textAlign: 'center', fontSize: 10, color: trail && trail.nodes.has(ci + 1) ? 'var(--color-accent-2-700)' : 'var(--color-neutral-500)', fontWeight: 700 }}>{ci + 1}</div>
      ))}

      {Array.from({ length: COLS }).map((_, ci) => (
        Array.from({ length: BANK_ROWS * 2 }).map((__, r) => {
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
      {children}
    </div>
  );
}
