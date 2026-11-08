import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BenchPackage, BenchStatus, BenchStudent } from '../../../protocol/bench.ts';
import { setValidatorBase } from '../api/validator.ts';
import Bubble from '../components/Bubble.tsx';
import Icon from '../components/Icon.tsx';
import Tour, { useFirstRunTour } from '../components/Tour.tsx';
import LessonPlayer, { type PlayerEvent } from '../player/LessonPlayer.tsx';
import { BENCH_TOURS } from '../tour/benchTours.ts';
import { type BenchApi, benchApi, type LoginResult, type RankRow, serviceUrl, type VisionState } from './benchApi.ts';
import BenchMenu, { type MenuOption } from './BenchMenu.tsx';
import CameraView from './CameraView.tsx';
import { type DemoChoice, demoChoices, demoPackage } from './demo.ts';
import FitStage from './FitStage.tsx';
import { ensureSelection, handlePadKey, padElements, selectedItem, selectElement } from './pad.ts';
import { lessonStates, nextLessonId, type Screen, screenAfterLesson } from './screens.ts';
import { useHardwareControls } from './useHardwareControls.ts';
import { useVision } from './useVision.ts';

const NO_PIECES: never[] = [];

/**
 * The workbench's 7" screen. Exactly one screen is shown at a time (SFR17): locked (waiting for the
 * teacher's app), home (tap your tag), the student's lessons, a running lesson, the score, the ranking and the
 * camera board view.
 * Played like a game console (see pad.ts): joystick = arrows, its click = Enter, a long press = Escape (menu).
 */
export default function BenchApp() {
  const base = useMemo(() => serviceUrl(), []);
  const api = useMemo(() => benchApi(base), [base]);
  useHardwareControls(base); // ESP32 joystick + Energizar, through the bench service
  const [status, setStatus] = useState<BenchStatus | null>(null);
  const [pkg, setPkg] = useState<BenchPackage | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'locked' });
  const [session, setSession] = useState<LoginResult | null>(null);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const loginAt = useRef(0);
  const vision = useVision(api);
  // Guided tours: the first time each screen appears on this bench, and again from the ? button.
  const [labReady, setLabReady] = useState(false);
  useEffect(() => {
    if (screen.name !== 'lesson') {
      setLabReady(false);
      return undefined;
    }
    const timer = setInterval(() => setLabReady(!!document.querySelector('.bench-stage .lab-step')), 500);
    return () => clearInterval(timer);
  }, [screen.name]);
  const tourKey =
    screen.name === 'home' && pkg
      ? 'bench-home'
      : screen.name === 'student'
        ? 'bench-student'
        : screen.name === 'lesson' && labReady
          ? 'bench-lesson'
          : null;
  const tour = useFirstRunTour(tourKey);

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

  // The joystick acts on what the controls mean (pad.ts), not on every button in a row.
  useEffect(() => {
    const energize = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || menuOpen) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenuOpen(true);
        return;
      }
      const target = event.target as HTMLInputElement | null;
      const typing = target?.tagName === 'INPUT' && target.type === 'text';
      if (typing && ['ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(event.key)) return;
      const stage = document.querySelector('.bench-stage');
      if (stage && handlePadKey(event.key, stage, energize)) event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // Every screen with choices shows one selected, as soon as it appears (and again after it changes).
  useEffect(() => {
    if (menuOpen) return undefined;
    const timer = setInterval(() => {
      const stage = document.querySelector('.bench-stage');
      if (stage) ensureSelection(stage);
    }, 150);
    return () => clearInterval(timer);
  }, [menuOpen]);

  // The game menu: what used to be extra buttons on every screen.
  const menuOptions: MenuOption[] = [
    { id: 'resume', label: 'Continuar', icon: 'resume', onSelect: () => undefined },
    {
      id: 'sound',
      label: muted ? 'Ligar o som' : 'Desligar o som',
      icon: muted ? 'mute' : 'sound',
      onSelect: () => setMuted(!muted),
    },
  ];
  if (tourKey) menuOptions.push({ id: 'help', label: 'Ajuda', icon: 'help', onSelect: tour.start });
  if (pkg && (screen.name === 'home' || screen.name === 'student')) {
    menuOptions.push({ id: 'ranking', label: 'Ranking', icon: 'trophy', onSelect: () => setScreen({ name: 'ranking' }) });
    const back: Screen = screen.name === 'student' ? { name: 'student' } : { name: 'home' };
    menuOptions.push({ id: 'camera', label: 'Câmera', icon: 'camera', onSelect: () => setScreen({ name: 'camera', back }) });
  }
  if (screen.name === 'lesson') {
    menuOptions.push({ id: 'leave', label: 'Sair da lição', icon: 'back', onSelect: () => void backToStudent() });
  }
  if (session && screen.name !== 'lesson') {
    menuOptions.push({ id: 'logout', label: 'Trocar de aluno', icon: 'logout', onSelect: () => void logout() });
  }

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
        <span className="bench-menu-hint-bar">
          <kbd>segure</kbd> o joystick: menu
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
            />
          )}
          {screen.name === 'student' && session && pkg && (
            <StudentHome
              session={session}
              pkg={pkg}
              onOpen={(lessonId, phase) => setScreen({ name: 'lesson', lessonId, phase })}
              onLogout={() => void logout()}
            />
          )}
          {screen.name === 'lesson' && session && pkg && (
            <LessonScreen
              key={`${screen.lessonId}-${screen.phase}`}
              api={api}
              student={session.student}
              lesson={pkg.lessons.find((l) => l.id === screen.lessonId)}
              phase={screen.phase}
              vision={vision}
              muted={muted}
              onExit={backToStudent}
              onFinished={async (result) => {
                await backToStudent();
                setScreen(screenAfterLesson(screen.lessonId, result, nextLessonId(pkg, screen.lessonId)));
              }}
            />
          )}
          {screen.name === 'score' && (
            <ScoreScreen
              score={screen.score}
              durationS={screen.durationS}
              ranking={screen.ranking}
              nickname={session?.student.nickname}
              onBack={() =>
                setScreen(screen.next ? { name: 'lesson', lessonId: screen.next, phase: 0 } : { name: 'student' })
              }
            />
          )}
          {screen.name === 'camera' && <CameraView api={api} vision={vision} onBack={() => setScreen(screen.back)} />}
          {screen.name === 'ranking' && (
            <RankingScreen
              api={api}
              pkg={pkg}
              onBack={() => setScreen(session ? { name: 'student' } : { name: 'home' })}
            />
          )}
        </FitStage>
      </main>
      {menuOpen && <BenchMenu options={menuOptions} onClose={() => setMenuOpen(false)} />}
      {tour.open && tourKey && (
        <Tour
          key={tourKey}
          steps={BENCH_TOURS[tourKey]}
          onClose={tour.close}
          className="bench-tour"
          cardWidth={460}
          gamePad
        />
      )}
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
      <button
        type="button"
        className="pill-link-btn muted bench-hero-foot"
        data-pad="item"
        onClick={() => setPicking(true)}
      >
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
            data-pad="item"
            disabled={busy}
            onClick={() => void start(choice)}
          >
            <span className="bench-lesson-title">{choice.title}</span>
            <small>{choice.description}</small>
          </button>
        ))}
      </div>
      {onCancel && (
        <button type="button" className="bench-tile small" data-pad="back" onClick={onCancel}>
          <Icon name="back" size={24} />
          Voltar
        </button>
      )}
    </section>
  );
}

/** Home: the NFC reader types the tag code and Enter, like a keyboard (SFR35, SFR36). */
function Home({
  api,
  pkg,
  notice,
  onTag,
}: {
  api: BenchApi;
  pkg: BenchPackage | null;
  notice?: string;
  onTag: (code: string) => void;
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
            <button
              key={s.id}
              type="button"
              className="bench-tile small"
              data-pad="item"
              onClick={() => onTag(s.nfc_code)}
            >
              {s.nickname}
            </button>
          ))}
          <button type="button" className="pill-link-btn muted" data-pad="item" onClick={() => setPicking(true)}>
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
    </section>
  );
}

const LESSONS_PER_PAGE = 6;

function StudentHome({
  session,
  pkg,
  onOpen,
  onLogout,
}: {
  session: LoginResult;
  pkg: BenchPackage;
  onOpen: (lessonId: string, phase: number) => void;
  onLogout: () => void;
}) {
  // Like a game's title screen: Começar (pick a lesson), Continuar (where you stopped) or Sair.
  const [view, setView] = useState<'title' | 'lessons'>('title');
  const resume = session.resume;
  const resumeLesson = pkg.lessons.find((l) => l.id === resume.lesson_id);
  if (view === 'lessons') return <LessonPicker session={session} pkg={pkg} onOpen={onOpen} onBack={() => setView('title')} />;
  return (
    <section className="bench-title">
      <h1>Oi, {session.student.nickname}!</h1>
      <div className="bench-title-menu">
        <button
          type="button"
          className="bench-title-tile"
          data-pad="item"
          data-pad-default={resumeLesson ? undefined : ''}
          onClick={() => setView('lessons')}
        >
          <Icon name="play" size={44} />
          Começar
          <small>Escolher uma lição</small>
        </button>
        <button
          type="button"
          className="bench-title-tile primary"
          data-pad="item"
          data-pad-default={resumeLesson ? '' : undefined}
          disabled={!resumeLesson}
          onClick={() => resumeLesson && onOpen(resumeLesson.id, resume.step_idx)}
        >
          <Icon name="next" size={44} />
          Continuar
          <small>{resumeLesson ? resumeLesson.title : 'Você concluiu o módulo!'}</small>
        </button>
        <button type="button" className="bench-title-tile" data-pad="item" onClick={onLogout}>
          <Icon name="logout" size={44} />
          Sair
          <small>Trocar de aluno</small>
        </button>
      </div>
    </section>
  );
}

/** The module's lessons, six at a time: ↓ on the last one turns the page, ← goes back to the title screen. */
function LessonPicker({
  session,
  pkg,
  onOpen,
  onBack,
}: {
  session: LoginResult;
  pkg: BenchPackage;
  onOpen: (lessonId: string, phase: number) => void;
  onBack: () => void;
}) {
  const lessons = lessonStates(pkg, session.progress);
  const resumeIndex = Math.max(
    0,
    lessons.findIndex((item) => item.lesson.id === session.resume.lesson_id)
  );
  const list = useRef<HTMLOListElement>(null);
  const pages = Math.max(1, Math.ceil(lessons.length / LESSONS_PER_PAGE));
  const [page, setPage] = useState(Math.floor(resumeIndex / LESSONS_PER_PAGE));
  const pendingSelect = useRef<'first' | 'last' | null>(null);
  const shown = lessons.slice(page * LESSONS_PER_PAGE, (page + 1) * LESSONS_PER_PAGE);
  // biome-ignore lint/correctness/useExhaustiveDependencies: select on the new page once it renders
  useEffect(() => {
    const stage = document.querySelector('.bench-stage');
    if (!pendingSelect.current || !list.current || !stage) return;
    const tiles = padElements(list.current, 'item');
    selectElement(stage, pendingSelect.current === 'first' ? tiles[0] : tiles[tiles.length - 1]);
    pendingSelect.current = null;
  }, [page]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // ↑ and → go forward through the lessons, ↓ and ← go back (← on the very first one is Voltar).
      const forward = event.key === 'ArrowUp' || event.key === 'ArrowRight';
      if (!forward && event.key !== 'ArrowDown' && event.key !== 'ArrowLeft') return;
      const stage = document.querySelector('.bench-stage');
      if (!stage || !list.current) return;
      const tiles = padElements(list.current, 'item');
      const at = tiles.indexOf(selectedItem(stage) as HTMLElement);
      if (at < 0) return;
      if (forward && at === tiles.length - 1 && page < pages - 1) {
        pendingSelect.current = 'first';
        setPage(page + 1);
      } else if (!forward && at === 0 && page > 0) {
        pendingSelect.current = 'last';
        setPage(page - 1);
      } else {
        return;
      }
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [page, pages]);
  return (
    <section className="bench-student">
      <div className="bench-student-head">
        <h1>Escolha a lição</h1>
      </div>
      <ol className="bench-lessons" ref={list}>
        {shown.map((item, i) => (
          <li key={item.lesson.id}>
            <button
              type="button"
              className={`bench-lesson-tile${item.done ? ' done' : ''}${item.locked ? ' locked' : ''}${
                page * LESSONS_PER_PAGE + i === resumeIndex && !item.done && !item.locked ? ' current' : ''
              }`}
              data-pad="item"
              data-pad-default={page * LESSONS_PER_PAGE + i === resumeIndex ? '' : undefined}
              aria-disabled={item.locked}
              onClick={() => !item.locked && onOpen(item.lesson.id, item.done ? 0 : item.phase)}
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
      <div className="bench-pager">
        <button type="button" className="bench-tile small" data-pad="back" onClick={onBack}>
          <Icon name="back" size={24} />
          Voltar
        </button>
        {pages > 1 && (
          <span aria-live="polite">
            Página {page + 1} de {pages}
          </span>
        )}
      </div>
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
  vision,
  muted,
  onExit,
  onFinished,
}: {
  api: BenchApi;
  student: BenchStudent;
  lesson: any;
  phase: number;
  vision: VisionState;
  muted: boolean;
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
        exitLabel="Sair da lição"
        voiceMuted={muted}
        livePieces={vision.available ? (vision.pieces ?? NO_PIECES) : null}
        barExtra={<CameraStatus vision={vision} />}
      />
      <PadHints />
      <FitLeftColumn />
    </section>
  );
}

/**
 * The board sets the lesson screen's size: the left column (tutor, tray, explanations, Energizar) shrinks to the
 * board's height, so the whole screen is not scaled down for it and the board stays as big as the 7" allows.
 */
function FitLeftColumn() {
  useEffect(() => {
    const timer = setInterval(() => {
      const lab = document.querySelector<HTMLElement>('.bench-lesson .lab-step');
      const board = lab?.querySelector<HTMLElement>('.board-workbench-column');
      if (!lab || !board) return;
      // Each step is a new lab-step element: its own zoom, starting at 1.
      const zoom = Number.parseFloat(lab.style.getPropertyValue('--left-zoom')) || 1;
      const rects = [...lab.querySelectorAll<HTMLElement>(':scope > *, :scope > .board-workspace > *')]
        .filter((el) => !el.contains(board) && getComputedStyle(el).display !== 'contents')
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.height > 0); // hidden panels report a 0×0 box at the page's top
      if (!rects.length) return;
      const top = Math.min(...rects.map((r) => r.top));
      const bottom = Math.max(...rects.map((r) => r.bottom));
      const left = bottom - top;
      const boardH = board.getBoundingClientRect().height;
      if (!left || !boardH) return;
      const next = Math.max(0.55, Math.min(1, (zoom * boardH) / left));
      if (Math.abs(next - zoom) < 0.02) return;
      lab.style.setProperty('--left-zoom', next.toFixed(3));
    }, 250);
    return () => clearInterval(timer);
  }, []);
  return null;
}

/**
 * Inside a lesson the joystick only goes back (←), forward (→) or energizes (click). This bar says which of the
 * three works right now; the real controls stay in the page for the joystick, out of sight.
 */
function PadHints() {
  const [state, setState] = useState({ back: false, next: false, energize: false, on: false, choices: false });
  useEffect(() => {
    const timer = setInterval(() => {
      const stage = document.querySelector('.bench-lesson');
      if (!stage) return;
      const next = {
        back: padElements(stage, 'back').length + padElements(stage, 'step-back').length > 0,
        next: padElements(stage, 'next').length > 0,
        energize: padElements(stage, 'energize').length > 0,
        on: !!stage.querySelector('.power-indicator.on'),
        choices: padElements(stage, 'item').length > 0,
      };
      setState((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? cur : next));
    }, 200);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="bench-pad-hints" aria-hidden="true">
      <span className={state.back ? '' : 'off'}>◀ Voltar</span>
      {state.choices && <span>↑↓ escolher · clique: confirmar</span>}
      {state.energize && (
        <span>
          <i className={`dot${state.on ? ' on' : ''}`} /> Enter: {state.on ? 'desligar' : 'energizar'}
        </span>
      )}
      <span className={state.next ? 'ready' : 'off'}>Próximo ▶</span>
    </div>
  );
}

/** In the lesson bar: whether the camera is reading the real board (the screen board follows it). */
function CameraStatus({ vision }: { vision: VisionState }) {
  if (!vision.available) {
    return (
      <span className="bench-camera-chip off" title="Sem câmera: a placa da tela é uma simulação.">
        <Icon name="camera" size={18} /> simulação
      </span>
    );
  }
  const unknown = vision.unknown?.length ?? 0;
  return (
    <span className={`bench-camera-chip${vision.valid ? '' : ' paused'}`} role="status">
      <Icon name="camera" size={18} />
      {vision.valid ? 'lendo a placa' : vision.reason || 'aguardando imagem'}
      {unknown > 0 && ` · ${unknown} peça${unknown > 1 ? 's' : ''} não reconhecida${unknown > 1 ? 's' : ''}`}
    </span>
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
        <button ref={back} type="button" className="btn-primary" data-pad="next" onClick={onBack}>
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

/**
 * SFR40: one ranking on screen at a time. It opens on the module's overall ranking (best score per challenge,
 * added up); ↑/↓ go through each challenge's own top 3. ← is Voltar.
 */
function RankingScreen({ api, pkg, onBack }: { api: BenchApi; pkg: BenchPackage | null; onBack: () => void }) {
  const challenges = (pkg?.lessons ?? []).filter((l) => l.kind === 'challenge');
  const views = [{ id: null as string | null, title: 'Ranking geral' }, ...challenges.map((l) => ({ id: l.id, title: l.title }))];
  const [at, setAt] = useState(0);
  const [rows, setRows] = useState<RankRow[]>([]);
  const view = views[Math.min(at, views.length - 1)];
  useEffect(() => {
    const load = view.id ? api.ranking(view.id) : api.overallRanking();
    load.then(setRows, () => setRows([]));
  }, [api, view.id]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      const step = event.key === 'ArrowUp' ? 1 : -1;
      setAt((i) => (i + step + views.length) % views.length);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [views.length]);
  return (
    <section className="bench-center">
      <div className="panel bench-card bench-ranking">
        <div className="bench-ranking-head">
          <span className="bench-ranking-arrow" aria-hidden="true">
            ▲
          </span>
          <h2>{view.title}</h2>
          <span className="bench-ranking-arrow" aria-hidden="true">
            ▼
          </span>
          <small>
            {at + 1} de {views.length} · mova o joystick ↑↓ para trocar
          </small>
        </div>
        {view.id === null && <p className="bench-ranking-note">Soma da melhor pontuação de cada desafio</p>}
        <Podium ranking={rows} />
        <button type="button" className="btn-outline" data-pad="back" onClick={onBack}>
          Voltar
        </button>
      </div>
    </section>
  );
}
