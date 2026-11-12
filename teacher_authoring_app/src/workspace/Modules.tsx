import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Module, SchoolClass, Student } from '../api/workspace.ts';
import { bench, curriculumApi, workspace } from '../api/workspace.ts';
import { useAuth } from '../auth/AuthContext.tsx';
import Icon from '../components/Icon.tsx';
import { IconButton, TrashButton } from '../components/IconButton.tsx';
import NameDialog from '../components/NameDialog.tsx';
import { syncCurriculum } from '../curriculum/sync.ts';
import { lessonLabel, orderLessons } from '../model/library.ts';
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

function ModuleList({ lessons }: { lessons: Lesson[] }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<Module[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    workspace.listModules().then(setItems, (cause) => setError(cause.message));
  }, []);

  async function create({ name, description }: { name: string; description: string }) {
    try {
      const item = await workspace.createModule({ title: name, description });
      navigate(`/modulos/${item.id}`);
      return true;
    } catch (cause) {
      setError((cause as Error).message);
      return false;
    }
  }

  return (
    <div className="workspace-page">
      <div className="page-head">
        <div>
          <h2>Módulos</h2>
          <p>
            Um módulo é uma trilha de lições em ordem. Atribua módulos às turmas; o aplicativo do professor leva o
            pacote à bancada.
          </p>
        </div>
        <IconButton icon="plus" label="Novo módulo" outline onClick={() => setCreating(true)} />
      </div>
      {error && (
        <p className="app-error" role="alert">
          {error}
        </p>
      )}
      <CurriculumPanel hasAny={items.length > 0} />
      <div className="workspace-cards">
        {items.map((item) => (
          <article className="panel workspace-card" key={item.id}>
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
            <div className="workspace-card-actions">
              <Link className="btn-outline btn-icon" to={`/modulos/${item.id}`}>
                <Icon name="edit" />
                Abrir módulo
              </Link>
            </div>
          </article>
        ))}
      </div>
      {creating && (
        <NameDialog
          title="Novo módulo"
          nameLabel="Título"
          placeholder="Ex.: Primeiros circuitos"
          submitLabel="Criar módulo"
          onSubmit={create}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}

/** Adds the TedTronics curriculum (20 lessons, 5 modules) or brings it up to date; never touches the teacher's own. */
function CurriculumPanel({ hasAny }: { hasAny: boolean }) {
  const { teacher } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function run() {
    setBusy(true);
    try {
      const { lessons: l, modules: m } = await syncCurriculum(curriculumApi, { teacherId: teacher?.id });
      const changed = l.created + l.updated + m.created + m.updated;
      setMessage(
        changed
          ? `Currículo atualizado: ${l.created} lições novas, ${l.updated} atualizadas; ${m.created} módulos novos, ${m.updated} atualizados. Recarregando…`
          : 'O currículo TedTronics já está completo e atualizado na sua conta.'
      );
      if (changed) setTimeout(() => window.location.reload(), 1200);
    } catch (cause) {
      setMessage(`Não foi possível adicionar o currículo: ${(cause as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel workspace-form">
      <h3>Currículo TedTronics</h3>
      <p>
        20 lições (guiadas e desafios) organizadas em 4 trilhas e um módulo com o currículo completo. Suas lições e
        módulos não são alterados.
      </p>
      <button type="button" className={hasAny ? 'btn-outline' : 'btn-primary'} disabled={busy} onClick={run}>
        {busy ? 'Adicionando…' : 'Adicionar ou atualizar o currículo'}
      </button>
      {message && (
        <p className="muted-line" role="status">
          {message}
        </p>
      )}
    </section>
  );
}

function ModulePage({ moduleId, lessons }: { moduleId: number; lessons: Lesson[] }) {
  const navigate = useNavigate();
  const [module, setModule] = useState<Module | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [editing, setEditing] = useState(false);
  const [packageClass, setPackageClass] = useState('');
  const [packageStudents, setPackageStudents] = useState<Student[]>([]);
  const [packageStudent, setPackageStudent] = useState('');

  // The package names the student who will use the bench, so it is picked inside the chosen class.
  useEffect(() => {
    setPackageStudent('');
    setPackageStudents([]);
    if (!packageClass) return;
    workspace.listStudents(Number(packageClass)).then(
      (all) => setPackageStudents(all.filter((s) => s.active)),
      (cause) => setError(cause.message)
    );
  }, [packageClass]);
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
      const pkg = await bench.package(moduleId, Number(packageClass), Number(packageStudent));
      const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `pacote-modulo-${moduleId}-turma-${packageClass}-aluno-${packageStudent}.json`);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function remove() {
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
          <section className="panel item-head">
            <div>
              <h2>{module.title}</h2>
              <p>{module.description || 'Sem descrição'}</p>
              <p className="muted-line">
                {module.lesson_ids.length} {module.lesson_ids.length === 1 ? 'lição' : 'lições'} ·{' '}
                {module.class_ids.length} {module.class_ids.length === 1 ? 'turma' : 'turmas'}
              </p>
            </div>
            <div className="workspace-actions">
              <IconButton icon="edit" label="Editar título e descrição" onClick={() => setEditing(true)} />
              <TrashButton
                label="Excluir módulo"
                confirm="Excluir este módulo? As lições e o histórico dos alunos são preservados."
                onConfirm={() => void remove()}
              />
            </div>
          </section>
          {editing && (
            <NameDialog
              title="Editar módulo"
              nameLabel="Título"
              initial={{ name: module.title, description: module.description }}
              submitLabel="Salvar módulo"
              onSubmit={async ({ name, description }) => {
                await run(() => workspace.updateModule(moduleId, { title: name, description }), 'Módulo salvo.');
                return true;
              }}
              onClose={() => setEditing(false)}
            />
          )}

          <section className="panel workspace-section">
            <h2>Lições do módulo</h2>
            <p>A bancada apresenta as lições nesta ordem. Mudanças aqui são salvas na hora.</p>
            <OrderedPicker
              label="Adicionar lição ao módulo…"
              empty="Nenhuma lição no módulo ainda."
              value={module.lesson_ids}
              options={orderLessons(lessons).map((lesson) => ({
                id: lesson.id,
                label: lessonLabel(lesson),
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
              Este site não se conecta à bancada: ele monta o pacote do módulo para o aluno escolhido (de uma turma), que
              é quem vai usar a bancada. O envio à bancada
              é feito pelo aplicativo do professor, no celular. A transferência com a bancada física ainda precisa de
              teste de ponta a ponta. Aqui você pode baixar o pacote (JSON) para conferência e backup; este arquivo não
              é enviado à bancada por este site. Use o aplicativo do professor para a entrega.
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
              <select
                className="text-input"
                aria-label="Aluno que vai usar a bancada"
                value={packageStudent}
                disabled={!packageClass}
                onChange={(e) => setPackageStudent(e.target.value)}
              >
                <option value="">Selecione o aluno</option>
                {packageStudents.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.nickname})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-outline btn-icon"
                disabled={!packageClass || !packageStudent || module.lesson_ids.length === 0}
                onClick={downloadPackage}
              >
                <Icon name="download" />
                Baixar pacote
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
