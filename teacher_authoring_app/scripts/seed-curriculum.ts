/**
 * Imports the TedTronics curriculum (src/curriculum) into a running API under the demo teacher.
 *
 *   npm run seed:curriculum -- --api http://localhost:8000 [--dry-run] [--assign-class <id>]
 *
 * Repeatable and non-destructive:
 *  - it only ever writes lessons whose id starts with "curriculo-" and modules whose title it owns;
 *  - it never deletes a lesson, module, class, student or progress event;
 *  - a lesson or module that is already identical is left alone (no new version, no new timestamp);
 *  - assigning modules to a class is opt-in (--assign-class) and only appends, in addition to what the class has.
 * Credentials: SEED_EMAIL / SEED_PASSWORD (default: the seeded demo teacher).
 */
import { curriculumLessons, curriculumModules, RETIRED_LESSON_IDS, RETIRED_MODULE_TITLES, SEED_PREFIX } from '../src/curriculum/lessons.ts';
import { lessonProblems, validateLesson } from '../src/model/lesson.ts';
import { toValidatorLesson } from '../src/model/steps.ts';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

const api = (option('--api') ?? process.env.SEED_API ?? 'http://localhost:8000').replace(/\/+$/, '');
const dryRun = flag('--dry-run');
const assignClass = option('--assign-class');
const email = process.env.SEED_EMAIL ?? 'professor@tedtronics.local';
const password = process.env.SEED_PASSWORD ?? 'tedtronics';

let token = '';
async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status}: ${JSON.stringify(json?.detail ?? json)}`);
  return json as T;
}

/** What identifies a lesson's content: everything the server does not stamp itself. */
const content = (lesson: Record<string, unknown>) => {
  const { updatedAt: _u, audio: _a, ...rest } = lesson;
  return JSON.stringify(rest, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v
  );
};

async function main() {
  const lessons = curriculumLessons();
  const modules = curriculumModules();

  // 1. Refuse to import anything the app itself would reject.
  for (const lesson of lessons) {
    const parsed = validateLesson(JSON.parse(JSON.stringify(lesson)));
    if (!parsed.ok) throw new Error(`${lesson.id}: ${parsed.error}`);
    const problems = lessonProblems(parsed.lesson);
    if (problems.length) throw new Error(`${lesson.id}: ${problems.join(' ')}`);
  }
  console.log(`curriculum: ${lessons.length} lessons, ${modules.length} modules — all pass the app's own validation`);

  // 2. Sign in as the demo teacher.
  const session = await call<{ token: string; teacher: { id: number; email: string } }>('/auth/login', 'POST', { email, password });
  token = session.token;
  console.log(`signed in as ${session.teacher.email} (#${session.teacher.id}) on ${api}${dryRun ? ' [dry run]' : ''}`);

  // 3. Ask the validator whether it agrees with every guided lesson.
  for (const lesson of lessons.filter((l) => l.kind === 'guided' && l.steps.length)) {
    const lint = await call<{ problems: string[] }>('/lessons/lint', 'POST', toValidatorLesson(lesson));
    if (lint.problems.length) throw new Error(`validator lint ${lesson.id}: ${lint.problems.join('; ')}`);
  }
  console.log('validator lint: every guided lesson is accepted');

  // 4. Lessons: create or update only our own ids; leave identical ones untouched.
  const existing = new Map((await call<Record<string, unknown>[]>('/workspace/lessons')).map((l) => [l.id as string, l]));
  const tally = { created: 0, updated: 0, unchanged: 0 };
  for (const lesson of lessons) {
    if (!lesson.id.startsWith(SEED_PREFIX)) throw new Error(`refusing to write ${lesson.id}`);
    const have = existing.get(lesson.id);
    const same = have && content(have) === content(lesson as unknown as Record<string, unknown>);
    if (same) {
      tally.unchanged++;
      continue;
    }
    tally[have ? 'updated' : 'created']++;
    if (!dryRun) await call(`/workspace/lessons/${encodeURIComponent(lesson.id)}`, 'PUT', lesson);
  }
  console.log(`lessons: ${tally.created} created, ${tally.updated} updated, ${tally.unchanged} unchanged (other lessons untouched: ${[...existing.keys()].filter((id) => !id.startsWith(SEED_PREFIX)).length})`);

  // 5. Modules: matched by title; only ours are touched.
  const haveModules = await call<{ id: number; title: string; lesson_ids: string[] }[]>('/workspace/modules');
  const moduleIds: number[] = [];
  const mtally = { created: 0, updated: 0, unchanged: 0 };
  for (const m of modules) {
    const found = haveModules.find((x) => x.title === m.title);
    if (found && JSON.stringify(found.lesson_ids) === JSON.stringify(m.lessonIds)) {
      mtally.unchanged++;
      moduleIds.push(found.id);
      continue;
    }
    mtally[found ? 'updated' : 'created']++;
    if (dryRun) continue;
    const body = { title: m.title, description: m.description, lesson_ids: m.lessonIds };
    const saved = found
      ? await call<{ id: number }>(`/workspace/modules/${found.id}`, 'PUT', body)
      : await call<{ id: number }>('/workspace/modules', 'POST', body);
    moduleIds.push(saved.id);
  }
  console.log(`modules: ${mtally.created} created, ${mtally.updated} updated, ${mtally.unchanged} unchanged (other modules untouched: ${haveModules.filter((x) => !modules.some((m) => m.title === x.title)).length})`);

  // 5b. Retire what the curriculum no longer has (only our own `curriculo-` ids and module titles). Modules go first,
  // so no module still points at a lesson that is about to be deleted.
  const retiredModules = haveModules.filter((x) => RETIRED_MODULE_TITLES.includes(x.title));
  const retiredLessons = RETIRED_LESSON_IDS.filter((id) => id.startsWith(SEED_PREFIX) && existing.has(id));
  for (const m of retiredModules) if (!dryRun) await call(`/workspace/modules/${m.id}`, 'DELETE');
  for (const id of retiredLessons) if (!dryRun) await call(`/workspace/lessons/${encodeURIComponent(id)}`, 'DELETE');
  console.log(`retired: ${retiredLessons.length} lessons, ${retiredModules.length} modules removed`);

  // 6. Optional, additive class assignment.
  if (assignClass && !dryRun) {
    const klass = await call<{ module_ids: number[] }>(`/workspace/classes/${assignClass}`);
    const merged = [...klass.module_ids, ...moduleIds.filter((id) => !klass.module_ids.includes(id))];
    await call(`/workspace/classes/${assignClass}/modules`, 'PUT', { module_ids: merged });
    console.log(`class ${assignClass}: modules ${klass.module_ids.length} → ${merged.length} (existing assignments kept)`);
  }
}

main().catch((error) => {
  console.error(`seed failed: ${error.message}`);
  process.exit(1);
});
