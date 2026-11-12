import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { SchoolClass, Student, StudentInput } from '../api/workspace.ts';
import { shortUid, workspace } from '../api/workspace.ts';
import { IconButton, TrashButton } from '../components/IconButton.tsx';
import Modal from '../components/Modal.tsx';

const emptyStudent: StudentInput = { name: '', nickname: '', active: true };

/** Every student of the teacher, filterable by class (?turma=ID). */
export default function Students() {
  const [params, setParams] = useSearchParams();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [error, setError] = useState('');
  const classId = params.get('turma') ? Number(params.get('turma')) : undefined;

  useEffect(() => {
    workspace.listClasses().then(setClasses, (cause) => setError(cause.message));
  }, []);

  return (
    <div className="workspace-page">
      {error && (
        <p className="app-error" role="alert">
          {error}
        </p>
      )}
      {classes.length === 0 ? (
        <>
          <h2>Alunos</h2>
          <p>
            Crie uma turma antes de cadastrar alunos. <Link to="/turmas">Ir para turmas</Link>
          </p>
        </>
      ) : (
        <StudentManager
          key={classId ?? 'all'}
          classes={classes}
          classId={classId}
          intro="Cadastre os alunos. Cada um recebe um ID único; no app, você escolhe qual aluno usa cada bancada."
          tools={
            <select
              className="select-pill"
              aria-label="Filtrar por turma"
              value={classId ?? ''}
              onChange={(e) => setParams(e.target.value ? { turma: e.target.value } : {})}
            >
              <option value="">Todas as turmas</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          }
        />
      )}
    </div>
  );
}

/** The student list of a class (or of every class) with a "+" to add one; create and edit open in a dialog. */
export function StudentManager({
  classes,
  classId,
  onChange,
  intro,
  tools,
}: {
  classes: SchoolClass[];
  classId?: number;
  onChange?: () => void;
  /** a line under the heading */
  intro?: string;
  /** extra controls beside the "+" (e.g. the class filter) */
  tools?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [form, setForm] = useState<StudentInput>(emptyStudent);
  const [formClass, setFormClass] = useState<number | ''>(classId ?? classes[0]?.id ?? '');
  const [dialog, setDialog] = useState<'new' | Student | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const editing = dialog && dialog !== 'new' ? dialog : null;

  const refresh = useCallback(
    () => workspace.listStudents(classId).then(setStudents, (cause) => setError(cause.message)),
    [classId]
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      await refresh();
      onChange?.();
      setError('');
      setStatus(message);
      return true;
    } catch (cause) {
      setError((cause as Error).message);
      return false;
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const ok = await run(
      async () => {
        if (editing) {
          await workspace.updateStudent(editing.id, { ...form, class_id: Number(formClass) });
        } else {
          await workspace.createStudent(Number(formClass), form);
        }
      },
      editing ? 'Aluno atualizado.' : 'Aluno cadastrado.'
    );
    if (ok) setDialog(null);
  }

  function open(item: Student | 'new') {
    setDialog(item);
    if (item === 'new') {
      setForm(emptyStudent);
      setFormClass(classId ?? classes[0]?.id ?? '');
    } else {
      setForm({ name: item.name, nickname: item.nickname, active: item.active });
      setFormClass(item.class_id);
    }
  }

  const className = (id: number) => classes.find((item) => item.id === id)?.name ?? `Turma ${id}`;

  return (
    <>
      <div className="page-head section-head">
        <div>
          <h2>Alunos ({students.length})</h2>
          {intro && <p>{intro}</p>}
        </div>
        <div className="workspace-actions">
          {tools}
          <IconButton icon="plus" label="Novo aluno" outline onClick={() => open('new')} />
        </div>
      </div>
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
      {students.length === 0 && <p className="muted-line">Nenhum aluno cadastrado. Use o + para adicionar.</p>}
      <ul className="workspace-list student-list">
        {students.map((item) => (
          <li key={item.id}>
            <span>
              <strong>{item.name}</strong> ({item.nickname})
              {classId == null && <> · {item.class_name ?? className(item.class_id)}</>}
              {!item.active && <> · Inativo</>}
              <br />
              <span className="id-badge" title={`ID do aluno: ${item.uid}`}>
                ID {shortUid(item.uid)}
              </span>
            </span>
            <div className="workspace-actions student-actions">
              <IconButton icon="chart" label="Desempenho" onClick={() => navigate(`/painel/aluno/${item.id}`)} />
              <IconButton icon="edit" label="Editar" onClick={() => open(item)} />
              <TrashButton
                confirm={`Excluir ${item.name}? O histórico deste aluno também será apagado.`}
                onConfirm={() => void run(() => workspace.deleteStudent(item.id), 'Aluno excluído.')}
              />
            </div>
          </li>
        ))}
      </ul>
      {dialog && (
        <Modal title={editing ? `Editar ${editing.name}` : 'Novo aluno'} onClose={() => setDialog(null)}>
          <form className="workspace-form modal-form" onSubmit={save}>
            <label className="field-label" htmlFor="student-name">
              Nome
            </label>
            <input
              id="student-name"
              className="text-input"
              required
              maxLength={255}
              // biome-ignore lint/a11y/noAutofocus: the dialog opens to type the name
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <label className="field-label" htmlFor="student-nickname">
              Apelido (aparece na bancada e no ranking)
            </label>
            <input
              id="student-nickname"
              className="text-input"
              required
              maxLength={255}
              value={form.nickname}
              onChange={(e) => setForm({ ...form, nickname: e.target.value })}
            />
            {(classId == null || editing) && (
              <>
                <label className="field-label" htmlFor="student-class">
                  Turma
                </label>
                <select
                  id="student-class"
                  className="text-input"
                  required
                  value={formClass}
                  onChange={(e) => setFormClass(Number(e.target.value))}
                >
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            {editing && (
              <p className="muted-line">
                ID do aluno: <code>{editing.uid}</code> (gerado pelo sistema, não muda)
              </p>
            )}
            <label className="workspace-checkbox">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Ativo (alunos inativos não vão para a bancada)
            </label>
            <div className="modal-actions">
              <button className="btn-primary" type="submit">
                {editing ? 'Salvar aluno' : 'Cadastrar aluno'}
              </button>
              <button className="btn-outline" type="button" onClick={() => setDialog(null)}>
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
