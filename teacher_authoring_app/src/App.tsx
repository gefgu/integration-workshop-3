import { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { workspace } from './api/workspace.ts';
import { AuthProvider, useAuth } from './auth/AuthContext.tsx';
import LoginScreen from './auth/LoginScreen.tsx';
import Profile from './auth/Profile.tsx';
import Dashboard from './dashboard/Dashboard.tsx';
import LessonEditor from './editor/LessonEditor.tsx';
import Library from './editor/Library.tsx';
import Sandbox from './editor/Sandbox.tsx';
import { newLesson, slugify } from './model/lesson.ts';
import { downloadBlob, downloadLesson, duplicateLesson, readLessonFile } from './storage/lessonStore.ts';
import Classes from './workspace/Classes.tsx';
import Modules from './workspace/Modules.tsx';
import Students from './workspace/Students.tsx';

function audioStatus(audio) {
  if (audio?.status === 'ok') return `Voz do tutor: ${Object.keys(audio.phrases).length} falas em áudio.`;
  return `Sem voz do tutor${audio?.detail ? ` (${audio.detail})` : ''}.`;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

function AppRoutes() {
  const navigate = useNavigate();
  const { teacher, signOut: endSession } = useAuth();
  const signedIn = Boolean(teacher);
  const teacherId = teacher?.id;
  const [lessons, setLessons] = useState([]);
  const [lesson, setLesson] = useState(newLesson);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!teacherId) {
      setLessons([]);
      setLesson(newLesson());
      return;
    }
    let active = true;
    setLoaded(false);
    workspace.listLessons().then(
      (items) => {
        if (active) {
          setLessons(items);
          setError('');
          setLoaded(true);
        }
      },
      (cause) => {
        if (active) {
          setError(cause.message);
          setLoaded(true);
        }
      }
    );
    return () => {
      active = false;
    };
  }, [teacherId]);

  // The open lesson differs from the saved one (or was never saved): leaving or testing would not keep the edits.
  const unsaved = (() => {
    const strip = (l) => JSON.stringify({ ...l, updatedAt: 0, audio: 0 });
    const stored = lessons.find((item) => item.id === lesson.id);
    return !stored || strip(stored) !== strip(lesson);
  })();
  useEffect(() => {
    if (!unsaved || !window.location.pathname.startsWith('/editor')) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  const flash = (msg) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), 3000);
  };

  async function save(selectedLesson) {
    try {
      flash('Salvando e gerando a voz do tutor…');
      const saved = await workspace.saveLesson(selectedLesson);
      setLessons((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
      setLesson((current) =>
        current.id === saved.id ? { ...current, updatedAt: saved.updatedAt, audio: saved.audio } : current
      );
      setError('');
      flash(`Lição salva no banco de dados. ${audioStatus(saved.audio)}`);
      return saved;
    } catch (cause) {
      setError((cause as Error).message);
      return null;
    }
  }

  /** The .zip carries the tutor's MP3s; a lesson that is not on the server falls back to .json. */
  async function exportLesson(selectedLesson, saveFirst = false) {
    const saved = saveFirst ? await save(selectedLesson) : lessons.find((item) => item.id === selectedLesson.id);
    if (!saved) return downloadLesson(selectedLesson);
    try {
      downloadBlob(await workspace.exportZip(saved.id), `${slugify(saved.title)}.zip`);
    } catch (cause) {
      setError(`${(cause as Error).message} Baixando só o .json.`);
      downloadLesson(saved);
    }
  }

  const open = (selectedLesson) => {
    const copy = JSON.parse(JSON.stringify(selectedLesson));
    setLesson(copy);
    setError('');
    navigate(`/editor/${encodeURIComponent(copy.id)}`);
  };

  const create = () => {
    const freshLesson = newLesson();
    setLesson(freshLesson);
    setError('');
    navigate(`/editor/${encodeURIComponent(freshLesson.id)}`);
  };

  async function importFile(file) {
    const result = await readLessonFile(file);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    const exists = lessons.some((savedLesson) => savedLesson.id === result.lesson.id);
    try {
      const saved = await workspace.saveLesson(result.lesson);
      setLessons((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
      open(saved);
      flash(exists ? 'Lição importada (substituiu a de mesmo id).' : 'Lição importada.');
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function duplicate(selectedLesson) {
    await save(duplicateLesson(selectedLesson));
  }

  async function remove(selectedLesson) {
    try {
      await workspace.deleteLesson(selectedLesson.id);
      setLessons((items) => items.filter((item) => item.id !== selectedLesson.id));
      setError('');
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function signOut() {
    await endSession();
    navigate('/login', { replace: true });
  }

  if (teacher === undefined) return <p className="workspace-loading">Verificando sua sessão…</p>;

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={signedIn ? <Navigate to="/home" replace /> : <LoginScreen />} />
      <Route element={<RequireAuth signedIn={signedIn} />}>
        <Route element={<AppLayout lesson={lesson} teacherName={teacher?.name} onSignOut={signOut} />}>
          <Route path="/perfil" element={<Profile />} />
          <Route path="/alunos" element={<Students />} />
          <Route path="/painel" element={<Dashboard />} />
          <Route path="/painel/:classId" element={<Dashboard />} />
          <Route path="/painel/aluno/:studentId" element={<Dashboard />} />
          {!loaded ? (
            <Route path="*" element={<p className="workspace-loading">Carregando lições…</p>} />
          ) : (
            <>
              <Route
                path="/home"
                element={
                  <>
                    {error && <AppError message={error} />}
                    <Library
                      lessons={lessons}
                      onNew={create}
                      onOpen={open}
                      onTest={(selectedLesson) => {
                        setLesson(JSON.parse(JSON.stringify(selectedLesson)));
                        navigate(lessonTestPath(selectedLesson.id));
                      }}
                      onDuplicate={duplicate}
                      onExport={(selectedLesson) => exportLesson(selectedLesson)}
                      onDelete={remove}
                      onImport={importFile}
                    />
                  </>
                }
              />
              <Route path="/modulos" element={<Modules lessons={lessons} />} />
              <Route path="/modulos/:moduleId" element={<Modules lessons={lessons} />} />
              <Route path="/turmas" element={<Classes lessons={lessons} />} />
              <Route path="/turmas/:classId" element={<Classes lessons={lessons} />} />
              <Route
                path="/editor/:lessonId?"
                element={
                  <EditorRoute
                    lessons={lessons}
                    lesson={lesson}
                    setLesson={setLesson}
                    onSave={save}
                    onExport={(selectedLesson) => exportLesson(selectedLesson, true)}
                    onTest={() => navigate(lessonTestPath(lesson.id))}
                    status={status}
                    error={error}
                    unsaved={unsaved}
                  />
                }
              />
              {/* One route, so switching modes keeps the free sandbox's board. */}
              <Route
                path="/sandbox/:mode?/:lessonId?"
                element={
                  <SandboxRoute
                    lessons={lessons}
                    lesson={lesson}
                    setLesson={setLesson}
                    unsaved={unsaved}
                    onExit={() => navigate(`/editor/${encodeURIComponent(lesson.id)}`)}
                  />
                }
              />
            </>
          )}
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={signedIn ? '/home' : '/login'} replace />} />
    </Routes>
  );
}

/** "Testar" opens the lesson validator; the lesson id in the URL makes the page linkable. */
export const lessonTestPath = (id: string) => `/sandbox/licao/${encodeURIComponent(id)}`;

function SandboxRoute({ lessons, lesson, setLesson, onExit, unsaved }) {
  const { mode, lessonId } = useParams();
  const navigate = useNavigate();
  const testing = mode === 'licao';

  useEffect(() => {
    if (mode && !testing) navigate('/sandbox', { replace: true });
    else if (testing && !lessonId) navigate(lessonTestPath(lesson.id), { replace: true });
    else if (testing && lessonId !== lesson.id) {
      const savedLesson = lessons.find((item) => item.id === lessonId);
      if (savedLesson) setLesson(JSON.parse(JSON.stringify(savedLesson)));
      else navigate(lessonTestPath(lesson.id), { replace: true }); // unknown id: test the open lesson
    }
  }, [mode, testing, lessonId, lesson.id, lessons, navigate, setLesson]);

  return (
    <>
      {testing && unsaved && (
        <p role="status" className="problems" style={{ margin: '0 0 10px' }}>
          Você está testando a versão aberta no editor, que ainda não foi salva. Volte ao editor e clique em Salvar para
          guardá-la.
        </p>
      )}
      <Sandbox
        lesson={lesson}
        mode={testing ? 'lesson' : 'free'}
        onMode={(next) => navigate(next === 'lesson' ? lessonTestPath(lesson.id) : '/sandbox')}
        onExit={onExit}
      />
    </>
  );
}

function RequireAuth({ signedIn }) {
  return signedIn ? <Outlet /> : <Navigate to="/login" replace />;
}

function AppLayout({ lesson, teacherName, onSignOut }) {
  const { pathname } = useLocation();
  const section = (prefix: string) => () => (pathname.startsWith(prefix) ? 'active' : '');
  return (
    <div className="app-shell">
      <header className="header">
        <h1>TedTronics</h1>
        <span style={{ fontSize: 14, color: 'var(--color-neutral-600)' }}>Área do professor</span>
        <nav className="mode-toggle" aria-label="Navegação principal">
          <NavLink to="/home" className={({ isActive }) => (isActive ? 'active' : '')}>
            Lições
          </NavLink>
          <NavLink to="/modulos" className={section('/modulos')}>
            Módulos
          </NavLink>
          <NavLink to="/turmas" className={section('/turmas')}>
            Turmas
          </NavLink>
          <NavLink to="/alunos" className={section('/alunos')}>
            Alunos
          </NavLink>
          <NavLink to="/painel" className={section('/painel')}>
            Painel
          </NavLink>
          <NavLink
            to={`/editor/${encodeURIComponent(lesson.id)}`}
            className={() => (pathname.startsWith('/editor') ? 'active' : '')}
          >
            Editor
          </NavLink>
          <NavLink to="/sandbox" className={() => (pathname.startsWith('/sandbox') ? 'active' : '')}>
            Sandbox
          </NavLink>
        </nav>
        <NavLink to="/perfil" className="pill-link-btn muted">
          {teacherName ?? 'Perfil'}
        </NavLink>
        <button type="button" className="pill-link-btn muted" onClick={onSignOut}>
          Sair
        </button>
      </header>
      <main className="mode-stage">
        <Outlet />
      </main>
    </div>
  );
}

function EditorRoute({ lessons, lesson, setLesson, onSave, onExport, onTest, status, error, unsaved }) {
  const { lessonId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!lessonId || lesson.id === lessonId) return;
    const savedLesson = lessons.find((item) => item.id === lessonId);
    if (!savedLesson) {
      navigate('/home', { replace: true });
      return;
    }
    setLesson(JSON.parse(JSON.stringify(savedLesson)));
  }, [lessonId, lesson.id, lessons, navigate, setLesson]);

  return (
    <>
      {error && <AppError message={error} />}
      <LessonEditor
        lesson={lesson}
        setLesson={setLesson}
        onSave={onSave}
        onExport={onExport}
        onTest={onTest}
        status={status}
        unsaved={unsaved}
      />
    </>
  );
}

function AppError({ message }) {
  return (
    <p className="app-error" role="alert">
      {message}
    </p>
  );
}
