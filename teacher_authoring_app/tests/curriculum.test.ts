import assert from 'node:assert/strict';
import test from 'node:test';
import { curriculumLessons, curriculumModules, SEED_PREFIX } from '../src/curriculum/lessons.ts';
import { placementError } from '../src/engine/board.ts';
import { diagnose } from '../src/engine/diagnose.ts';
import { lessonProblems, validateLesson } from '../src/model/lesson.ts';
import { challengeSteps, cumulativeBoard, effectiveSteps, needsBuild, startPieces } from '../src/model/steps.ts';
import { buildPhases } from '../src/player/phases.ts';

const lessons = curriculumLessons();
const roundTrip = (l) => validateLesson(JSON.parse(JSON.stringify(l)));

test('the curriculum has every Notion lesson, guided and challenge', () => {
  const ids = lessons.map((l) => l.id);
  for (const n of ['01', '02', '03', '04', '05', '06', '07', '09'])
    for (const kind of ['guiada', 'desafio']) assert.ok(ids.includes(`${SEED_PREFIX}${n}-${kind}`), `${n}-${kind}`);
  for (const id of ['08-guiada', '08-potenciometro', '08-desafio', '10-guiada'])
    assert.ok(ids.includes(`${SEED_PREFIX}${id}`), id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(lessons.length, 20);
});

test('every lesson survives the same validation as an imported file and has nothing left to fix', () => {
  for (const l of lessons) {
    const r = roundTrip(l);
    assert.equal(r.ok, true, `${l.id}: ${(r as { error?: string }).error ?? ''}`);
    assert.deepEqual(lessonProblems(r.ok ? r.lesson : l), [], l.id);
    assert.ok(l.teacherNotes && l.tags?.includes('exemplo'), `${l.id} documents itself for teachers`);
  }
});

test('the round trip keeps what makes the lessons different (start, settings, experiments, drawings)', () => {
  for (const l of lessons) {
    const out = roundTrip(l);
    assert.ok(out.ok);
    const back = out.ok ? out.lesson : l;
    assert.deepEqual(back.start ?? null, l.start ?? null, l.id);
    assert.deepEqual(back.settings ?? null, l.settings ?? null, l.id);
    assert.deepEqual(
      back.steps.map((s) => [s.id, s.action, !!s.experiment, !!s.illustration, s.widget ?? null]),
      l.steps.map((s) => [s.id, s.action, !!s.experiment, !!s.illustration, s.widget ?? null]),
      l.id
    );
    assert.deepEqual(back.board.pieces, l.board.pieces, l.id);
  }
});

test('step and question ids are unique across the whole curriculum', () => {
  const seen = new Set<string>();
  for (const l of lessons) {
    for (const id of [
      ...l.steps.map((s) => s.id),
      ...l.quizzes.map((q) => q.id),
      ...l.quizzes.flatMap((q) => q.options.map((o) => o.id)),
    ]) {
      assert.ok(!seen.has(id), `duplicate ${id}`);
      seen.add(id);
    }
    for (const s of l.steps.filter((x) => x.action === 'interact'))
      assert.ok(
        l.quizzes.some((q) => q.id === s.quizId),
        `${l.id}: ${s.id}`
      );
  }
});

test('guided lessons build piece by piece into their target board', () => {
  for (const l of lessons.filter((x) => x.kind === 'guided' && x.board.pieces.length)) {
    const steps = effectiveSteps(l);
    const placed = [];
    for (const [i, s] of steps.entries()) {
      if (s.action !== 'place_component' && s.action !== 'place_connection') continue;
      const piece = cumulativeBoard(l, i).at(-1);
      assert.equal(placementError(placed, piece), null, `${l.id}: ${s.id}`);
      placed.push(piece);
    }
    assert.equal(placed.length, l.board.pieces.length, l.id);
  }
});

test('challenge lessons start from the right bench and the target works', () => {
  for (const l of lessons.filter((x) => x.kind === 'challenge')) {
    const opts = { allowNoResistor: !!l.settings?.allowNoResistor };
    const solved = diagnose(l.board.pieces, new Set(['btnA', 'btnB']), opts);
    // Lesson 1 only seats the battery: its success signal is the status LED, not a closed circuit.
    if (!l.settings?.statusLed) assert.equal(solved.code, 'valido', l.id);
    if (needsBuild(l) && l.start) {
      const start = startPieces(l, () => 0);
      assert.ok(start.length, l.id);
      const state = (ps) => JSON.stringify([...ps].sort((a, b) => a.id.localeCompare(b.id)));
      assert.notEqual(state(start), state(l.board.pieces), `${l.id} starts unsolved, loose or with another value`);
    }
  }
  const l2 = lessons.find((l) => l.id.endsWith('02-desafio'));
  assert.deepEqual(
    startPieces(l2, () => 0).map((p) => p.id),
    ['bat', 'led', 'w2']
  );
  assert.deepEqual(
    startPieces(l2, () => 0.99).map((p) => p.id),
    ['bat', 'led', 'w1']
  );
});

test('phases: challenges with follow-up steps play the build first, then the lab', () => {
  const l3 = lessons.find((l) => l.id.endsWith('03-desafio'));
  assert.equal(needsBuild(l3), false);
  assert.deepEqual(
    buildPhases(l3).map((p) => p.type),
    ['interact', 'experiment', 'interact', 'done']
  );
  const l5 = lessons.find((l) => l.id.endsWith('05-desafio'));
  assert.deepEqual(
    buildPhases(l5).map((p) => p.type),
    ['challenge', 'experiment', 'interact', 'done']
  );
  assert.equal(challengeSteps(l5).length, 2);
});

test('modules reference only lessons that exist and the full track has all of them', () => {
  const ids = new Set(lessons.map((l) => l.id));
  const mods = curriculumModules();
  for (const m of mods) for (const id of m.lessonIds) assert.ok(ids.has(id), `${m.title}: ${id}`);
  const full = mods.at(-1);
  assert.equal(new Set(full.lessonIds).size, lessons.length);
});
