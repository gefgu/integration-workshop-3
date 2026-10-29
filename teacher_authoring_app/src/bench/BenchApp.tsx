import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BenchPackage, BenchStatus, BenchStudent } from '../../../protocol/bench.ts';
import { setValidatorBase } from '../api/validator.ts';
import Bubble from '../components/Bubble.tsx';
import LessonPlayer, { type PlayerEvent } from '../player/LessonPlayer.tsx';
import { type BenchApi, benchApi, type LoginResult, type RankRow, serviceUrl } from './benchApi.ts';
import CameraView from './CameraView.tsx';
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
        {error && <p className="app-error">{error}</p>}
        {screen.name === 'locked' && <Locked status={status} api={api} />}
        {screen.name === 'home' && (
          <Home
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
      </main>
    </div>
  );
}

function Locked({ status, api }: { status: BenchStatus | null; api: BenchApi }) {
  const [demo, setDemo] = useState('');
  return (
    <section className="bench-center">
      <Bubble
        kind="hamster"
        tone="info"
        message="Olá! Peça ao seu professor para conectar o app à bancada. Depois é só aproximar sua tag."
      />
      <div className="panel bench-card">
        <h2>Bancada bloqueada</h2>
        <p>
          Aguardando o app do professor (Bluetooth). Esta bancada se chama <strong>{status?.bench_id ?? '…'}</strong>.
        </p>
        <button
          type="button"
          className="pill-link-btn muted"
          onClick={() =>
            api.devUnlock().then(
              () => setDemo(''),
              () => setDemo('Modo demonstração desligado (inicie o serviço com --dev).')
            )
          }
        >
          Modo demonstração
        </button>
        {demo && <p className="muted-line">{demo}</p>}
      </div>
    </section>
  );
}

/** Home: the NFC reader types the tag code and Enter, like a keyboard (SFR35, SFR36). */
function Home({
  pkg,
  notice,
  onTag,
  onRanking,
  onCamera,
}: {
  pkg: BenchPackage | null;
  notice?: string;
  onTag: (code: string) => void;
  onRanking: () => void;
  onCamera: () => void;
}) {
  const [code, setCode] = useState('');
  const input = useRef<HTMLInputElement>(null);
  // The reader acts as a keyboard: keep the field focused, also after a refused tag.
  useEffect(() => input.current?.focus(), [pkg, notice]);
  if (!pkg) {
    return (
      <section className="bench-center">
        <Bubble
          kind="hamster"
          tone="obs"
          message="A bancada está liberada, mas ainda não recebeu um módulo do professor."
        />
      </section>
    );
  }
  return (
    <section className="bench-center">
      <Bubble
        kind="hamster"
        tone={notice ? 'erro' : 'info'}
        message={notice ?? `Módulo “${pkg.module.title}”. Aproxime sua tag do leitor para começar!`}
      />
      <form
        className="panel bench-card"
        onSubmit={(event) => {
          event.preventDefault();
          if (code.trim()) onTag(code.trim());
          setCode('');
        }}
      >
        <label className="field-label" htmlFor="bench-tag">
          Leitor de tag
        </label>
        <input
          id="bench-tag"
          ref={input}
          className="text-input"
          autoComplete="off"
          placeholder="Aproxime a tag (ou digite o código)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <div className="workspace-actions">
          <button className="btn-primary" type="submit">
            Entrar
          </button>
          <button className="btn-outline" type="button" onClick={onRanking}>
            Ranking
          </button>
          <button className="btn-outline" type="button" onClick={onCamera}>
            Câmera
          </button>
        </div>
      </form>
    </section>
  );
}

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
  return (
    <section className="bench-center">
      <Bubble
        kind="hamster"
        tone="ok"
        message={
          resumeLesson
            ? `Oi, ${session.student.nickname}! Vamos continuar “${resumeLesson.title}”?`
            : `Oi, ${session.student.nickname}! Você concluiu todas as lições deste módulo. Que tal refazer um desafio?`
        }
      />
      <div className="panel bench-card">
        {resumeLesson && (
          <button
            ref={first}
            type="button"
            className="btn-primary bench-big"
            onClick={() => onOpen(resumeLesson.id, resume.step_idx)}
          >
            {resume.step_idx > 0 ? 'Continuar de onde parei' : `Começar “${resumeLesson.title}”`}
          </button>
        )}
        <ol className="bench-lessons">
          {lessons.map((item) => (
            <li key={item.lesson.id}>
              <button
                type="button"
                className="btn-outline"
                disabled={item.locked}
                onClick={() => onOpen(item.lesson.id, item.done ? 0 : item.phase)}
              >
                <span>{item.lesson.title}</span>
                <small>
                  {item.lesson.kind === 'challenge' ? 'Desafio' : 'Guiada'} ·{' '}
                  {item.done ? 'Concluída' : item.phase > 0 ? 'Em andamento' : item.locked ? 'Bloqueada' : 'Nova'}
                </small>
              </button>
            </li>
          ))}
        </ol>
        <div className="workspace-actions">
          <button type="button" className="btn-outline" onClick={onRanking}>
            Ranking
          </button>
          <button type="button" className="btn-outline" onClick={onCamera}>
            Câmera
          </button>
          <button type="button" className="btn-outline" onClick={onLogout}>
            Sair
          </button>
        </div>
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
        message={
          score > 0
            ? `Desafio concluído, ${nickname}! Você fez ${score} pontos.`
            : 'O tempo acabou, mas você terminou! Tente de novo para pontuar.'
        }
      />
      <div className="panel bench-card">
        <div className="bench-score">{score}</div>
        <p>Tempo: {Math.round(durationS)} s</p>
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
