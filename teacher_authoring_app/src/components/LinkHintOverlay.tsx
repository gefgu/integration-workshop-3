import { BOARD_H, BOARD_W, colX, rowY, SOCKET } from '../engine/board.ts';
import type { LinkHint } from '../engine/linkHint.ts';

const GREEN = '#2f9e4f';

/**
 * Green dotted line from a component's pin to the column where it must be connected.
 * Drawn above the pieces, never intercepts the mouse (the student keeps dragging as usual).
 */
export default function LinkHintOverlay({ hint }: { hint: LinkHint | null }) {
  if (!hint) return null;
  const x1 = colX(hint.from.col);
  const y1 = rowY(hint.from.row);
  const x2 = colX(hint.to.col);
  const y2 = rowY(hint.to.row);
  const length = Math.hypot(x2 - x1, y2 - y1);
  // Stop the dots at the edge of the destination ring so the arrow points *at* the column.
  const ring = SOCKET / 2 + 4;
  const ux = length ? (x2 - x1) / length : 0;
  const uy = length ? (y2 - y1) / length : 0;
  const ex = x2 - ux * ring;
  const ey = y2 - uy * ring;
  const angle = (Math.atan2(uy, ux) * 180) / Math.PI;
  return (
    <svg
      className="link-hint"
      width={BOARD_W}
      height={BOARD_H}
      viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
      role="img"
      aria-label="Dica: ligue o componente indicado à coluna marcada com o pontilhado verde"
      style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 20 }}
    >
      {/* A white halo under the dots keeps them readable over the pieces. */}
      <line
        x1={x1}
        y1={y1}
        x2={ex}
        y2={ey}
        stroke="#fff"
        strokeWidth={11}
        strokeLinecap="round"
        strokeDasharray="0.1 14"
        opacity={0.9}
      />
      <line
        className="link-hint-line"
        x1={x1}
        y1={y1}
        x2={ex}
        y2={ey}
        stroke={GREEN}
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray="0.1 14"
      />
      <circle cx={x1} cy={y1} r={SOCKET / 2 - 2} fill="none" stroke={GREEN} strokeWidth={3} />
      <circle
        cx={x2}
        cy={y2}
        r={ring}
        fill="rgba(47,158,79,.15)"
        stroke={GREEN}
        strokeWidth={3}
        strokeDasharray="2 6"
        strokeLinecap="round"
      />
      <polygon points="0,-8 14,0 0,8" fill={GREEN} transform={`translate(${ex} ${ey}) rotate(${angle})`} />
    </svg>
  );
}
