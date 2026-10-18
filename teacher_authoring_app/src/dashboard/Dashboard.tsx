import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ClassDashboard, SchoolClass, StudentDashboard } from '../api/workspace.ts';
import { dashboard, formatDuration, workspace } from '../api/workspace.ts';

/** Student performance (SFR29, SFR29.1): score, progress and time per student, filled by bench syncs. */
export default function Dashboard() {
  const { classId, studentId } = useParams();
  if (studentId) return <StudentView key={studentId} studentId={Number(studentId)} />;
  return <ClassView key={classId ?? 'none'} classId={classId ? Number(classId) : undefined} />;
}

const percent = (value: number) => `${Math.round(value * 100)}%`;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');

function Progress({ value, label }: { value: number; label: string }) {
  return <progress className="progress-bar" aria-label={label} value={Math.round(value * 100)} max={100} />;
}

function ClassView({ classId }: { classId?: number }) {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [data, setData] = useState<ClassDashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    workspace.listClasses().then(
      (items) => {
        setClasses(items);
        if (classId == null && items.length) navigate(`/painel/${items[0].id}`, { replace: true });
      },
      (cause) => setError(cause.message)
    );
  }, [classId, navigate]);

  useEffect(() => {
    if (classId == null) return;
    dashboard.forClass(classId).then(setData, (cause) => setError(cause.message));
  }, [classId]);

  return (
    <div className="workspace-page">
      <h2>Painel de desempenho</h2>
      <p>Os dados chegam quando o app do professor sincroniza com a bancada.</p>
      {error && (
        <p className="app-error" role="alert">
          {error}
        </p>
      )}
      {classes.length === 0 && !error && (
        <p>
          Nenhuma turma cadastrada. <Link to="/turmas">Criar turma</Link>
        </p>
      )}
      {classes.length > 0 && (
        <div className="workspace-actions">
          <select
            className="text-input"
            aria-label="Turma"
            value={classId ?? ''}
            onChange={(e) => navigate(`/painel/${e.target.value}`)}
          >
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {data && (
        <>
          <div className="stat-row">
            <div className="stat-tile panel">
              <span>Alunos</span>
              <strong>{data.summary.students}</strong>
            </div>
            <div className="stat-tile panel">
              <span>Progresso médio</span>
              <strong>{percent(data.summary.avg_progress)}</strong>
            </div>
            <div className="stat-tile panel">
              <span>Melhor pontuação média</span>
              <strong>{data.summary.avg_best_score ?? '—'}</strong>
            </div>
            <div className="stat-tile panel">
              <span>Tempo total</span>
              <strong>{formatDuration(data.summary.time_spent_s)}</strong>
            </div>
          </div>
          {data.lesson_ids.length === 0 && (
            <p className="app-error">
              Esta turma não tem módulos nem lições atribuídos, então o progresso não pode ser calculado.{' '}
              <Link to={`/turmas/${data.class.id}`}>Atribuir módulos</Link>
            </p>
          )}
          {data.students.length === 0 ? (
            <p>Nenhum aluno nesta turma.</p>
          ) : (
            <div className="dash-table">
              <div className="dash-row dash-head" aria-hidden="true">
                <span>Aluno</span>
                <span>Progresso</span>
                <span>Pontuação</span>
                <span>Tempo</span>
                <span>Última atividade</span>
              </div>
              {data.students.map((row) => (
                <Link className="dash-row" key={row.student.id} to={`/painel/aluno/${row.student.id}`}>
                  <span className="dash-name">
                    <strong>{row.student.name}</strong>
                    <small>{row.student.nickname}</small>
                  </span>
                  <span data-label="Progresso">
                    <Progress value={row.progress} label={`Progresso de ${row.student.name}`} />
                    <small>
                      {row.lessons_done}/{row.lessons_total} lições
                    </small>
                  </span>
                  <span data-label="Pontuação">
                    {row.best_score ?? '—'}
                    {row.challenges > 0 && <small> melhor de {row.challenges}</small>}
                  </span>
                  <span data-label="Tempo">{formatDuration(row.time_spent_s)}</span>
                  <span data-label="Última atividade">{when(row.last_activity)}</span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const STATUS = { done: 'Concluída', in_progress: 'Em andamento', not_started: 'Não iniciada' };
const KIND = {
  session: 'Sessão na bancada',
  step_done: 'Passo concluído',
  lesson_done: 'Lição concluída',
  quiz_answer: 'Resposta de quiz',
  challenge_score: 'Desafio pontuado',
};

function StudentView({ studentId }: { studentId: number }) {
  const [data, setData] = useState<StudentDashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    dashboard.forStudent(studentId).then(setData, (cause) => setError(cause.message));
  }, [studentId]);

  return (
    <div className="workspace-page">
      {data && <Link to={`/painel/${data.student.class_id}`}>← Turma</Link>}
      {error && (
        <p className="app-error" role="alert">
          {error}
        </p>
      )}
      {data && (
        <>
          <h2>{data.student.name}</h2>
          <p>
            Apelido {data.student.nickname} · {data.student.nfc_code ? `Tag ${data.student.nfc_code}` : 'Sem tag'}
          </p>
          <div className="stat-row">
            <div className="stat-tile panel">
              <span>Progresso</span>
              <strong>{percent(data.progress)}</strong>
              <Progress value={data.progress} label="Progresso" />
            </div>
            <div className="stat-tile panel">
              <span>Melhor pontuação</span>
              <strong>{data.best_score ?? '—'}</strong>
            </div>
            <div className="stat-tile panel">
              <span>Última pontuação</span>
              <strong>{data.last_score ?? '—'}</strong>
            </div>
            <div className="stat-tile panel">
              <span>Tempo na bancada</span>
              <strong>{formatDuration(data.time_spent_s)}</strong>
            </div>
          </div>
          <section className="panel workspace-section">
            <h2>Lições</h2>
            {data.lessons.length === 0 && <p>A turma ainda não tem lições atribuídas.</p>}
            <ul className="workspace-list">
              {data.lessons.map((lesson) => (
                <li key={lesson.lesson_id}>
                  <span>
                    <strong>{lesson.title}</strong>
                    <br />
                    <small>
                      {STATUS[lesson.status]}
                      {lesson.status === 'in_progress' && ` · ${lesson.steps_done} passos`}
                      {lesson.best_score != null && ` · pontuação ${lesson.best_score}`}
                      {lesson.time_spent_s > 0 && ` · ${formatDuration(lesson.time_spent_s)}`}
                    </small>
                  </span>
                  <span className={`status-pill ${lesson.status}`}>{STATUS[lesson.status]}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="panel workspace-section">
            <h2>Atividade recente</h2>
            {data.events.length === 0 && <p>Nenhuma atividade sincronizada ainda.</p>}
            <ul className="workspace-list">
              {data.events.map((event) => (
                <li key={event.event_id}>
                  <span>
                    {KIND[event.kind] ?? event.kind}
                    {event.lesson_title && ` · ${event.lesson_title}`}
                    {event.step_idx != null && ` · passo ${event.step_idx + 1}`}
                    {event.score != null && event.kind === 'challenge_score' && ` · ${event.score} pontos`}
                    {event.duration_s != null && ` · ${formatDuration(event.duration_s)}`}
                  </span>
                  <time dateTime={event.at}>{when(event.at)}</time>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
