import type { Lesson, Piece } from '../model/types.ts';

/** The confirmed orientation of the current physical 1 kΩ test setup.
 * The camera detects positions, not polarity; this is not a polarity measurement.
 */
export function cameraLessonPieces(lesson: Lesson, pieces: Piece[] | null): Piece[] | null {
  if (pieces && /^curriculo-teste-voltimetro-buzzer(?:-p\d+)?$/.test(lesson.id))
    return pieces.map((piece) => piece.type === 'buzzer' || piece.type === 'led'
      ? { ...piece, a: Math.min(piece.a, piece.b), b: Math.max(piece.a, piece.b) }
      : piece);
  if (!pieces || !/^curriculo-03-guiada-1k(?:-p\d+)?$/.test(lesson.id)) return pieces;
  return pieces.map((piece) => piece.type === 'led' ? { ...piece, a: piece.b, b: piece.a } : piece);
}
