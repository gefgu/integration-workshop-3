import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ClassDetail, Module, SchoolClass } from '../api/workspace.ts';
import { workspace } from '../api/workspace.ts';
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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    workspace.listClasses().then(setItems, (cause) => setError(cause.message));
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    try {
      const item = await workspace.createClass({ name, description });
      setItems((current) => [...current, item]);
      setError('');
      navigate(`/turmas/${item.id}`);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <div className="workspace-page">
      <h2>Turmas</h2>
      <p>Organize alunos e módulos por turma.</p>
      {error && (
        <p className="app-error" role="alert">
          {error}
        </p>
      )}
      <form className="panel workspace-form" onSubmit={create}>
        <h3>Nova turma</h3>
        <label className="field-label" htmlFor="class-name">
          Nome
        </label>
        <input
          id="class-name"
          className="text-input"
          required
          maxLength={255}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: 7º ano A"
        />
        <label className="field-label" htmlFor="class-description">
          Descrição
        </label>
        <textarea
          id="class-description"
          className="text-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button className="btn-primary" type="submit">
          Criar turma
        </button>
      </form>
      <div className="workspace-cards">
        {items.map((item) => (
          <article className="panel" key={item.id}>
            <h3>{item.name}</h3>
            <p>{item.description || 'Sem descrição'}</p>
            <p className="muted-line">
              {item.student_count ?? 0} {item.student_count === 1 ? 'aluno' : 'alunos'}
            </p>
            <div className="workspace-actions">
              <Link to={`/turmas/${item.id}`}>Abrir turma</Link>
              <Link to={`/painel/${item.id}`}>Ver desempenho</Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ClassPage({ classId, lessons }: { classId: number; lessons: Lesson[] }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    Promise.all([workspace.getClass(classId), workspace.listClasses(), workspace.listModules()]).then(
      ([item, allClasses, allModules]) => {
        setDetail(item);
        setName(item.name);
        setDescription(item.description);
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
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function saveClass(event: React.FormEvent) {
    event.preventDefault();
    await run(() => workspace.updateClass(classId, { name, description }), 'Turma atualizada.');
  }

  async function removeClass() {
    if (!confirm('Excluir esta turma, seus alunos e o histórico deles? Módulos e lições serão preservados.')) return;
    try {
      await workspace.deleteClass(classId);
      navigate('/turmas');
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <div className="workspace-page">
      <div className="workspace-actions">
        <Link to="/turmas">← Todas as turmas</Link>
        <Link to={`/painel/${classId}`}>Ver desempenho da turma →</Link>
      </div>
      {error && (
        <p className="app-error" role="alert">
          {error}
        </p>
      )}
      {status && <p role="status">{status}</p>}
      {!detail ? (
        !error && <p>Carregando turma…</p>
      ) : (
        <>
          <form className="panel workspace-form" onSubmit={saveClass}>
            <h2>Turma {detail.name}</h2>
            <label className="field-label" htmlFor="edit-class-name">
              Nome
            </label>
            <input
              id="edit-class-name"
              className="text-input"
              required
              maxLength={255}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <label className="field-label" htmlFor="edit-class-description">
              Descrição
            </label>
            <textarea
              id="edit-class-description"
              className="text-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="workspace-actions">
              <button className="btn-primary" type="submit">
                Salvar turma
              </button>
              <button className="btn-outline" type="button" onClick={removeClass}>
                Excluir turma
              </button>
            </div>
          </form>

          <section className="panel workspace-section">
            <h2>Módulos da turma</h2>
            <p>
              Os módulos definem o que a turma estuda e o que conta no progresso.{' '}
              <Link to="/modulos">Gerenciar módulos</Link>
            </p>
            <OrderedPicker
              label="Selecione um módulo"
              empty="Nenhum módulo atribuído."
              value={detail.module_ids}
              options={modules.map((item) => ({ id: item.id, label: item.title, href: `/modulos/${item.id}` }))}
              onChange={(next) => void run(() => workspace.setClassModules(classId, next), 'Módulos atualizados.')}
            />
          </section>

          <section className="panel workspace-section">
            <h2>Lições avulsas</h2>
            <p>Lições fora de um módulo que também contam no progresso da turma.</p>
            <OrderedPicker
              label="Selecione uma lição"
              empty="Nenhuma lição avulsa."
              value={detail.lesson_ids}
              options={lessons.map((item) => ({
                id: item.id,
                label: item.title,
                href: `/editor/${encodeURIComponent(item.id)}`,
              }))}
              onChange={(next) => void run(() => workspace.setClassLessons(classId, next), 'Lições atualizadas.')}
            />
          </section>

          <section className="panel workspace-section">
            <h2>Alunos ({detail.students.length})</h2>
            <StudentManager classes={classes} classId={classId} onChange={() => void refresh()} />
          </section>
        </>
      )}
    </div>
  );
}
