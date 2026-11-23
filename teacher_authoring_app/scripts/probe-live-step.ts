// Diagnostic: asks the running bench's validator about each step of the free-battery lesson, with the pieces the
// camera sees now (mirrored like the screen does). Usage: node --import tsx scripts/probe-live-step.ts [url]
import { curriculumLessons, SEED_PREFIX } from '../src/curriculum/lessons.ts';
import { mirrorVisionPiece } from '../src/bench/mirrorVision.ts';
import { cameraLessonPieces } from '../src/player/cameraPolarity.ts';
import { setValidatorBase, validateStep } from '../src/api/validator.ts';

const base = process.argv[2] ?? 'http://127.0.0.1:8765';
const lesson = curriculumLessons().find((l) => l.id === `${SEED_PREFIX}03-guiada-1k-livre`)!;
const state = await (await fetch(`${base}/vision/state`)).json();
const raw = (state.pieces ?? []).map(mirrorVisionPiece);
const pieces = cameraLessonPieces(lesson, raw) ?? raw;
console.log('camera pieces (screen coordinates):', JSON.stringify(pieces));
setValidatorBase(`${base}/validator`);
const steps = lesson.steps.map((s, i) => [i, s.action, s.pieceId ?? '']);
for (const [i, action, pieceId] of steps) {
  if (!['place_component', 'place_connection', 'connect_circuit'].includes(action as string)) continue;
  const r = await validateStep({ lesson, pieces, stepIdx: i as number });
  console.log(i, action, pieceId, r.ok ? `${r.result.approved ? 'APPROVED' : 'BLOCKED'} ${r.result.category} ${r.result.message}` : JSON.stringify(r));
}
