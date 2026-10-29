import { useEffect, useState } from 'react';
import type { BenchApi, VisionState } from './benchApi.ts';

const OFF: VisionState = { available: false };

/**
 * Keeps the previous state object while the stable circuit has the same version, so the lesson does not
 * re-validate on every poll; only the frame status (valid/reason) is refreshed in place.
 */
export function mergeVision(prev: VisionState, next: VisionState): VisionState {
  if (!next.available) return prev.available || prev.reason !== next.reason ? next : prev;
  if (prev.available && prev.version === next.version) {
    return prev.valid === next.valid && prev.reason === next.reason
      ? prev
      : { ...prev, valid: next.valid, reason: next.reason, running: next.running };
  }
  return next;
}

/** Polls the bench service for the camera board (5 fps pipeline → ~3 polls a second is enough). */
export function useVision(api: BenchApi, everyMs = 350): VisionState {
  const [state, setState] = useState<VisionState>(OFF);
  useEffect(() => {
    let alive = true;
    const tick = () =>
      api.vision().then(
        (next) => alive && setState((prev) => mergeVision(prev, next)),
        () => alive && setState((prev) => mergeVision(prev, OFF))
      );
    void tick();
    const timer = setInterval(tick, everyMs);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [api, everyMs]);
  return state;
}
