import { useEffect, useMemo, useState } from 'react';
import { simulateCapsules } from '../engine/capsules.ts';
import type { Piece } from '../model/types.ts';

const TICK_MS = 50;

/**
 * Live smart-capsule state for a board: OLED readings and the loads the pulse drives through P3.
 * A clock only runs while a pulse source is on the board and `live`.
 */
export function useCapsules(pieces: Piece[], pressed: Set<string> | null, live = true) {
  const [t, setT] = useState(0);
  const hasPulse = pieces.some((p) => p.type === 'capsula_pulso');

  useEffect(() => {
    if (!live || !hasPulse) return;
    const start = Date.now();
    const timer = setInterval(() => setT(Date.now() - start), TICK_MS);
    return () => clearInterval(timer);
  }, [live, hasPulse]);

  return useMemo(() => simulateCapsules(pieces, { pressed, t: live ? t : 0 }), [pieces, pressed, t, live]);
}
