import { createContext, useContext } from 'react';

/**
 * True inside the workbench's 7" screen (and its preview on the teacher site): screens show less text, bigger
 * controls, and long readings are split into several screens.
 */
export const BenchModeContext = createContext(false);

export const useBenchMode = () => useContext(BenchModeContext);

/** Splits reading paragraphs into screens of at most two paragraphs and about `maxChars` characters. */
export function pageParagraphs(paragraphs: string[], maxChars = 300): string[][] {
  const pages: string[][] = [];
  for (const p of paragraphs) {
    const last = pages[pages.length - 1];
    const size = last ? last.reduce((n, t) => n + t.length, 0) : 0;
    if (last && last.length < 2 && size + p.length <= maxChars) last.push(p);
    else pages.push([p]);
  }
  return pages;
}

/**
 * On the bench the student builds on the real protoboard; the camera (vision pipeline) reports what is there and
 * the screen's board only mirrors it. True while that mirror is on (no dragging on the screen).
 */
export const BenchLiveContext = createContext(false);
export const useLiveBoard = () => useContext(BenchLiveContext);

/** The part types the current step asks for; the tray greys out the rest. null = no limit. */
export const StepPartsContext = createContext<Set<string> | null>(null);
export const useStepParts = () => useContext(StepPartsContext);

/** Physical controls on the bench: the joystick sends arrows + Enter, Back sends Escape, Energizar sends "e". */
export const isEnergizeKey = (event: KeyboardEvent) => event.key === 'e' || event.key === 'E';
