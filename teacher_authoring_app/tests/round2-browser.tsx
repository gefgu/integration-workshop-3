/** Isolated browser fixture: workspace writes stay in memory; validation uses the local test server. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { curriculumLessons } from '../src/curriculum/lessons.ts';
import LessonPlayer from '../src/player/LessonPlayer.tsx';
import { buildPhases } from '../src/player/phases.ts';
import { workspace } from '../src/api/workspace.ts';
import { auth } from '../src/api/auth.ts';
import type { Lesson } from '../src/model/types.ts';
import '../src/styles.css';

const lessons = curriculumLessons();
declare global {
  interface Window {
    fixtureLessons: Lesson[];
    writes?: number;
  }
}
window.fixtureLessons = lessons;
const params = new URLSearchParams(location.search);
const id = params.get('lesson') ?? 'curriculo-02-guiada';
const root = document.getElementById('root');
if (!root) throw new Error('Missing fixture root');
if (params.has('editor')) {
  history.replaceState(null, '', '/home');
  localStorage.setItem('tedtronics-token', 'isolated-browser-fixture');
  auth.me = async () => ({ id: 1, name: 'Teste isolado', email: 'fixture@example.test' });
  workspace.listLessons = async () => JSON.parse(JSON.stringify(lessons));
  workspace.saveLesson = async (lesson) => {
    window.writes = (window.writes ?? 0) + 1;
    return { ...lesson, updatedAt: new Date().toISOString() };
  };
  workspace.exportZip = async () => new Blob();
  let module = {
    id: 1,
    title: 'Módulo da fixture',
    description: 'Descrição',
    lesson_ids: [lessons[0].id, lessons[1].id],
    class_ids: [],
    updated_at: '2026-10-31T00:00:00Z',
  };
  workspace.listModules = async () => [structuredClone(module)];
  workspace.listClasses = async () => [];
  workspace.updateModule = async (_id, patch) => {
    module = { ...module, ...patch };
    return structuredClone(module);
  };
  workspace.setModuleLessons = async (_id, ids) => {
    module = { ...module, lesson_ids: ids };
    return structuredClone(module);
  };
  const { default: App } = await import('../src/App.tsx');
  createRoot(root).render(<App />);
} else {
  function Fixture() {
    const [done, setDone] = useState(false);
    const lesson = lessons.find((l) => l.id === id);
    if (!lesson) throw new Error(`Unknown fixture lesson ${id}`);
    if (params.has('timed')) lesson.timeLimitS = 1;
    if (params.has('rename')) {
      lesson.board.pieces = lesson.board.pieces.map((p) => ({ ...p, id: `student-${p.id}` }));
      lesson.steps = lesson.steps.map((s) => ({ ...s, pieceId: s.pieceId ? `student-${s.pieceId}` : null }));
    }
    return done ? (
      <p>Fixture finished</p>
    ) : (
      <LessonPlayer lesson={lesson} onExit={() => setDone(true)} mascotKind="fox" bench={params.has('bench')} startPhase={params.has('prediction') ? buildPhases(lesson).findIndex((p) => p.type === 'interact' && p.quiz?.prediction) : 0} />
    );
  }
  createRoot(root).render(<Fixture />);
}
