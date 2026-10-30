import { BANK_ROWS, BOARD_H, BOARD_W, CHANNEL_BOTTOM, CHANNEL_TOP, COLS, colX, ROWS, rowY, SOCKET } from '../engine/board.ts';
import { nodeOf } from '../engine/nodes.ts';

/** The visual breadboard surface: numbered columns, two hole banks, and center channel. */
export default function Breadboard({ boardRef, trail = null, children, labels = true }) {
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
      {labels && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 14,
            top: CHANNEL_TOP,
            width: BOARD_W - 28,
            height: CHANNEL_BOTTOM - CHANNEL_TOP,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.3,
            color: 'var(--color-neutral-700)',
            pointerEvents: 'none',
          }}
        >
          ▲ nós A1–A11 · abertura central: A e B NÃO se tocam · nós B1–B11 ▼
        </div>
      )}

      {/* Column numbers above bank A and below bank B, clear of the holes (the first hole starts at y = 29). */}
      {[8, rowY(ROWS - 1) + 22].flatMap((top) =>
        Array.from({ length: COLS }, (_, ci) => ci + 1).map((col) => (
          <div
            key={`n${top}-${col}`}
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: colX(col) - 9,
              top,
              width: 18,
              textAlign: 'center',
              fontSize: 12,
              color:
                trail?.nodes.has(nodeOf(col, 0)) || trail?.nodes.has(nodeOf(col, BANK_ROWS))
                  ? 'var(--color-accent-2-700)'
                  : 'var(--color-neutral-700)',
              fontWeight: 700,
            }}
          >
            {col}
          </div>
        ))
      )}

      {Array.from({ length: COLS }, (_, ci) => ci + 1).flatMap((col) =>
        [0, BANK_ROWS].map((start) => {
          const on = trail?.nodes.has(nodeOf(col, start));
          return (
            <div
              key={`node-${col}-${start}`}
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: colX(col) - 4,
                top: rowY(start),
                width: 8,
                height: rowY(start + BANK_ROWS - 1) - rowY(start),
                background: on ? 'var(--color-accent-2-500)' : 'var(--color-neutral-500)',
                opacity: on ? 0.85 : 0.65,
                borderRadius: 3,
              }}
            />
          );
        })
      )}
      {Array.from({ length: COLS }, (_, ci) => ci + 1).map((col) =>
        Array.from({ length: BANK_ROWS * 2 }, (_, row) => row).map((row) => {
          const on = trail?.nodes.has(nodeOf(col, row));
          return (
            <div
              key={`${col}-${row}`}
              title={`Nó ${row < BANK_ROWS ? 'A' : 'B'}${col}: os 6 furos desta linha vertical estão ligados`}
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
