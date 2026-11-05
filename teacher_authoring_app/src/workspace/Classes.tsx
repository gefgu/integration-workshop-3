import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ClassDetail, Module, SchoolClass } from '../api/workspace.ts';
import { workspace } from '../api/workspace.ts';
import Icon from '../components/Icon.tsx';
import { IconButton, TrashButton } from '../components/IconButton.tsx';
import NameDialog from '../components/NameDialog.tsx';
import { lessonLabel, orderLessons } from '../model/library.ts';
import type { Lesson } from '../model/types.ts';
import OrderedPicker from './OrderedPicker.tsx';
import { StudentManager } from './Students.tsx';

export default function Classes({ lessons }: { lessons: Lesson[] }) {
  const { classId } = useParams();
  return classId ? <ClassPage key={classId} classId={Number(classId)} lessons={lessons} /> : <ClassList />;
}

function ClassList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<SchoolClass[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    workspace.listClasses().then(setItems, (cause) => setError(cause.message));
  }, []);

  async function create({ name, description }: { name: string; description: string }) {
    try {
      const item = await workspace.createClass({ name, description });
      navigate(`/turmas/${item.id}`);
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
          <h2>Turmas</h2>
          <p>Organize alunos e módulos por turma.</p>
        </div>
        <IconButton icon="plus" label="Nova turma" outline onClick={() => setCreating(true)} />
      </div>
      {error && (
        <p className="app-error" role="alert">
          {error}
        </p>
      )}
      {items.length === 0 && !error && (
        <p className="muted-line">Nenhuma turma ainda. Use o + para criar a primeira.</p>
      )}
      <div className="workspace-cards">
        {items.map((item) => (
          <article className="panel workspace-card" key={item.id}>
            <h3>{item.name}</h3>
            <p>{item.description || 'Sem descrição'}</p>
            <p className="muted-line">
              {item.student_count ?? 0} {item.student_count === 1 ? 'aluno' : 'alunos'}
            </p>
            <div className="workspace-card-actions">
              <Link className="btn-outline btn-icon" to={`/turmas/${item.id}`}>
                <Icon name="edit" />
                Abrir turma
              </Link>
              <Link className="btn-outline btn-icon" to={`/painel/${item.id}`}>
                <Icon name="chart" />
                Desempenho
              </Link>
            </div>
          </article>
        ))}
      </div>
      {creating && (
        <NameDialog
          title="Nova turma"
          placeholder="Ex.: 7º ano A"
          submitLabel="Criar turma"
          onSubmit={create}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}

/** A class: its basics in a small header, then the students first, then what the class studies. */
function ClassPage({ classId, lessons }: { classId: number; lessons: Lesson[] }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    Promise.all([workspace.getClass(classId), workspace.listClasses(), workspace.listModules()]).then(
      ([item, allClasses, allModules]) => {
        setDetail(item);
        setClasses(allClasses);
        setModules(allModules);
        setError('');
      },
      (cause) => setError(cause.message)
    );
  }, [classId]);

  async function refresh() {
    setDetail(await workspace.getClass(classId));
  }

  async function run(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      await refresh();
      setError('');
      setStatus(message);
      return true;
    } catch (cause) {
      setError((cause as Error).message);
      return false;
    }
  }

  async function removeClass() {
    try {
      await workspace.deleteClass(classId);
      navigate('/turmas');
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <div className="workspace-page">
      <Link to="/turmas">← Todas as turmas</Link>
      {error && (
        <p className="app-error" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="muted-line">
          {status}
        </p>
      )}
      {!detail ? (
        !error && <p>Carregando turma…</p>
      ) : (
        <>
          <section className="panel item-head">
            <div>
              <h2>Turma {detail.name}</h2>
              {detail.description && <p>{detail.description}</p>}
              <p className="muted-line">
                {detail.students.length} {detail.students.length === 1 ? 'aluno' : 'alunos'} ·{' '}
                {detail.module_ids.length} {detail.module_ids.length === 1 ? 'módulo' : 'módulos'}
              </p>
            </div>
            <div className="workspace-actions">
              <Link className="btn-outline btn-icon" to={`/painel/${classId}`}>
                <Icon name="chart" />
                Desempenho
              </Link>
              <IconButton icon="edit" label="Editar nome e descrição" onClick={() => setEditing(true)} />
              <TrashButton
                label="Excluir turma"
                confirm="Excluir esta turma, seus alunos e o histórico deles? Módulos e lições serão preservados."
                onConfirm={() => void removeClass()}
              />
            </div>
          </section>
          {editing && (
            <NameDialog
              title="Editar turma"
              initial={{ name: detail.name, description: detail.description }}
              submitLabel="Salvar turma"
              onSubmit={({ name, description }) =>
                run(() => workspace.updateClass(classId, { name, description }), 'Turma atualizada.')
              }
              onClose={() => setEditing(false)}
            />
          )}

          <section className="panel workspace-section">
            <StudentManager classes={classes} classId={classId} onChange={() => void refresh()} />
          </section>

          <div className="class-study">
            <section className="panel workspace-section">
              <h2>Módulos da turma</h2>
              <p className="muted-line">
                O que a turma estuda e o que conta no progresso. <Link to="/modulos">Gerenciar módulos</Link>
              </p>
              <OrderedPicker
                label="Adicionar módulo à turma…"
                empty="Nenhum módulo atribuído."
                value={detail.module_ids}
                options={modules.map((item) => ({ id: item.id, label: item.title, href: `/modulos/${item.id}` }))}
                onChange={(next) => void run(() => workspace.setClassModules(classId, next), 'Módulos atualizados.')}
              />
            </section>

            <section className="panel workspace-section">
              <h2>Lições avulsas</h2>
              <p className="muted-line">Lições fora de um módulo que também contam no progresso da turma.</p>
              <OrderedPicker
                label="Adicionar lição avulsa…"
                empty="Nenhuma lição avulsa."
                value={detail.lesson_ids}
                options={orderLessons(lessons).map((item) => ({
                  id: item.id,
                  label: lessonLabel(item),
                  href: `/editor/${encodeURIComponent(item.id)}`,
                }))}
                onChange={(next) => void run(() => workspace.setClassLessons(classId, next), 'Lições atualizadas.')}
              />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
