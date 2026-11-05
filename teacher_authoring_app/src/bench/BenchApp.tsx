import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BenchPackage, BenchStatus, BenchStudent } from '../../../protocol/bench.ts';
import { setValidatorBase } from '../api/validator.ts';
import Bubble from '../components/Bubble.tsx';
import Icon from '../components/Icon.tsx';
import LessonPlayer, { type PlayerEvent } from '../player/LessonPlayer.tsx';
import { type BenchApi, benchApi, type LoginResult, type RankRow, serviceUrl } from './benchApi.ts';
import CameraView from './CameraView.tsx';
import { type DemoChoice, demoChoices, demoPackage } from './demo.ts';
import FitStage from './FitStage.tsx';
import { lessonStates, type Screen, screenAfterLesson } from './screens.ts';

/**
 * The workbench's 7" screen. Exactly one screen is shown at a time (SFR17): locked (waiting for the
 * teacher's app), home (tap your tag), the student's lessons, a running lesson, the score, the ranking and the
 * camera board view.
 * Keyboard stands in for the hardware: arrows/Tab + Enter = joystick, Esc = Voltar.
 */
export default function BenchApp() {
  const base = useMemo(() => serviceUrl(), []);
  const api = useMemo(() => benchApi(base), [base]);
  const [status, setStatus] = useState<BenchStatus | null>(null);
  const [pkg, setPkg] = useState<BenchPackage | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'locked' });
  const [session, setSession] = useState<LoginResult | null>(null);
  const [error, setError] = useState('');
  const loginAt = useRef(0);

  useEffect(() => setValidatorBase(`${base}/validator`), [base]);

  // Poll the service: the teacher's phone unlocks the bench and may load a new module at any time.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const next = await api.status();
        if (!alive) return;
        setStatus(next);
        setError('');
      } catch (cause) {
        if (alive) setError((cause as Error).message);
      }
    };
    void tick();
    const timer = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [api]);

  const version = status?.package?.version_id;
  useEffect(() => {
    if (!status?.unlocked || !version) {
      setPkg(null);
      return;
    }
    api.package().then(setPkg, (cause) => setError(cause.message));
  }, [api, status?.unlocked, version]);

  useEffect(() => {
    if (!status) return;
    if (!status.unlocked && screen.name !== 'locked' && !session) setScreen({ name: 'locked' });
    if (status.unlocked && screen.name === 'locked') setScreen({ name: 'home' });
  }, [status, screen.name, session]);

  // Back to the student's lessons, with the progress the service just saved.
  const backToStudent = useCallback(async () => {
    if (session) setSession(await api.login(session.student.nfc_code).catch(() => session));
    setScreen({ name: 'student' });
  }, [api, session]);

  const logout = useCallback(async () => {
    if (session) await api.logout(session.student.id, (Date.now() - loginAt.current) / 1000).catch(() => undefined);
    setSession(null);
    setScreen({ name: 'home' });
  }, [api, session]);

  // Esc = the Back/Cancel button on the right controller.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (screen.name === 'lesson' || screen.name === 'score') void backToStudent();
      else if (screen.name === 'ranking') setScreen(session ? { name: 'student' } : { name: 'home' });
      else if (screen.name === 'camera') setScreen(screen.back);
      else if (screen.name === 'student') void logout();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, session, logout, backToStudent]);

  async function login(code: string) {
    try {
      const result = await api.login(code);
      loginAt.current = Date.now();
      setSession(result);
      setScreen({ name: 'student' });
      setError('');
    } catch (cause) {
      setScreen({ name: 'home', notice: (cause as Error).message });
    }
  }

  return (
    <div className="bench-shell">
      <header className="bench-header">
        <strong>TedTronics</strong>
        <span>
          {status?.bench_id ?? 'bancada'}
          {status?.package ? ` · ${status.package.module_title}` : ''}
          {session ? ` · ${session.student.nickname}` : ''}
        </span>
      </header>
      <main className="bench-stage">
        <FitStage>
          {error && <p className="app-error">{error}</p>}
          {screen.name === 'locked' && <Locked status={status} api={api} />}
          {screen.name === 'home' && (
            <Home
              api={api}
              pkg={pkg}
              notice={screen.notice}
              onTag={login}
              onRanking={() => setScreen({ name: 'ranking' })}
              onCamera={() => setScreen({ name: 'camera', back: { name: 'home' } })}
            />
          )}
          {screen.name === 'student' && session && pkg && (
            <StudentHome
              session={session}
              pkg={pkg}
              onOpen={(lessonId, phase) => setScreen({ name: 'lesson', lessonId, phase })}
              onRanking={() => setScreen({ name: 'ranking' })}
              onCamera={() => setScreen({ name: 'camera', back: { name: 'student' } })}
              onLogout={logout}
            />
          )}
          {screen.name === 'lesson' && session && pkg && (
            <LessonScreen
              key={`${screen.lessonId}-${screen.phase}`}
              api={api}
              student={session.student}
              lesson={pkg.lessons.find((l) => l.id === screen.lessonId)}
              phase={screen.phase}
              onExit={backToStudent}
              onFinished={async (result) => {
                await backToStudent();
                setScreen(screenAfterLesson(screen.lessonId, result));
              }}
            />
          )}
          {screen.name === 'score' && (
            <ScoreScreen
              score={screen.score}
              durationS={screen.durationS}
              ranking={screen.ranking}
              nickname={session?.student.nickname}
              onBack={() => setScreen({ name: 'student' })}
            />
          )}
          {screen.name === 'camera' && <CameraView onBack={() => setScreen(screen.back)} />}
          {screen.name === 'ranking' && (
            <RankingScreen
              api={api}
              pkg={pkg}
              onBack={() => setScreen(session ? { name: 'student' } : { name: 'home' })}
            />
          )}
        </FitStage>
      </main>
    </div>
  );
}

function Locked({ status, api }: { status: BenchStatus | null; api: BenchApi }) {
  const [picking, setPicking] = useState(false);
  if (picking) return <DemoPicker api={api} onCancel={() => setPicking(false)} />;
  return (
    <section className="bench-hero">
      <span className="bench-hero-icon" aria-hidden="true">
        <Icon name="lock" size={64} />
      </span>
      <h1>Bancada bloqueada</h1>
      <p>Peça ao professor para conectar o app.</p>
      {status?.bench_id && <span className="bench-chip">{status.bench_id}</span>}
      <button type="button" className="pill-link-btn muted bench-hero-foot" onClick={() => setPicking(true)}>
        Modo demonstração
      </button>
    </section>
  );
}

/** Demo mode: pick a curriculum module; the bench loads it with three demo students (no phone, no tags). */
function DemoPicker({ api, onCancel }: { api: BenchApi; onCancel?: () => void }) {
  const [choices, setChoices] = useState<DemoChoice[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    demoChoices().then(setChoices, (cause) => setError((cause as Error).message));
  }, []);
  async function start(choice: DemoChoice) {
    setBusy(true);
    try {
      await api.devDemo(await demoPackage(choice));
      setError('');
      onCancel?.();
    } catch (cause) {
      const message = (cause as Error).message;
      setError(
        message.includes('Not Found') || message.includes('Erro na bancada')
          ? 'O modo demonstração está desligado: inicie o serviço da bancada com --dev.'
          : message
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="bench-demo">
      <h1>Modo demonstração</h1>
      <p>Escolha o módulo. A bancada entra com alunos de teste, sem o app do professor.</p>
      {error && <Bubble kind="hamster" tone="erro" message={error} />}
      <div className="bench-demo-grid">
        {choices.map((choice) => (
          <button
            key={choice.key}
            type="button"
            className="bench-lesson-tile bench-demo-tile"
            disabled={busy}
            onClick={() => void start(choice)}
          >
            <span className="bench-lesson-title">{choice.title}</span>
            <small>{choice.description}</small>
          </button>
        ))}
      </div>
      {onCancel && (
        <button type="button" className="bench-tile small" onClick={onCancel}>
          <Icon name="back" size={24} />
          Voltar
        </button>
      )}
    </section>
  );
}

/** Ranking, camera and logout: big icon buttons at the foot of the home screens. */
function BenchFooter({
  onRanking,
  onCamera,
  onLogout,
}: {
  onRanking: () => void;
  onCamera: () => void;
  onLogout?: () => void;
}) {
  return (
    <nav className="bench-foot" aria-label="Mais opções">
      <button type="button" className="bench-tile" onClick={onRanking}>
        <Icon name="trophy" size={30} />
        Ranking
      </button>
      <button type="button" className="bench-tile" onClick={onCamera}>
        <Icon name="camera" size={30} />
        Câmera
      </button>
      {onLogout && (
        <button type="button" className="bench-tile" onClick={onLogout}>
          <Icon name="logout" size={30} />
          Sair
        </button>
      )}
    </nav>
  );
}

/** Home: the NFC reader types the tag code and Enter, like a keyboard (SFR35, SFR36). */
function Home({
  api,
  pkg,
  notice,
  onTag,
  onRanking,
  onCamera,
}: {
  api: BenchApi;
  pkg: BenchPackage | null;
  notice?: string;
  onTag: (code: string) => void;
  onRanking: () => void;
  onCamera: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const [code, setCode] = useState('');
  const input = useRef<HTMLInputElement>(null);
  // The reader acts as a keyboard: keep the field focused, also after a refused tag.
  useEffect(() => input.current?.focus(), [pkg, notice]);
  if (picking) return <DemoPicker api={api} onCancel={() => setPicking(false)} />;
  if (!pkg) {
    return (
      <section className="bench-hero">
        <span className="bench-hero-icon" aria-hidden="true">
          <Icon name="nfc" size={64} />
        </span>
        <h1>Quase lá!</h1>
        <p>Esperando o professor enviar um módulo.</p>
      </section>
    );
  }
  return (
    <section className="bench-hero">
      <span className="bench-chip">{pkg.module.title}</span>
      <span className="bench-hero-icon bench-hero-nfc" aria-hidden="true">
        <Icon name="nfc" size={72} />
      </span>
      <h1>Aproxime sua tag</h1>
      {notice && <Bubble kind="hamster" tone="erro" message={notice} />}
      {pkg.demo && (
        <div className="bench-demo-login" aria-label="Alunos de demonstração">
          <span>Demonstração: entrar como</span>
          {pkg.students.map((s) => (
            <button key={s.id} type="button" className="bench-tile small" onClick={() => onTag(s.nfc_code)}>
              {s.nickname}
            </button>
          ))}
          <button type="button" className="pill-link-btn muted" onClick={() => setPicking(true)}>
            Trocar módulo
          </button>
        </div>
      )}
      <form
        className="bench-tag-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (code.trim()) onTag(code.trim());
          setCode('');
        }}
      >
        <input
          id="bench-tag"
          ref={input}
          className="text-input"
          autoComplete="off"
          aria-label="Código da tag"
          placeholder="ou digite o código"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button className="btn-primary" type="submit">
          Entrar
        </button>
      </form>
      <BenchFooter onRanking={onRanking} onCamera={onCamera} />
    </section>
  );
}

const LESSONS_PER_PAGE = 6;

function StudentHome({
  session,
  pkg,
  onOpen,
  onRanking,
  onCamera,
  onLogout,
}: {
  session: LoginResult;
  pkg: BenchPackage;
  onOpen: (lessonId: string, phase: number) => void;
  onRanking: () => void;
  onCamera: () => void;
  onLogout: () => void;
}) {
  const lessons = lessonStates(pkg, session.progress);
  const resume = session.resume;
  const resumeLesson = pkg.lessons.find((l) => l.id === resume.lesson_id);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  // The module may have 20 lessons: show them six at a time, starting on the page of the lesson to continue.
  const pages = Math.max(1, Math.ceil(lessons.length / LESSONS_PER_PAGE));
  const resumeIndex = Math.max(
    0,
    lessons.findIndex((item) => item.lesson.id === resumeLesson?.id)
  );
  const [page, setPage] = useState(Math.floor(resumeIndex / LESSONS_PER_PAGE));
  const shown = lessons.slice(page * LESSONS_PER_PAGE, (page + 1) * LESSONS_PER_PAGE);
  return (
    <section className="bench-student">
      <div className="bench-student-head">
        <h1>Oi, {session.student.nickname}!</h1>
        {resumeLesson ? (
          <button
            ref={first}
            type="button"
            className="btn-primary bench-continue"
            onClick={() => onOpen(resumeLesson.id, resume.step_idx)}
          >
            <small>{resume.step_idx > 0 ? 'Continuar de onde parei' : 'Próxima lição'}</small>
            {resumeLesson.title}
          </button>
        ) : (
          <p className="bench-student-done">Você concluiu o módulo! Que tal refazer um desafio?</p>
        )}
      </div>
      <ol className="bench-lessons">
        {shown.map((item, i) => (
          <li key={item.lesson.id}>
            <button
              type="button"
              className={`bench-lesson-tile${item.done ? ' done' : ''}`}
              disabled={item.locked}
              onClick={() => onOpen(item.lesson.id, item.done ? 0 : item.phase)}
            >
              <span className="bench-lesson-num">{page * LESSONS_PER_PAGE + i + 1}</span>
              <span className="bench-lesson-title">{item.lesson.title}</span>
              <small>
                {item.lesson.kind === 'challenge' ? 'Desafio' : 'Guiada'} ·{' '}
                {item.done ? 'Concluída ✓' : item.phase > 0 ? 'Em andamento' : item.locked ? 'Bloqueada' : 'Nova'}
              </small>
            </button>
          </li>
        ))}
      </ol>
      {pages > 1 && (
        <div className="bench-pager">
          <button
            type="button"
            className="bench-tile small"
            disabled={page === 0}
            aria-label="Lições anteriores"
            onClick={() => setPage(page - 1)}
          >
            <Icon name="back" size={26} />
          </button>
          <span>
            {page + 1} / {pages}
          </span>
          <button
            type="button"
            className="bench-tile small"
            disabled={page >= pages - 1}
            aria-label="Próximas lições"
            onClick={() => setPage(page + 1)}
          >
            <Icon name="next" size={26} />
          </button>
        </div>
      )}
      <BenchFooter onRanking={onRanking} onCamera={onCamera} onLogout={onLogout} />
    </section>
  );
}

export interface LessonResult {
  kind: 'guided' | 'challenge';
  score: number | null;
  durationS: number;
  ranking: RankRow[];
}

function LessonScreen({
  api,
  student,
  lesson,
  phase,
  onExit,
  onFinished,
}: {
  api: BenchApi;
  student: BenchStudent;
  lesson: any;
  phase: number;
  onExit: () => void;
  onFinished: (result: LessonResult) => void;
}) {
  const lastPhase = useRef(phase);
  const [saveError, setSaveError] = useState('');
  if (!lesson) return <p className="app-error">Lição não encontrada no módulo.</p>;

  // SFR38: every finished phase is saved, so the student resumes at this exact point (SFR37.1).
  async function onEvent(event: PlayerEvent) {
    try {
      if (event.type === 'phase_done' && event.phase < event.phases) {
        lastPhase.current = event.phase;
        await api.step(student.id, { lesson_id: lesson.id, step_idx: event.phase - 1 });
      } else if (event.type === 'quiz') {
        await api.quiz(student.id, { lesson_id: lesson.id, quiz_id: event.quizId, correct: event.correct });
      } else if (event.type === 'lesson_done') {
        await api.step(student.id, {
          lesson_id: lesson.id,
          step_idx: lastPhase.current,
          lesson_done: true,
          duration_s: event.durationS,
        });
        let ranking: RankRow[] = [];
        if (event.score != null) {
          ranking = (
            await api.score(student.id, { lesson_id: lesson.id, score: event.score, duration_s: event.durationS })
          ).ranking;
        }
        onFinished({ kind: lesson.kind, score: event.score, durationS: event.durationS, ranking });
      }
      setSaveError('');
    } catch (cause) {
      setSaveError(`Não consegui salvar o progresso: ${(cause as Error).message}`);
    }
  }

  return (
    <section className="bench-lesson">
      {saveError && <p className="app-error">{saveError}</p>}
      <LessonPlayer
        lesson={lesson}
        mascotKind="hamster"
        bench
        startPhase={phase}
        onEvent={onEvent}
        onExit={onExit}
        exitLabel="Voltar (Esc)"
      />
    </section>
  );
}

function ScoreScreen({
  score,
  durationS,
  ranking,
  nickname,
  onBack,
}: {
  score: number;
  durationS: number;
  ranking: RankRow[];
  nickname?: string;
  onBack: () => void;
}) {
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => back.current?.focus(), []);
  return (
    <section className="bench-center">
      <Bubble
        kind="hamster"
        tone={score >= 70 ? 'ok' : 'obs'}
        message={score > 0 ? `Muito bem, ${nickname}!` : 'O tempo acabou. Tente de novo para pontuar!'}
      />
      <div className="panel bench-card">
        <div className="bench-score">
          {score}
          <small>pontos · {Math.round(durationS)} s</small>
        </div>
        <Podium ranking={ranking} />
        <button ref={back} type="button" className="btn-primary" onClick={onBack}>
          Continuar
        </button>
      </div>
    </section>
  );
}

function Podium({ ranking }: { ranking: RankRow[] }) {
  if (!ranking.length) return <p>Ninguém pontuou ainda.</p>;
  return (
    <ol className="bench-podium" aria-label="Três melhores">
      {ranking.map((row, i) => (
        <li key={row.student_id}>
          <span className="bench-medal">{['🥇', '🥈', '🥉'][i]}</span>
          <strong>{row.nickname}</strong>
          <span>
            {row.score} pts · {Math.round(row.duration_s)} s
          </span>
        </li>
      ))}
    </ol>
  );
}

/** SFR40: top 3 (score, then time) for each challenge of the module. */
function RankingScreen({ api, pkg, onBack }: { api: BenchApi; pkg: BenchPackage | null; onBack: () => void }) {
  const challenges = (pkg?.lessons ?? []).filter((l) => l.kind === 'challenge');
  const [lessonId, setLessonId] = useState<string | undefined>(challenges[0]?.id);
  const [rows, setRows] = useState<RankRow[]>([]);
  useEffect(() => {
    api.ranking(lessonId).then(setRows, () => setRows([]));
  }, [api, lessonId]);
  return (
    <section className="bench-center">
      <div className="panel bench-card">
        <h2>Ranking</h2>
        {challenges.length > 1 && (
          <select
            className="text-input"
            aria-label="Desafio"
            value={lessonId}
            onChange={(e) => setLessonId(e.target.value)}
          >
            {challenges.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        )}
        {challenges.length === 1 && <p>{challenges[0].title}</p>}
        <Podium ranking={rows} />
        <button type="button" className="btn-outline" onClick={onBack}>
          Voltar (Esc)
        </button>
      </div>
    </section>
  );
}
