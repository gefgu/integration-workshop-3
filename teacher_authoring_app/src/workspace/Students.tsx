import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { SchoolClass, Student, StudentInput, TagEvent } from '../api/workspace.ts';
import { workspace } from '../api/workspace.ts';
import { IconButton, TrashButton } from '../components/IconButton.tsx';
import Modal from '../components/Modal.tsx';

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
          intro="Cadastre alunos e vincule a tag NFC que identifica cada um na bancada."
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
  const [tagFor, setTagFor] = useState<Student | null>(null);
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
    if (ok) setDialog(null);
  }

  function open(item: Student | 'new') {
    setDialog(item);
    if (item === 'new') {
      setForm(emptyStudent);
      setFormClass(classId ?? classes[0]?.id ?? '');
    } else {
      setForm({ name: item.name, nickname: item.nickname, nfc_code: item.nfc_code, active: item.active });
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
              <span className={item.nfc_code ? 'tag-badge' : 'tag-badge none'}>
                {item.nfc_code ? `Tag ${item.nfc_code}` : 'Sem tag'}
              </span>
            </span>
            <div className="workspace-actions student-actions">
              <IconButton icon="chart" label="Desempenho" onClick={() => navigate(`/painel/aluno/${item.id}`)} />
              <IconButton icon="tag" label="Tag NFC" onClick={() => setTagFor(item)} />
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
        <h2 id="tag-dialog-title">Tag NFC</h2>
        <p className="dialog-subtitle">{student.name}</p>
        <p>O progresso fica ligado ao aluno, não à tag: trocar a tag não apaga o histórico.</p>
        {error && (
          <p className="app-error" role="alert">
            {error}
          </p>
        )}
        {student.nfc_code ? (
          <div className="workspace-actions">
            <span className="tag-badge">Tag {student.nfc_code}</span>
            <TrashButton
              label="Desvincular tag"
              confirm={`Desvincular a tag ${student.nfc_code} de ${student.name}?`}
              onConfirm={() => void act(() => workspace.unlinkTag(student.id))}
            />
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
