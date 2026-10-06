import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ClassDetail, SchoolClass, Student, StudentInput } from '../api/workspace.ts';
import { workspace } from '../api/workspace.ts';
import type { Lesson } from '../model/types.ts';

const emptyStudent: StudentInput = { name: '', nickname: '', nfc_code: null, active: true };

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
      <p>Organize alunos e lições por turma.</p>
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
            <Link to={`/turmas/${item.id}`}>Abrir turma</Link>
          </article>
        ))}
      </div>
    </div>
  );
}

function ClassPage({ classId, lessons }: { classId: number; lessons: Lesson[] }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [student, setStudent] = useState<StudentInput>(emptyStudent);
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
  const [selectedLesson, setSelectedLesson] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    workspace.getClass(classId).then(
      (item) => {
        setDetail(item);
        setName(item.name);
        setDescription(item.description);
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
    if (!confirm('Excluir esta turma e seus alunos? As lições serão preservadas.')) return;
    try {
      await workspace.deleteClass(classId);
      navigate('/turmas');
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function saveStudent(event: React.FormEvent) {
    event.preventDefault();
    await run(
      async () => {
        if (editingStudentId == null) await workspace.createStudent(classId, student);
        else await workspace.updateStudent(editingStudentId, student);
        setStudent(emptyStudent);
        setEditingStudentId(null);
      },
      editingStudentId == null ? 'Aluno criado. Veja o ID na lista.' : 'Aluno atualizado.'
    );
  }

  function editStudent(item: Student) {
    setEditingStudentId(item.id);
    setStudent({ name: item.name, nickname: item.nickname, nfc_code: item.nfc_code, active: item.active });
  }

  function setOrder(next: string[]) {
    return run(() => workspace.setClassLessons(classId, next), 'Lições da turma atualizadas.');
  }

  const ordered = detail?.lesson_ids ?? [];
  const available = lessons.filter((item) => !ordered.includes(item.id));

  return (
    <div className="workspace-page">
      <Link to="/turmas">← Todas as turmas</Link>
      {error && (
        <p className="app-error" role="alert">
          {error}
        </p>
      )}
      {status && <p role="status">{status}</p>}
      {!detail ? (
        <p>Carregando turma…</p>
      ) : (
        <>
          <form className="panel workspace-form" onSubmit={saveClass}>
            <h2>Turma #{detail.id}</h2>
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
            <h2>Lições da turma</h2>
            <p>Uma lição pode ser usada em várias turmas.</p>
            <div className="workspace-actions">
              <select
                className="text-input"
                aria-label="Lição para adicionar"
                value={selectedLesson}
                onChange={(e) => setSelectedLesson(e.target.value)}
              >
                <option value="">Selecione uma lição</option>
                {available.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-primary"
                disabled={!selectedLesson}
                onClick={() => {
                  void setOrder([...ordered, selectedLesson]);
                  setSelectedLesson('');
                }}
              >
                Adicionar
              </button>
            </div>
            {ordered.length === 0 && <p>Nenhuma lição atribuída.</p>}
            <ol className="workspace-list">
              {ordered.map((id, index) => {
                const found = lessons.find((item) => item.id === id);
                return (
                  <li key={id}>
                    <Link to={`/editor/${encodeURIComponent(id)}`}>{found?.title ?? `Lição ${id}`}</Link>
                    <div className="workspace-actions">
                      <button
                        type="button"
                        className="btn-outline"
                        disabled={index === 0}
                        aria-label={`Mover ${found?.title} para cima`}
                        onClick={() => {
                          const next = [...ordered];
                          [next[index - 1], next[index]] = [next[index], next[index - 1]];
                          void setOrder(next);
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn-outline"
                        disabled={index === ordered.length - 1}
                        aria-label={`Mover ${found?.title} para baixo`}
                        onClick={() => {
                          const next = [...ordered];
                          [next[index + 1], next[index]] = [next[index], next[index + 1]];
                          void setOrder(next);
                        }}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="pill-link-btn"
                        onClick={() => void setOrder(ordered.filter((lessonId) => lessonId !== id))}
                      >
                        Remover
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="panel workspace-section">
            <h2>Alunos</h2>
            <form className="workspace-form" onSubmit={saveStudent}>
              <h3>{editingStudentId == null ? 'Novo aluno' : `Editar aluno #${editingStudentId}`}</h3>
              <label className="field-label" htmlFor="student-name">
                Nome
              </label>
              <input
                id="student-name"
                className="text-input"
                required
                maxLength={255}
                value={student.name}
                onChange={(e) => setStudent({ ...student, name: e.target.value })}
              />
              <label className="field-label" htmlFor="student-nickname">
                Apelido
              </label>
              <input
                id="student-nickname"
                className="text-input"
                required
                maxLength={255}
                value={student.nickname}
                onChange={(e) => setStudent({ ...student, nickname: e.target.value })}
              />
              <label className="field-label" htmlFor="student-nfc">
                Código NFC (opcional)
              </label>
              <input
                id="student-nfc"
                className="text-input"
                maxLength={255}
                value={student.nfc_code ?? ''}
                onChange={(e) => setStudent({ ...student, nfc_code: e.target.value || null })}
              />
              <label className="workspace-checkbox">
                <input
                  type="checkbox"
                  checked={student.active}
                  onChange={(e) => setStudent({ ...student, active: e.target.checked })}
                />{' '}
                Ativo
              </label>
              <div className="workspace-actions">
                <button className="btn-primary" type="submit">
                  {editingStudentId == null ? 'Criar aluno' : 'Salvar aluno'}
                </button>
                {editingStudentId != null && (
                  <button
                    className="btn-outline"
                    type="button"
                    onClick={() => {
                      setStudent(emptyStudent);
                      setEditingStudentId(null);
                    }}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
            {detail.students.length === 0 && <p>Nenhum aluno cadastrado.</p>}
            <ul className="workspace-list">
              {detail.students.map((item) => (
                <li key={item.id}>
                  <span>
                    <strong>#{item.id}</strong> {item.name} ({item.nickname}) · {item.active ? 'Ativo' : 'Inativo'}
                    {item.nfc_code ? ` · NFC ${item.nfc_code}` : ''}
                  </span>
                  <div className="workspace-actions">
                    <button type="button" className="btn-outline" onClick={() => editStudent(item)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className="pill-link-btn"
                      onClick={() => {
                        if (confirm(`Excluir ${item.name}?`))
                          void run(() => workspace.deleteStudent(item.id), 'Aluno excluído.');
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
