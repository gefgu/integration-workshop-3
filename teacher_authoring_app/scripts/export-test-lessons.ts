// Prints the two bench test lessons and their modules as JSON (used to add them to Neon).
import { curriculumLessons, curriculumModules, SEED_PREFIX } from '../src/curriculum/lessons.ts';
import { lessonProblems, validateLesson } from '../src/model/lesson.ts';

const ids = ['03-guiada-1k', 'teste-voltimetro-buzzer'].map((i) => `${SEED_PREFIX}${i}`);
const lessons = curriculumLessons().filter((l) => ids.includes(l.id));
for (const l of lessons) {
  const p = validateLesson(JSON.parse(JSON.stringify(l)));
  if (!p.ok) throw new Error(`${l.id}: ${p.error}`);
  const problems = lessonProblems(p.lesson);
  if (problems.length) throw new Error(`${l.id}: ${problems.join(' ')}`);
}
const modules = curriculumModules().filter((m) => m.lessonIds.every((i) => ids.includes(i)));
console.log(JSON.stringify({ lessons, modules }));
