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
  downloadBlob(
    new Blob([JSON.stringify(lesson, null, 2)], { type: 'application/json' }),
    `${slugify(lesson.title)}.json`
  );
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Reads a File chosen by the teacher. Resolves { ok, lesson } or { ok:false, error }. */
export async function readLessonFile(file: File): Promise<LessonValidation> {
  if (file.name.toLowerCase().endsWith('.zip'))
    return { ok: false, error: 'Importe o arquivo lesson.json de dentro do .zip; o áudio é gerado de novo ao salvar.' };
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    return { ok: false, error: 'O arquivo não é um JSON válido.' };
  }
  return validateLesson(raw);
}
