import { slugify, uid, validateLesson } from '../model/lesson.ts';
import type { Lesson, LessonValidation } from '../model/types.ts';

export function duplicateLesson(lesson: Lesson): Lesson {
  return {
    ...JSON.parse(JSON.stringify(lesson)),
    id: uid('lesson'),
    title: `${lesson.title} (cópia)`,
    updatedAt: new Date().toISOString(),
  };
}

export function downloadLesson(lesson: Lesson): void {
  const blob = new Blob([JSON.stringify(lesson, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(lesson.title)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Reads a File chosen by the teacher. Resolves { ok, lesson } or { ok:false, error }. */
export async function readLessonFile(file: File): Promise<LessonValidation> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    return { ok: false, error: 'O arquivo não é um JSON válido.' };
  }
  return validateLesson(raw);
}
