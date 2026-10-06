import { BOARD_H, BOARD_W } from '../engine/board.ts';
import type { Piece } from '../model/types.ts';
import BoardWorkspace from './BoardWorkspace.tsx';

const PREVIEW_SCALE = 0.5;
const keepPieces = () => {};

export default function CircuitPreview({ pieces, label }: { pieces: Piece[]; label: string }) {
  return (
    <div className="circuit-preview" role="img" aria-label={label}>
      <div
        className="circuit-preview-board"
        style={{ width: BOARD_W, height: BOARD_H, transform: `scale(${PREVIEW_SCALE})` }}
      >
        <BoardWorkspace pieces={pieces} onChange={keepPieces} readOnly />
      </div>
    </div>
  );
}
