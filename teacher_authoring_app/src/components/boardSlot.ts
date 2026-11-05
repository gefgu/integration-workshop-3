import { createContext } from 'react';

/**
 * Where the protoboard is drawn when a page keeps it in a fixed half of the screen (sandbox and validator): the
 * board renders into this element (a portal) while the tray and the rest stay in the scrolling half.
 */
export const BoardSlotContext = createContext<HTMLElement | null>(null);
