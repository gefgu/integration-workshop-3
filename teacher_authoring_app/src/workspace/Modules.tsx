import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Module, SchoolClass } from '../api/workspace.ts';
import { bench, workspace } from '../api/workspace.ts';
import type { Lesson } from '../model/types.ts';
import { downloadBlob } from '../storage/lessonStore.ts';
import OrderedPicker from './OrderedPicker.tsx';

/** A module is an ordered track of lessons; classes receive modules and the bench loads one at a time. */
export default function Modules({ lessons }: { lessons: Lesson[] }) {
  const { moduleId } = useParams();
  return moduleId ? (
    <ModulePage key={moduleId} moduleId={Number(moduleId)} lessons={lessons} />
  ) : (
    <ModuleList lessons={lessons} />
  );
}

const kindLabel = (lesson?: Lesson) => (lesson?.kind === 'challenge' ? 'desafio' : 'guiada');

function ModuleList({ lessons }: { lessons: Lesson[] }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<Module[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    workspace.listModules().then(setItems, (cause) => setError(cause.message));
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    try {
      const item = await workspace.createModule({ title, description });
      navigate(`/modulos/${item.id}`);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <div className="workspace-page">
      <h2>Módulos</h2>
      <p>Um módulo é uma trilha de lições em ordem. Atribua módulos às turmas; o aplicativo do professor leva o pacote à bancada.</p>
      {error && (
        <p className="app-error" role="alert">
          {error}
        </p>
      )}
      <form className="panel workspace-form" onSubmit={create}>
        <h3>Novo módulo</h3>
        <label className="field-label" htmlFor="module-title">
          Título
        </label>
        <input
          id="module-title"
          className="text-input"
          required
          maxLength={255}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex.: Primeiros circuitos"
        />
        <label className="field-label" htmlFor="module-description">
          Descrição
        </label>
        <textarea
          id="module-description"
          className="text-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button className="btn-primary" type="submit">
          Criar módulo
        </button>
      </form>
      <div className="workspace-cards">
        {items.map((item) => (
          <article className="panel" key={item.id}>
            <h3>{item.title}</h3>
            <p>{item.description || 'Sem descrição'}</p>
            <p className="muted-line">
              {item.lesson_ids.length} {item.lesson_ids.length === 1 ? 'lição' : 'lições'} · {item.class_ids.length}{' '}
              {item.class_ids.length === 1 ? 'turma' : 'turmas'}
            </p>
            <ol className="compact-list">
              {item.lesson_ids.slice(0, 4).map((lessonId) => (
                <li key={lessonId}>{lessons.find((l) => l.id === lessonId)?.title ?? lessonId}</li>
              ))}
              {item.lesson_ids.length > 4 && <li>… e mais {item.lesson_ids.length - 4}</li>}
            </ol>
            <Link to={`/modulos/${item.id}`}>Abrir módulo</Link>
          </article>
        ))}
      </div>
    </div>
  );
}

function ModulePage({ moduleId, lessons }: { moduleId: number; lessons: Lesson[] }) {
  const navigate = useNavigate();
  const [module, setModule] = useState<Module | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [packageClass, setPackageClass] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    Promise.all([workspace.listModules(), workspace.listClasses()]).then(
      ([modules, allClasses]) => {
        const found = modules.find((item) => item.id === moduleId);
        if (!found) {
          setError('Módulo não encontrado.');
          return;
        }
        setModule(found);
        setTitle(found.title);
        setDescription(found.description);
        setClasses(allClasses);
      },
      (cause) => setError(cause.message)
    );
  }, [moduleId]);

  async function run(action: () => Promise<Module | undefined>, message: string) {
    try {
      const updated = await action();
      if (updated) setModule(updated);
      setError('');
      setStatus(message);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function toggleClass(classId: number, on: boolean) {
    try {
      const detail = await workspace.getClass(classId);
      const next = on ? [...detail.module_ids, moduleId] : detail.module_ids.filter((id) => id !== moduleId);
      await workspace.setClassModules(classId, next);
      setModule((current) => ({
        ...current,
        class_ids: on ? [...current.class_ids, classId] : current.class_ids.filter((id) => id !== classId),
      }));
      setStatus(on ? 'Módulo atribuído à turma.' : 'Módulo removido da turma.');
      setError('');
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function downloadPackage() {
    try {
      const pkg = await bench.package(moduleId, Number(packageClass));
      const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `pacote-modulo-${moduleId}-turma-${packageClass}.json`);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function remove() {
    if (!confirm('Excluir este módulo? As lições e o histórico dos alunos são preservados.')) return;
    try {
      await workspace.deleteModule(moduleId);
      navigate('/modulos');
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <div className="workspace-page">
      <Link to="/modulos">← Todos os módulos</Link>
      {error && (
        <p className="app-error" role="alert">
          {error}
        </p>
      )}
      {status && <p role="status">{status}</p>}
      {!module ? (
        !error && <p>Carregando módulo…</p>
      ) : (
        <>
          <form
            className="panel workspace-form"
            onSubmit={(event) => {
              event.preventDefault();
              void run(() => workspace.updateModule(moduleId, { title, description }), 'Módulo atualizado.');
            }}
          >
            <h2>Módulo</h2>
            <label className="field-label" htmlFor="edit-module-title">
              Título
            </label>
            <input
              id="edit-module-title"
              className="text-input"
              required
              maxLength={255}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <label className="field-label" htmlFor="edit-module-description">
              Descrição
            </label>
            <textarea
              id="edit-module-description"
              className="text-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="workspace-actions">
              <button className="btn-primary" type="submit">
                Salvar módulo
              </button>
              <button className="btn-outline" type="button" onClick={remove}>
                Excluir módulo
              </button>
            </div>
          </form>

          <section className="panel workspace-section">
            <h2>Lições do módulo</h2>
            <p>A bancada apresenta as lições nesta ordem e retoma na primeira que o aluno não concluiu.</p>
            <OrderedPicker
              label="Selecione uma lição"
              empty="Nenhuma lição no módulo."
              value={module.lesson_ids}
              options={lessons.map((lesson) => ({
                id: lesson.id,
                label: lesson.title.trim().endsWith(`(${kindLabel(lesson)})`)
                  ? lesson.title
                  : `${lesson.title} (${kindLabel(lesson)})`,
                href: `/editor/${encodeURIComponent(lesson.id)}`,
              }))}
              onChange={(next) =>
                void run(() => workspace.setModuleLessons(moduleId, next), 'Ordem das lições atualizada.')
              }
            />
          </section>

          <section className="panel workspace-section">
            <h2>Turmas</h2>
            {classes.length === 0 && (
              <p>
                Nenhuma turma ainda. <Link to="/turmas">Criar turma</Link>
              </p>
            )}
            <div className="chip-grid">
              {classes.map((item) => (
                <label className="workspace-checkbox chip" key={item.id}>
                  <input
                    type="checkbox"
                    checked={module.class_ids.includes(item.id)}
                    onChange={(e) => void toggleClass(item.id, e.target.checked)}
                  />
                  {item.name}
                </label>
              ))}
            </div>
          </section>

          <section className="panel workspace-section">
            <h2>Pacote para a bancada</h2>
            <p>
              Este site não se conecta à bancada: ele monta o pacote do módulo para a turma escolhida. O envio à bancada
              é feito pelo aplicativo do professor, no celular, por Bluetooth. Aqui você pode baixar o mesmo pacote
              (JSON) para conferência.
            </p>
            <div className="workspace-actions">
              <select
                className="text-input"
                aria-label="Turma do pacote"
                value={packageClass}
                onChange={(e) => setPackageClass(e.target.value)}
              >
                <option value="">Selecione a turma</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-outline"
                disabled={!packageClass || module.lesson_ids.length === 0}
                onClick={downloadPackage}
              >
                Baixar pacote
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
