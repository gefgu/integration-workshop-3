import { slugify, uid, validateLesson } from '../model/lesson.js';

const KEY = 'tedtronics.lessons';

/** localStorage can throw (private mode, quota) — callers get [] / false instead. */
export function loadLessons() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.map(validateLesson).filter(r => r.ok).map(r => r.lesson);
  } catch {
    return [];
  }
}

export function saveLessons(lessons) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lessons));
    return true;
  } catch {
    return false;
  }
}

/** Insert or replace by id, newest first. Returns the new list. */
export function upsertLesson(lessons, lesson) {
  const saved = { ...lesson, updatedAt: new Date().toISOString() };
  const rest = lessons.filter(l => l.id !== lesson.id);
  return [saved, ...rest];
}

export function duplicateLesson(lesson) {
  return { ...JSON.parse(JSON.stringify(lesson)), id: uid('lesson'), title: lesson.title + ' (cópia)', updatedAt: new Date().toISOString() };
}

export function downloadLesson(lesson) {
  const blob = new Blob([JSON.stringify(lesson, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = slugify(lesson.title) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Reads a File chosen by the teacher. Resolves { ok, lesson } or { ok:false, error }. */
export async function readLessonFile(file) {
  let raw;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    return { ok: false, error: 'O arquivo não é um JSON válido.' };
  }
  return validateLesson(raw);
}

const DRAFT_KEY = 'tedtronics.draft';

/** The lesson currently open in the editor, restored after a reload. */
export function loadDraft() {
  try {
    const r = validateLesson(JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'));
    return r.ok ? r.lesson : null;
  } catch {
    return null;
  }
}

export function saveDraft(lesson) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(lesson)); } catch { /* storage unavailable */ }
}
