import { useId } from 'react';
import {
  BANK_ROWS,
  BOARD_H,
  BOARD_W,
  CHANNEL_BOTTOM,
  CHANNEL_TOP,
  COLS,
  colX,
  ROWS,
  rowY,
  SOCKET,
} from '../engine/board.ts';
import { nodeOf } from '../engine/nodes.ts';
import { type TrackLight, trackLights } from '../engine/tracks.ts';

const NO_PIECES = [];

/**
 * The visual breadboard surface: numbered columns, two hole banks, and center channel.
 * Tracks light up to teach how the board connects: a track holding a piece leg glows orange with arrows end to
 * end (all six holes are one connection), stronger when it joins two or more pieces; while dragging, the tracks
 * the new piece would land on glow blue; the energized path stays green.
 */
export default function Breadboard({
  boardRef,
  trail = null,
  children,
  labels = true,
  pieces = NO_PIECES,
  preview = null,
}) {
  const lit = trackLights(pieces);
  const previewLit = trackLights(preview ? [preview] : NO_PIECES);
  const markerId = useId().replace(/:/g, '');
  const look = (node: number) => {
    if (trail?.nodes.has(node)) return 'on';
    if (previewLit.has(node)) return 'preview';
    if (lit.has(node)) return (lit.get(node)?.pieces.length ?? 0) > 1 ? 'joined' : 'lit';
    return 'off';
  };
  const arrows: (TrackLight & { kind: string })[] = [];
  for (const light of [...lit.values(), ...previewLit.values()]) {
    const kind = look(light.node);
    if (kind !== 'on' && kind !== 'off' && !arrows.some((a) => a.node === light.node)) arrows.push({ ...light, kind });
  }
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
          const state = look(nodeOf(col, start));
          const wide = state !== 'off';
          return (
            <div
              key={`node-${col}-${start}`}
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: colX(col) - (wide ? 7 : 4),
                top: rowY(start) - (wide ? 6 : 0),
                width: wide ? 14 : 8,
                height: rowY(start + BANK_ROWS - 1) - rowY(start) + (wide ? 12 : 0),
                background: TRACK_FILL[state],
                opacity: state === 'off' ? 0.65 : 0.9,
                borderRadius: 7,
                boxShadow: TRACK_GLOW[state],
                transition: 'background 160ms, box-shadow 160ms',
              }}
            />
          );
        })
      )}
      {Array.from({ length: COLS }, (_, ci) => ci + 1).map((col) =>
        Array.from({ length: BANK_ROWS * 2 }, (_, row) => row).map((row) => {
          const state = look(nodeOf(col, row));
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
                background: HOLE_FILL[state],
                boxShadow: state === 'on' ? '0 0 8px rgba(143,160,115,.8)' : 'inset 0 2px 3px rgba(0,0,0,.28)',
                transition: 'background 160ms',
              }}
            />
          );
        })
      )}
      {arrows.length > 0 && (
        <svg
          aria-hidden="true"
          width={BOARD_W}
          height={BOARD_H}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          <defs>
            {Object.entries(ARROW_COLOR).map(([kind, color]) => (
              <marker
                key={kind}
                id={`${markerId}-${kind}`}
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="4"
                markerHeight="4"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L10,5 L0,10 z" fill={color} />
              </marker>
            ))}
          </defs>
          {arrows.map(({ node, col, rows, kind }) => {
            const start = rows[0] < BANK_ROWS ? 0 : BANK_ROWS;
            return (
              <line
                key={`${kind}-${node}`}
                className="track-flow"
                x1={colX(col)}
                x2={colX(col)}
                y1={rowY(start) - SOCKET / 2 + 2}
                y2={rowY(start + BANK_ROWS - 1) + SOCKET / 2 - 2}
                stroke={ARROW_COLOR[kind]}
                strokeWidth={kind === 'joined' ? 5 : 3}
                strokeDasharray="7 7"
                strokeLinecap="round"
                markerStart={`url(#${markerId}-${kind})`}
                markerEnd={`url(#${markerId}-${kind})`}
              />
            );
          })}
        </svg>
      )}
      {children}
    </div>
  );
}

const TRACK_FILL = {
  off: 'var(--color-neutral-500)',
  on: 'var(--color-accent-2-500)',
  lit: 'var(--color-accent-400)',
  joined: 'var(--color-accent-500)',
  preview: '#7fa6e8',
};
const TRACK_GLOW = {
  off: 'none',
  on: '0 0 10px rgba(143,160,115,.9)',
  lit: '0 0 10px rgba(246,160,107,.75)',
  joined: '0 0 16px rgba(214,127,72,.95)',
  preview: '0 0 12px rgba(47,102,201,.7)',
};
const HOLE_FILL = {
  off: 'var(--color-neutral-300)',
  on: 'var(--color-accent-2-500)',
  lit: 'var(--color-accent-200)',
  joined: 'var(--color-accent-300)',
  preview: '#cfe0fb',
};
const ARROW_COLOR = { lit: '#d67f48', joined: '#b2622d', preview: '#2f66c9' };
