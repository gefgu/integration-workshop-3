import { useCallback, useEffect, useState } from 'react';
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
import LessonEditor from './editor/LessonEditor.tsx';
import Library from './editor/Library.tsx';
import { newLesson } from './model/lesson.ts';
import LessonPlayer from './player/LessonPlayer.tsx';
import {
  downloadLesson,
  duplicateLesson,
  loadDraft,
  loadLessons,
  readLessonFile,
  saveDraft,
  saveLessons,
  upsertLesson,
} from './storage/lessonStore.ts';

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
  const [lessons, setLessons] = useState(loadLessons);
  const [lesson, setLesson] = useState(() => loadDraft() || newLesson());
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const mascotKind = 'fox';

  useEffect(() => {
    saveDraft(lesson);
  }, [lesson]);

  const flash = (msg) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), 3000);
  };

  const persist = useCallback((next) => {
    setLessons(next);
    if (!saveLessons(next))
      setError('Não foi possível gravar no navegador. Use "Exportar .json" para guardar a lição.');
  }, []);

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

  function save(selectedLesson) {
    persist(upsertLesson(lessons, selectedLesson));
    flash('Lição salva na biblioteca deste navegador.');
  }

  async function importFile(file) {
    const result = await readLessonFile(file);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    const exists = lessons.some((savedLesson) => savedLesson.id === result.lesson.id);
    persist(upsertLesson(lessons, result.lesson));
    setError('');
    open(result.lesson);
    flash(exists ? 'Lição importada (substituiu a de mesmo id).' : 'Lição importada.');
  }

  function signIn() {
    sessionStorage.setItem(SESSION_KEY, 'true');
    setSignedIn(true);
    navigate('/home', { replace: true });
  }

  function signOut() {
    sessionStorage.removeItem(SESSION_KEY);
    setSignedIn(false);
    navigate('/login', { replace: true });
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={signedIn ? <Navigate to="/home" replace /> : <LoginScreen onSignIn={signIn} />} />
      <Route element={<RequireAuth signedIn={signedIn} />}>
        <Route element={<AppLayout lesson={lesson} onSignOut={signOut} />}>
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
                    navigate(`/sandbox/${encodeURIComponent(selectedLesson.id)}`);
                  }}
                  onDuplicate={(selectedLesson) => persist(upsertLesson(lessons, duplicateLesson(selectedLesson)))}
                  onExport={downloadLesson}
                  onDelete={(selectedLesson) =>
                    persist(lessons.filter((savedLesson) => savedLesson.id !== selectedLesson.id))
                  }
                  onImport={importFile}
                />
              </>
            }
          />
          <Route
            path="/editor/:lessonId?"
            element={
              <EditorRoute
                lessons={lessons}
                lesson={lesson}
                setLesson={setLesson}
                onSave={save}
                onExport={downloadLesson}
                onTest={() => navigate(`/sandbox/${encodeURIComponent(lesson.id)}`)}
                status={status}
                error={error}
              />
            }
          />
          <Route
            path="/sandbox/:lessonId?"
            element={<SandboxRoute lessons={lessons} lesson={lesson} setLesson={setLesson} mascotKind={mascotKind} />}
          />
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
          <NavLink
            to={`/editor/${encodeURIComponent(lesson.id)}`}
            className={() => (pathname.startsWith('/editor') ? 'active' : '')}
          >
            Editor
          </NavLink>
          <NavLink
            to={`/sandbox/${encodeURIComponent(lesson.id)}`}
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

function SandboxRoute({ lessons, lesson, setLesson, mascotKind }) {
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
    <LessonPlayer
      key={lesson.updatedAt + lesson.id}
      lesson={lesson}
      onExit={() => navigate(`/editor/${encodeURIComponent(lesson.id)}`)}
      mascotKind={mascotKind}
    />
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
