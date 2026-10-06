import { useEffect, useMemo, useState } from 'react';
import { type CapsuleMemory, simulateCapsules } from '../engine/capsules.ts';
import { isCapsule } from '../engine/sim.ts';
import type { Piece } from '../model/types.ts';

const TICK_MS = 50;
const sameMemory = (a: CapsuleMemory, b: CapsuleMemory) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Live smart-capsule state for a board: OLED readings, loads driven by P3, and the memory
 * capsule's stored bit. A clock only runs while a pulse source is on the board and `live`.
 */
export function useCapsules(pieces: Piece[], pressed: Set<string> | null, live = true) {
  const [memory, setMemory] = useState<CapsuleMemory>({});
  const [t, setT] = useState(0);
  const hasPulse = pieces.some((p) => p.type === 'capsula_pulso');
  const hasCapsule = pieces.some((p) => isCapsule(p.type));

  useEffect(() => {
    if (!live || !hasPulse) return;
    const start = Date.now();
    const timer = setInterval(() => setT(Date.now() - start), TICK_MS);
    return () => clearInterval(timer);
  }, [live, hasPulse]);

  const sim = useMemo(
    () => simulateCapsules(pieces, { pressed, memory, t: live ? t : 0 }),
    [pieces, pressed, memory, t, live]
  );

  // Feed the stored bit back in; the next evaluation reproduces it, so this settles at once.
  useEffect(() => {
    if (hasCapsule && !sameMemory(sim.memory, memory)) setMemory(sim.memory);
  }, [sim, memory, hasCapsule]);

  return sim;
}
