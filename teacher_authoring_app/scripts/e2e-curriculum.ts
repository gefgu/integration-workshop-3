/**
 * End-to-end check of the seeded curriculum, in the order a class would meet it:
 *   teacher API (saved lessons, modules, class assignment) → bench package → bench service (BLE-protocol
 *   WebSocket) → student NFC login → every lesson played through the bench's own validator route →
 *   progress saved on the bench → events synced back → teacher dashboard.
 *
 *   npm run e2e:curriculum -- --api http://localhost:8010 --bench http://localhost:8766
 *
 * It creates a test class ("E2E currículo") with one student on the target API and never removes anything.
 * Run it against an isolated database. It plays what the validator can judge; the simulated labs
 * (experiments, mission checklists) are covered by tests/curriculum-labs.test.ts and the browser review.
 */
import { execFileSync } from 'node:child_process';
import { benchApi } from '../src/bench/benchApi.ts';
import { setValidatorBase, validateStep } from '../src/api/validator.ts';
import { curriculumModules } from '../src/curriculum/lessons.ts';
import { cumulativeBoard, effectiveSteps, needsBuild, startPieces } from '../src/model/steps.ts';
import { buildPhases } from '../src/player/phases.ts';

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const api = option('--api', 'http://localhost:8010').replace(/\/+$/, '');
const benchBase = option('--bench', 'http://localhost:8766').replace(/\/+$/, '');
const python = option('--python', '../graph_validator/.venv/bin/python');
const tool = '../graph_validator/tools/bench_delivery.py';
const benchWs = `${benchBase.replace(/^http/, 'ws')}/ble`;

let token = '';
async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status}: ${JSON.stringify(json?.detail)}`);
  return json as T;
}

const failures: string[] = [];
let checks = 0;
function expect(ok: boolean, what: string) {
  checks++;
  if (!ok) {
    failures.push(what);
    console.log(`  ✗ ${what}`);
  }
}
const run = (...a: string[]) => execFileSync(python, [tool, ...a], { encoding: 'utf8' }).trim();

async function main() {
  const login = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.SEED_EMAIL ?? 'professor@tedtronics.local', password: process.env.SEED_PASSWORD ?? 'tedtronics' }),
  });
  token = (await login.json()).token;

  // Teacher side: class, student with a tag, modules assigned.
  const classes = await call<{ id: number; name: string }[]>('/workspace/classes');
  const klass = classes.find((c) => c.name === 'E2E currículo') ?? (await call<{ id: number }>('/workspace/classes', 'POST', { name: 'E2E currículo', description: 'Criada por scripts/e2e-curriculum.ts' }));
  const code = `E2E-TAG-${klass.id}`;
  let students = await call<{ id: number; nickname: string; nfc_code: string | null }[]>(`/workspace/students?class_id=${klass.id}`);
  if (!students.length) {
    await call(`/workspace/classes/${klass.id}/students`, 'POST', { name: 'Aluno E2E', nickname: 'e2e', nfc_code: code });
    students = await call(`/workspace/students?class_id=${klass.id}`);
  }
  const student = students[0];
  const mods = await call<{ id: number; title: string; lesson_ids: string[] }[]>('/workspace/modules');
  const ours = curriculumModules().map((m) => mods.find((x) => x.title === m.title));
  expect(ours.every(Boolean), 'all 5 curriculum modules exist on the server');
  const have = (await call<{ module_ids: number[] }>(`/workspace/classes/${klass.id}`)).module_ids;
  const merged = [...have, ...ours.filter(Boolean).map((m) => m.id).filter((id) => !have.includes(id))];
  await call(`/workspace/classes/${klass.id}/modules`, 'PUT', { module_ids: merged });
  console.log(`class #${klass.id} with student #${student.id}; ${merged.length} modules assigned`);

  // Every module's package must fit the bench link; deliver each, finishing with the full track.
  const full = ours.at(-1);
  for (const m of ours) console.log(`  ${run('load', '--api', api, '--bench', benchWs, '--module-id', String(m.id), '--class-id', String(klass.id))}`);

  // Bench side, as the bench UI does it.
  const bench = benchApi(benchBase);
  setValidatorBase(`${benchBase}/validator`);
  const status = await bench.status();
  expect(status.unlocked && status.package != null, 'bench is unlocked by the phone session and holds a package');
  const pkg = await bench.package();
  expect(pkg.module.id === full.id, 'the bench holds the full-curriculum module (the last one delivered)');
  expect(pkg.lessons.length === 20, `package carries all 20 lessons (got ${pkg.lessons.length})`);
  const session = await bench.login(student.nfc_code ?? code);
  console.log(`student ${session.student.nickname} signed in by tag; resume=${JSON.stringify(session.resume)}`);

  let judged = 0;
  for (const lesson of pkg.lessons) {
    const phases = buildPhases(lesson);
    const started = Date.now();
    if (lesson.kind === 'guided') {
      for (const phase of phases) {
        if (phase.type !== 'step' && phase.type !== 'interact') continue;
        const idx = phase.idx;
        if (phase.type === 'step') {
          const board = cumulativeBoard(lesson, idx);
          const ok = await validateStep({ lesson, pieces: board, stepIdx: idx });
          judged++;
          expect(ok.ok === true && ok.result.approved, `${lesson.id} step ${phase.step.id}: the correct build is approved (${ok.result?.message ?? ok.error})`);
          if (board.length > 1 && phase.step.action !== 'connect_circuit') {
            const behind = await validateStep({ lesson, pieces: board.slice(0, -1), stepIdx: idx });
            expect(behind.ok === true && !behind.result.approved, `${lesson.id} step ${phase.step.id}: a missing piece is not approved`);
          }
        } else if (!phase.local && phase.quiz) {
          const good = await validateStep({ lesson, pieces: [], stepIdx: idx, answer: phase.quiz.correctId });
          const wrong = phase.quiz.options.find((o) => o.id !== phase.quiz.correctId);
          const bad = await validateStep({ lesson, pieces: [], stepIdx: idx, answer: wrong.id });
          expect(good.ok === true && good.result.approved, `${lesson.id} question ${phase.quiz.id}: the right answer is approved`);
          expect(bad.ok === true && !bad.result.approved, `${lesson.id} question ${phase.quiz.id}: a wrong answer is not approved`);
        }
      }
    } else if (needsBuild(lesson)) {
      const start = startPieces(lesson, () => 0);
      const unsolved = await validateStep({ lesson, pieces: start, stepIdx: 0 });
      // A bench that begins loose (not wrong in wiring) is still wired right; only the player's loose gate stops it.
      const looseOnly = start.every((p) => lesson.board.pieces.some((b) => b.id === p.id)) && start.length === lesson.board.pieces.length && start.some((p) => p.loose);
      const sameWiring = unsolved.ok === true && unsolved.result.approved;
      expect(!sameWiring || looseOnly || start.length === 0 && false, `${lesson.id}: the starting bench is not already accepted as solved`);
      const solved = await validateStep({ lesson, pieces: lesson.board.pieces, stepIdx: 0 });
      judged++;
      expect(solved.ok === true && solved.result.approved, `${lesson.id}: the solution is approved (${solved.result?.message ?? solved.error})`);
    }
    // Progress saved on the bench as the student advances, then the lesson closes.
    const last = phases.length - 1;
    for (let p = 0; p < last; p++) await bench.step(session.student.id, { lesson_id: lesson.id, step_idx: p });
    await bench.step(session.student.id, { lesson_id: lesson.id, step_idx: last, lesson_done: true, duration_s: (Date.now() - started) / 1000 + 1 });
    if (lesson.kind === 'challenge') await bench.score(session.student.id, { lesson_id: lesson.id, score: 90, duration_s: 30 });
  }
  console.log(`played ${pkg.lessons.length} lessons through the bench; ${judged} validator judgements`);

  const back = await bench.login(session.student.nfc_code);
  expect(Object.values(back.progress).filter((p) => p.completed).length === 20, 'the bench remembers all 20 lessons as completed');
  await bench.logout(session.student.id, 120);

  // Back to the teacher: sync, then read the dashboard.
  console.log(`  ${run('sync', '--api', api, '--bench', benchWs)}`);
  const dash = await call<{ students: { lessons_done: number; lessons_total: number }[] }>(`/dashboard/classes/${klass.id}`);
  const row = dash.students?.[0];
  expect(!!row && row.lessons_done === 20, `teacher dashboard shows 20 lessons done (got ${row?.lessons_done}/${row?.lessons_total})`);
  console.log(`dashboard: ${row?.lessons_done}/${row?.lessons_total} lessons done for the E2E student`);

  console.log(`\n${checks} checks, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(`e2e failed: ${error.message}`);
  process.exit(1);
});
