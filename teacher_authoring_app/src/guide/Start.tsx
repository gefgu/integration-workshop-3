import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { importCurriculum } from '../api/curriculum.ts';
import type { Module, SchoolClass, Student } from '../api/workspace.ts';
import { workspace } from '../api/workspace.ts';
import { setupSteps } from './steps.ts';

interface Snapshot {
  classes: SchoolClass[];
  students: Student[];
  modules: Module[];
}

/** "Primeiros passos": the whole path from an empty account to a module on the bench, with the next step highlighted. */
export default function Start({ onLessonsChanged }: { onLessonsChanged?: () => void }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [className, setClassName] = useState('');
  const [assign, setAssign] = useState({ moduleId: '', classId: '' });

  const load = useCallback(async () => {
    try {
      const [classes, students, modules] = await Promise.all([
        workspace.listClasses(),
        workspace.listStudents(),
        workspace.listModules(),
      ]);
      setData({ classes, students, modules });
      setError('');
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label);
    try {
      await action();
      setError('');
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy('');
    }
  }

  if (!data) return <p className="workspace-loading">{error || 'Carregando seus primeiros passos…'}</p>;

  const steps = setupSteps(data);
  const next = steps.find((step) => !step.done);
  const counted = steps.filter((step) => step.id !== 'send');
  const finished = counted.filter((step) => step.done).length;
  const moduleId = assign.moduleId || String(data.modules[0]?.id ?? '');
  const classId = assign.classId || String(data.classes[0]?.id ?? '');
  const bench = `${window.location.protocol}//${window.location.hostname}:5173/bench.html`;

  return (
    <div className="workspace-page start-page">
      <h2>Primeiros passos</h2>
      <p>
        Do zero até o aluno usar a bancada: {finished} de {counted.length} etapas prontas no site; a última é no
        celular.
      </p>
      <div
        className="start-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={counted.length}
        aria-valuenow={finished}
      >
        <span style={{ width: `${(finished / counted.length) * 100}%` }} />
      </div>
      {error && (
        <p className="app-error" role="alert">
          {error}
        </p>
      )}

      <ol className="start-steps">
        {steps.map((step, index) => {
          const current = step === next;
          return (
            <li key={step.id} className={`panel start-step${step.done ? ' done' : ''}${current ? ' current' : ''}`}>
              <span className="start-mark" aria-hidden="true">
                {step.done ? '✓' : index + 1}
              </span>
              <div className="start-body">
                <h3>
                  {step.title}
                  {step.done && <span className="visually-hidden"> (concluído)</span>}
                  {current && <span className="start-badge">Próximo passo</span>}
                </h3>
                <p>{step.done ? step.doneText : step.help}</p>

                {step.id === 'content' && !step.done && (
                  <div className="workspace-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        run('curriculum', async () => {
                          await importCurriculum(({ done, total }) => setBusy(`curriculum ${done}/${total}`));
                          onLessonsChanged?.();
                        })
                      }
                    >
                      {busy.startsWith('curriculum')
                        ? `Importando… ${busy.replace('curriculum ', '')}`
                        : 'Usar currículo TedTronics'}
                    </button>
                    <Link to="/modulos" className="btn-outline">
                      Criar meu próprio módulo
                    </Link>
                  </div>
                )}

                {step.id === 'class' && !step.done && (
                  <form
                    className="workspace-actions"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void run('class', () => workspace.createClass({ name: className.trim(), description: '' }));
                      setClassName('');
                    }}
                  >
                    <input
                      className="text-input"
                      required
                      maxLength={255}
                      aria-label="Nome da turma"
                      placeholder="Ex.: 7º ano A"
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                    />
                    <button type="submit" className="btn-primary" disabled={Boolean(busy)}>
                      Criar turma
                    </button>
                  </form>
                )}

                {step.id === 'students' && (
                  <div className="workspace-actions">
                    <Link
                      to={data.classes.length ? '/alunos' : '/turmas'}
                      className={current ? 'btn-primary' : 'btn-outline'}
                    >
                      {step.done ? 'Gerenciar alunos' : 'Cadastrar alunos e tags'}
                    </Link>
                  </div>
                )}

                {step.id === 'assign' && !step.done && data.modules.length > 0 && data.classes.length > 0 && (
                  <form
                    className="workspace-actions"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void run('assign', async () => {
                        const detail = await workspace.getClass(Number(classId));
                        const ids = [...new Set([...detail.module_ids, Number(moduleId)])];
                        await workspace.setClassModules(Number(classId), ids);
                      });
                    }}
                  >
                    <select
                      className="text-input"
                      aria-label="Módulo"
                      value={moduleId}
                      onChange={(e) => setAssign({ moduleId: e.target.value, classId })}
                    >
                      {data.modules.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                    <select
                      className="text-input"
                      aria-label="Turma"
                      value={classId}
                      onChange={(e) => setAssign({ moduleId, classId: e.target.value })}
                    >
                      {data.classes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="btn-primary" disabled={Boolean(busy)}>
                      Atribuir à turma
                    </button>
                  </form>
                )}

                {step.id === 'send' && (
                  <ol className="start-substeps">
                    <li>
                      No app do professor, abra <strong>Bancada</strong> e conecte (Bluetooth ou Simulador).
                    </li>
                    <li>
                      Abra <strong>Módulos</strong>, escolha o módulo e a turma e toque em{' '}
                      <strong>Enviar para a bancada</strong>.
                    </li>
                    <li>
                      Na tela do aluno, o aluno aproxima a tag.{' '}
                      <a href={bench} target="_blank" rel="noreferrer">
                        Abrir a tela da bancada
                      </a>
                    </li>
                  </ol>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
