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
import LessonEditor from './editor/LessonEditor.tsx';
import Library from './editor/Library.tsx';
import { newLesson } from './model/lesson.ts';
import Sandbox from './editor/Sandbox.tsx';
import { downloadLesson, duplicateLesson, readLessonFile } from './storage/lessonStore.ts';
import Classes from './workspace/Classes.tsx';

const SESSION_KEY = 'tedtronics-mock-signed-in';

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

function AppRoutes() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(() => sessionStorage.getItem(SESSION_KEY) === 'true');
  const [lessons, setLessons] = useState([]);
  const [lesson, setLesson] = useState(newLesson);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!signedIn) return;
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
  }, [signedIn]);

  const flash = (msg) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), 3000);
  };

  async function save(selectedLesson) {
    try {
      const saved = await workspace.saveLesson(selectedLesson);
      setLessons((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
      setLesson((current) => (current.id === saved.id ? { ...current, updatedAt: saved.updatedAt } : current));
      setError('');
      flash('Lição salva no banco de dados.');
    } catch (cause) {
      setError((cause as Error).message);
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

  function signIn() {
    sessionStorage.setItem(SESSION_KEY, 'true');
    setSignedIn(true);
    navigate('/home', { replace: true });
  }

  function signOut() {
    sessionStorage.removeItem(SESSION_KEY);
    setSignedIn(false);
    setLessons([]);
    setLesson(newLesson());
    navigate('/login', { replace: true });
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={signedIn ? <Navigate to="/home" replace /> : <LoginScreen onSignIn={signIn} />} />
      <Route element={<RequireAuth signedIn={signedIn} />}>
        <Route element={<AppLayout lesson={lesson} onSignOut={signOut} />}>
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
                        navigate('/sandbox');
                      }}
                      onDuplicate={duplicate}
                      onExport={downloadLesson}
                      onDelete={remove}
                      onImport={importFile}
                    />
                  </>
                }
              />
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
                    onExport={downloadLesson}
                    onTest={() => navigate('/sandbox')}
                    status={status}
                    error={error}
                  />
                }
              />
              <Route
                path="/sandbox"
                element={<Sandbox lesson={lesson} onExit={() => navigate(`/editor/${encodeURIComponent(lesson.id)}`)} />}
              />
            </>
          )}
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={signedIn ? '/home' : '/login'} replace />} />
    </Routes>
  );
}

function RequireAuth({ signedIn }) {
  return signedIn ? <Outlet /> : <Navigate to="/login" replace />;
}

function AppLayout({ lesson, onSignOut }) {
  const { pathname } = useLocation();
  return (
    <div className="app-shell">
      <header className="header">
        <h1>Editor de Lições</h1>
        <span style={{ fontSize: 14, color: 'var(--color-neutral-600)' }}>TedTronics — app do professor</span>
        <nav className="mode-toggle" aria-label="Navegação principal">
          <NavLink to="/home" className={({ isActive }) => (isActive ? 'active' : '')}>
            Início
          </NavLink>
          <NavLink to="/turmas" className={() => (pathname.startsWith('/turmas') ? 'active' : '')}>
            Turmas
          </NavLink>
          <NavLink
            to={`/editor/${encodeURIComponent(lesson.id)}`}
            className={() => (pathname.startsWith('/editor') ? 'active' : '')}
          >
            Editor
          </NavLink>
          <NavLink
            to="/sandbox"
            className={() => (pathname.startsWith('/sandbox') ? 'active' : '')}
          >
            Sandbox
          </NavLink>
        </nav>
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

function EditorRoute({ lessons, lesson, setLesson, onSave, onExport, onTest, status, error }) {
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
      />
    </>
  );
}

function LoginScreen({ onSignIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Preencha o e-mail e a senha para continuar.');
      return;
    }
    onSignIn();
  }

  return (
    <main className="login-screen">
      <form className="login-card panel" onSubmit={handleSubmit}>
        <div className="login-brand">TedTronics</div>
        <h1>Editor de Lições</h1>
        <p>Entre para organizar, criar e testar lições.</p>
        <label className="field-label" htmlFor="login-email">
          E-mail
        </label>
        <input
          id="login-email"
          className="text-input"
          type="text"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label className="field-label" htmlFor="login-password">
          Senha
        </label>
        <input
          id="login-password"
          className="text-input"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary login-submit">
          Entrar
        </button>
        <small>Autenticação temporária para demonstração.</small>
      </form>
    </main>
  );
}

function AppError({ message }) {
  return (
    <p className="app-error" role="alert">
      {message}
    </p>
  );
}
