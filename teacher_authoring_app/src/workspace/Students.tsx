import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { SchoolClass, Student, StudentInput, TagEvent } from '../api/workspace.ts';
import { workspace } from '../api/workspace.ts';

const emptyStudent: StudentInput = { name: '', nickname: '', nfc_code: null, active: true };

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
      <h2>Alunos</h2>
      <p>Cadastre alunos e vincule a tag NFC que identifica cada um na bancada.</p>
      {error && (
        <p className="app-error" role="alert">
          {error}
        </p>
      )}
      <div className="workspace-actions">
        <select
          className="text-input"
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
      </div>
      {classes.length === 0 ? (
        <p>
          Crie uma turma antes de cadastrar alunos. <Link to="/turmas">Ir para turmas</Link>
        </p>
      ) : (
        <StudentManager key={classId ?? 'all'} classes={classes} classId={classId} />
      )}
    </div>
  );
}

export function StudentManager({
  classes,
  classId,
  onChange,
}: {
  classes: SchoolClass[];
  classId?: number;
  onChange?: () => void;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [form, setForm] = useState<StudentInput>(emptyStudent);
  const [formClass, setFormClass] = useState<number | ''>(classId ?? classes[0]?.id ?? '');
  const [editing, setEditing] = useState<Student | null>(null);
  const [tagFor, setTagFor] = useState<Student | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

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
          await workspace.updateStudent(editing.id, {
            ...form,
            nfc_code: editing.nfc_code,
            class_id: Number(formClass),
          });
        } else {
          await workspace.createStudent(Number(formClass), form);
        }
      },
      editing ? 'Aluno atualizado.' : 'Aluno cadastrado.'
    );
    if (ok) cancel();
  }

  function edit(item: Student) {
    setEditing(item);
    setForm({ name: item.name, nickname: item.nickname, nfc_code: item.nfc_code, active: item.active });
    setFormClass(item.class_id);
  }

  function cancel() {
    setEditing(null);
    setForm(emptyStudent);
    setFormClass(classId ?? classes[0]?.id ?? '');
  }

  const className = (id: number) => classes.find((item) => item.id === id)?.name ?? `Turma ${id}`;

  return (
    <>
      {error && (
        <p className="app-error" role="alert">
          {error}
        </p>
      )}
      {status && <p role="status">{status}</p>}
      <form className="panel workspace-form" onSubmit={save}>
        <h3>{editing ? `Editar ${editing.name}` : 'Novo aluno'}</h3>
        <label className="field-label" htmlFor="student-name">
          Nome
        </label>
        <input
          id="student-name"
          className="text-input"
          required
          maxLength={255}
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
        {!editing && (
          <>
            <label className="field-label" htmlFor="student-nfc">
              Tag NFC (opcional)
            </label>
            <input
              id="student-nfc"
              className="text-input"
              maxLength={255}
              placeholder="Código lido da tag"
              value={form.nfc_code ?? ''}
              onChange={(e) => setForm({ ...form, nfc_code: e.target.value || null })}
            />
          </>
        )}
        <label className="workspace-checkbox">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Ativo (alunos inativos não vão para a bancada)
        </label>
        <div className="workspace-actions">
          <button className="btn-primary" type="submit">
            {editing ? 'Salvar aluno' : 'Cadastrar aluno'}
          </button>
          {editing && (
            <button className="btn-outline" type="button" onClick={cancel}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      {students.length === 0 && <p>Nenhum aluno cadastrado.</p>}
      <ul className="workspace-list student-list">
        {students.map((item) => (
          <li key={item.id}>
            <span>
              <strong>{item.name}</strong> ({item.nickname})
              {classId == null && <> · {item.class_name ?? className(item.class_id)}</>}
              {!item.active && <> · Inativo</>}
              <br />
              <span className={item.nfc_code ? 'tag-badge' : 'tag-badge none'}>
                {item.nfc_code ? `Tag ${item.nfc_code}` : 'Sem tag'}
              </span>
            </span>
            <div className="workspace-actions">
              <Link className="btn-outline" to={`/painel/aluno/${item.id}`}>
                Desempenho
              </Link>
              <button type="button" className="btn-outline" onClick={() => setTagFor(item)}>
                Tag NFC
              </button>
              <button type="button" className="btn-outline" onClick={() => edit(item)}>
                Editar
              </button>
              <button
                type="button"
                className="pill-link-btn"
                onClick={() => {
                  if (confirm(`Excluir ${item.name}? O histórico deste aluno também será apagado.`))
                    void run(() => workspace.deleteStudent(item.id), 'Aluno excluído.');
                }}
              >
                Excluir
              </button>
            </div>
          </li>
        ))}
      </ul>
      {tagFor && (
        <TagDialog
          student={tagFor}
          onClose={() => setTagFor(null)}
          onChanged={(updated) => {
            setTagFor(updated);
            void refresh();
            onChange?.();
          }}
        />
      )}
    </>
  );
}

/** Link / unlink a student's NFC tag (SFR30.1, SFR32, SFR33) and show the audit log (SFR34). */
function TagDialog({
  student,
  onClose,
  onChanged,
}: {
  student: Student;
  onClose: () => void;
  onChanged: (student: Student) => void;
}) {
  const [code, setCode] = useState('');
  const [history, setHistory] = useState<TagEvent[]>([]);
  const [error, setError] = useState('');

  // Reloads after every link/unlink: `student` is replaced by the updated row.
  useEffect(() => {
    workspace.tagHistory(student.id).then(setHistory, (cause) => setError(cause.message));
  }, [student]);

  async function act(action: () => Promise<Student>) {
    try {
      onChanged(await action());
      setCode('');
      setError('');
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="tag-dialog-title">
      <div className="modal-card tag-dialog">
        <h2 id="tag-dialog-title">Tag NFC de {student.name}</h2>
        <p>O progresso fica ligado ao aluno, não à tag: trocar a tag não apaga o histórico.</p>
        {error && (
          <p className="app-error" role="alert">
            {error}
          </p>
        )}
        {student.nfc_code ? (
          <div className="workspace-actions">
            <span className="tag-badge">Tag {student.nfc_code}</span>
            <button
              type="button"
              className="btn-outline"
              onClick={() => {
                if (confirm(`Desvincular a tag ${student.nfc_code} de ${student.name}?`))
                  void act(() => workspace.unlinkTag(student.id));
              }}
            >
              Desvincular
            </button>
          </div>
        ) : (
          <form
            className="workspace-actions"
            onSubmit={(event) => {
              event.preventDefault();
              void act(() => workspace.linkTag(student.id, code));
            }}
          >
            <input
              className="text-input tag-input"
              aria-label="Código da nova tag"
              placeholder="Código da nova tag"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button className="btn-primary" type="submit">
              Vincular
            </button>
          </form>
        )}
        <h3>Histórico</h3>
        {history.length === 0 ? (
          <p>Nenhuma alteração registrada.</p>
        ) : (
          <ul className="workspace-list">
            {history.map((item) => (
              <li key={`${item.at}-${item.action}-${item.nfc_code}`}>
                <span>
                  {item.action === 'link' ? 'Vinculou' : 'Desvinculou'} a tag {item.nfc_code}
                </span>
                <time dateTime={item.at}>{new Date(item.at).toLocaleString('pt-BR')}</time>
              </li>
            ))}
          </ul>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-outline" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
