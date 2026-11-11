import type { VisionPiece, VisionState } from './benchApi.ts';
import { COLS } from '../engine/board.ts';

/** Mirror camera columns left-to-right, keeping each piece in its bank and row. */
export function mirrorVisionPiece<T extends VisionPiece>(piece: T): T {
  return { ...piece, a: COLS + 1 - piece.a, b: COLS + 1 - piece.b,
    ...(piece.c == null ? {} : { c: COLS + 1 - piece.c }) };
}

export function mirrorVision(state: VisionState): VisionState {
  return { ...state, pieces: state.pieces?.map(mirrorVisionPiece), unknown: state.unknown?.map(mirrorVisionPiece) };
}
