import { BANK_ROWS, BOARD_H, BOARD_W, CHANNEL_BOTTOM, CHANNEL_TOP, COLS, colX, rowY, SOCKET } from '../engine/board.ts';

/** The visual breadboard surface: numbered columns, two hole banks, and center channel. */
export default function Breadboard({ boardRef, trail = null, children }) {
  return (
    <div
      ref={boardRef}
      style={{
        position: 'relative',
        width: BOARD_W,
        height: BOARD_H,
        background: 'var(--color-neutral-200)',
        borderRadius: 24,
        boxShadow: 'inset 0 2px 0 rgba(255,255,255,.5), var(--shadow-md)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 14,
          top: CHANNEL_TOP,
          width: BOARD_W - 28,
          height: CHANNEL_BOTTOM - CHANNEL_TOP,
          borderRadius: 10,
          background: 'var(--color-neutral-400)',
          opacity: 0.28,
        }}
      />

      {Array.from({ length: COLS }, (_, ci) => ci + 1).map((col) => (
        <div
          key={`n${col}`}
          style={{
            position: 'absolute',
            left: colX(col) - 9,
            top: 26,
            width: 18,
            textAlign: 'center',
            fontSize: 10,
            color: trail?.nodes.has(col) ? 'var(--color-accent-2-700)' : 'var(--color-neutral-500)',
            fontWeight: 700,
          }}
        >
          {col}
        </div>
      ))}

      {Array.from({ length: COLS }, (_, ci) => ci + 1).map((col) =>
        Array.from({ length: BANK_ROWS * 2 }, (_, row) => row).map((row) => {
          const on = trail?.nodes.has(col);
          return (
            <div
              key={`${col}-${row}`}
              style={{
                position: 'absolute',
                left: colX(col) - SOCKET / 2,
                top: rowY(row) - SOCKET / 2,
                width: SOCKET,
                height: SOCKET,
                borderRadius: 6,
                background: on ? 'var(--color-accent-2-500)' : 'var(--color-neutral-300)',
                boxShadow: on ? '0 0 8px rgba(143,160,115,.8)' : 'inset 0 2px 3px rgba(0,0,0,.28)',
              }}
            />
          );
        })
      )}
      {children}
    </div>
  );
}
