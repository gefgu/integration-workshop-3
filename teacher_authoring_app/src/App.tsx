import { useEffect, useState } from 'react';
import {
  createBrowserRouter,
  Navigate,
  NavLink,
  Outlet,
  Route,
  RouterProvider,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { curriculumApi, workspace } from './api/workspace.ts';
import { AuthProvider, useAuth } from './auth/AuthContext.tsx';
import LoginScreen from './auth/LoginScreen.tsx';
import Profile from './auth/Profile.tsx';
import Icon from './components/Icon.tsx';
import TipLayer from './components/TipLayer.tsx';
import Tour, { useFirstRunTour } from './components/Tour.tsx';
import { hasCurriculum, syncCurriculum } from './curriculum/sync.ts';
import Dashboard from './dashboard/Dashboard.tsx';
import LessonEditor from './editor/LessonEditor.tsx';
import Library from './editor/Library.tsx';
import Sandbox from './editor/Sandbox.tsx';
import { newLesson, slugify } from './model/lesson.ts';
import { downloadBlob, downloadLesson, duplicateLesson, readLessonFile } from './storage/lessonStore.ts';
import { SITE_TOURS, siteTourKey } from './tour/siteTours.ts';
import { useUnsavedChanges } from './useUnsavedChanges.ts';
import Classes from './workspace/Classes.tsx';
import Modules from './workspace/Modules.tsx';
import Students from './workspace/Students.tsx';

function audioStatus(audio) {
  if (audio?.status === 'ok') return `Voz do tutor: ${Object.keys(audio.phrases).length} falas em áudio.`;
  return 'Sem voz do tutor. Você pode ler os textos na tela.';
}

const router = createBrowserRouter([
  {
    path: '*',
    element: (
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    ),
  },
]);
export default function App() {
  return <RouterProvider router={router} />;
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
  const [curriculumNote, setCurriculumNote] = useState('');
  const [error, setError] = useState('');
  const [pendingImport, setPendingImport] = useState(null);
  const [replaceImport, setReplaceImport] = useState(false);
  useEffect(() => {
    if (!teacherId) {
      setLessons([]);
      setLesson(newLesson());
      return;
    }
    let active = true;
    setLoaded(false);
    workspace.listLessons().then(
      async (items) => {
        // Every teacher starts with the TedTronics curriculum: an account without it gets it once (per browser),
        // so a teacher who later deletes those lessons is not refilled on every visit.
        const offered = `tedtronics-curriculum-${teacherId}`;
        let seen = true;
        try {
          seen = localStorage.getItem(offered) === '1';
        } catch {
          // storage blocked: skip the automatic import, the Modules page still offers it
        }
        if (!seen && !hasCurriculum(items)) {
          try {
            localStorage.setItem(offered, '1');
            const report = await syncCurriculum(curriculumApi, { teacherId });
            items = await workspace.listLessons();
            if (active)
              setCurriculumNote(
                `Adicionamos o currículo TedTronics à sua conta: ${report.lessons.created} lições e ${report.modules.created} módulos prontos (veja em Módulos).`
              );
          } catch (cause) {
            if (active) setCurriculumNote(`Não foi possível adicionar o currículo: ${(cause as Error).message}`);
          }
        }
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
      flash(`Lição salva. ${audioStatus(saved.audio)}`);
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

  /** New lesson from the "Nova lição" dialog: its basics (title, kind) come filled in. */
  const create = (init = {}) => {
    const freshLesson = { ...newLesson(), ...init };
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
    if (exists) {
      setPendingImport(result.lesson);
      setReplaceImport(false);
    } else {
      open(result.lesson);
      flash('Lição importada no editor. Clique em Salvar para guardá-la.');
    }
  }

  async function duplicate(selectedLesson) {
    const copy = await save(duplicateLesson(selectedLesson));
    if (copy) {
      open(copy);
      flash(`Cópia de “${selectedLesson.title}”. O original não muda.`);
    }
  }

  async function remove(selectedLesson) {
    try {
      // The lesson also leaves the modules and classes that use it: say which, before asking.
      const title = selectedLesson.title || 'Lição sem título';
      const usage = await workspace.lessonUsage(selectedLesson.id);
      const quoted = (names: string[]) => names.map((n) => `“${n}”`).join(', ');
      const where = [
        usage.modules.length && `${usage.modules.length === 1 ? 'do módulo' : 'dos módulos'} ${quoted(usage.modules)}`,
        usage.classes.length && `${usage.classes.length === 1 ? 'da turma' : 'das turmas'} ${quoted(usage.classes)}`,
      ].filter(Boolean);
      const question = where.length
        ? `Excluir “${title}”?\n\nEla também sai ${where.join(' e ')}. O progresso já registrado dos alunos é mantido.\n\nNão dá para desfazer.`
        : `Excluir “${title}”? Não dá para desfazer.`;
      if (!window.confirm(question)) return;
      await workspace.deleteLesson(selectedLesson.id);
      setLessons((items) => items.filter((item) => item.id !== selectedLesson.id));
      setError('');
      flash(`“${selectedLesson.title || 'Lição sem título'}” foi excluída.`);
    } catch (cause) {
      setError((cause as Error).message);
      // The message sits above the list, far from the card's button: bring it into view.
      requestAnimationFrame(() =>
        document.querySelector('.app-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      );
    }
  }

  async function signOut() {
    if (!window.dispatchEvent(new Event('tedtronics:before-signout', { cancelable: true }))) return;
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
                    {curriculumNote && (
                      <p role="status" className="panel curriculum-note">
                        {curriculumNote}{' '}
                        <button type="button" className="pill-link-btn" onClick={() => setCurriculumNote('')}>
                          Fechar
                        </button>
                      </p>
                    )}
                    {pendingImport && (
                      <section className="panel" role="dialog" aria-label="Importar lição existente">
                        <p>Já existe uma lição com este id. Como deseja abrir o arquivo?</p>
                        <label>
                          <input
                            type="radio"
                            name="import-mode"
                            checked={!replaceImport}
                            onChange={() => setReplaceImport(false)}
                          />{' '}
                          Importar como cópia (recomendado)
                        </label>
                        <label>
                          <input
                            type="radio"
                            name="import-mode"
                            checked={replaceImport}
                            onChange={() => setReplaceImport(true)}
                          />{' '}
                          Substituir ao salvar
                        </label>
                        <p>A lição armazenada só muda quando você clicar em Salvar.</p>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => {
                            open(replaceImport ? pendingImport : duplicateLesson(pendingImport));
                            setPendingImport(null);
                          }}
                        >
                          Abrir no editor
                        </button>
                        <button type="button" className="btn-outline" onClick={() => setPendingImport(null)}>
                          Cancelar
                        </button>
                      </section>
                    )}
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
  useUnsavedChanges(
    unsaved && testing,
    (path) => path === `/editor/${encodeURIComponent(lesson.id)}` || path === lessonTestPath(lesson.id)
  );

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
      <Sandbox
        notice={
          testing && unsaved
            ? 'Você está testando a versão aberta no editor, que ainda não foi salva. Volte ao editor e clique em Salvar para guardá-la.'
            : undefined
        }
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
  // Each page has a guided tour: it opens on the first visit, and the ? button opens it again.
  const tourKey = siteTourKey(pathname);
  const tour = useFirstRunTour(tourKey);
  return (
    <div className="app-shell">
      <TipLayer />
      <header className="header">
        <div className="header-brand">
          <h1>TedTronics</h1>
          <span>Área do professor</span>
        </div>
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
        <div className="header-user">
          {tourKey && (
            <button
              type="button"
              className="icon-btn icon-btn-outline has-tip help-btn"
              data-tip="Ajuda: tutorial desta página"
              aria-label="Ajuda: tutorial desta página"
              onClick={tour.start}
            >
              ?
            </button>
          )}
          <NavLink to="/perfil" className="header-profile" title="Meu perfil">
            <Icon name="user" size={18} />
            <span>{teacherName ?? 'Perfil'}</span>
          </NavLink>
          <button type="button" className="icon-btn has-tip" data-tip="Sair" aria-label="Sair" onClick={onSignOut}>
            <Icon name="logout" size={18} />
          </button>
        </div>
      </header>
      <main className="mode-stage">
        <Outlet />
      </main>
      {tour.open && tourKey && <Tour key={tourKey} steps={SITE_TOURS[tourKey]} onClose={tour.close} />}
    </div>
  );
}

function EditorRoute({ lessons, lesson, setLesson, onSave, onExport, onTest, status, error, unsaved }) {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  useUnsavedChanges(unsaved, (path) => path === lessonTestPath(lesson.id));

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
