import { useCallback, useEffect, useState } from 'react';
import LessonEditor from './editor/LessonEditor.jsx';
import LessonPlayer from './player/LessonPlayer.jsx';
import Library from './editor/Library.jsx';
import { newLesson } from './model/lesson.js';
import { loadLessons, saveLessons, upsertLesson, duplicateLesson, downloadLesson, readLessonFile, loadDraft, saveDraft } from './storage/lessonStore.js';

export default function App() {
  const [tab, setTab] = useState('biblioteca');
  const [lessons, setLessons] = useState(loadLessons);
  const [lesson, setLesson] = useState(() => loadDraft() || newLesson());
  const mascotKind = 'fox';
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { saveDraft(lesson); }, [lesson]);
  const flash = (msg) => { setStatus(msg); setTimeout(() => setStatus(''), 3000); };

  const persist = useCallback((next) => {
    setLessons(next);
    if (!saveLessons(next)) setError('Não foi possível gravar no navegador. Use "Exportar .json" para guardar a lição.');
  }, []);

  const open = (l) => { setLesson(JSON.parse(JSON.stringify(l))); setError(''); setTab('editor'); };
  const create = () => { setLesson(newLesson()); setError(''); setTab('editor'); };

  function save(l) {
    persist(upsertLesson(lessons, l));
    flash('Lição salva na biblioteca deste navegador.');
  }

  async function importFile(file) {
    const r = await readLessonFile(file);
    if (!r.ok) { setError(r.error); return; }
    const exists = lessons.some(l => l.id === r.lesson.id);
    persist(upsertLesson(lessons, r.lesson));
    setError('');
    open(r.lesson);
    flash(exists ? 'Lição importada (substituiu a de mesmo id).' : 'Lição importada.');
  }

  return (
    <div className="app-shell">
      <header className="header">
        <h1>Editor de Lições</h1>
        <span style={{ fontSize: 14, color: 'var(--color-neutral-600)' }}>TedTronics — app do professor</span>
        <div className="mode-toggle">
          <button className={tab === 'biblioteca' ? 'active' : ''} onClick={() => setTab('biblioteca')}>Biblioteca</button>
          <button className={tab === 'editor' ? 'active' : ''} onClick={() => setTab('editor')}>Editor</button>
          <button className={tab === 'testar' ? 'active' : ''} onClick={() => setTab('testar')}>Testar</button>
        </div>
      </header>

      <div className="mode-stage">
        {error && <p role="alert" style={{ margin: '0 0 12px', padding: '10px 14px', borderRadius: 14, background: 'var(--color-accent-200)', color: 'var(--color-accent-800)', fontSize: 13 }}>{error}</p>}
        {tab === 'biblioteca' && (
          <Library
            lessons={lessons}
            onNew={create}
            onOpen={open}
            onTest={(l) => { setLesson(JSON.parse(JSON.stringify(l))); setTab('testar'); }}
            onDuplicate={(l) => persist(upsertLesson(lessons, duplicateLesson(l)))}
            onExport={downloadLesson}
            onDelete={(l) => persist(lessons.filter(x => x.id !== l.id))}
            onImport={importFile}
          />
        )}
        {tab === 'editor' && (
          <LessonEditor lesson={lesson} setLesson={setLesson} onSave={save} onExport={downloadLesson} onTest={() => setTab('testar')} mascotKind={mascotKind} status={status} />
        )}
        {tab === 'testar' && <LessonPlayer key={lesson.updatedAt + lesson.id} lesson={lesson} onExit={() => setTab('editor')} mascotKind={mascotKind} />}
      </div>
    </div>
  );
}
