import { useState } from 'react';
import { auth } from '../api/auth.ts';
import { useAuth } from './AuthContext.tsx';

export default function Profile() {
  const { teacher, setTeacher } = useAuth();
  const [name, setName] = useState(teacher?.name ?? '');
  const [email, setEmail] = useState(teacher?.email ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  async function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      const updated = await auth.updateMe({
        name,
        email,
        ...(newPassword ? { current_password: currentPassword, new_password: newPassword } : {}),
      });
      setTeacher(updated);
      setCurrentPassword('');
      setNewPassword('');
      setError('');
      setStatus('Perfil atualizado.');
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function remove(event: React.FormEvent) {
    event.preventDefault();
    if (!confirm('Excluir sua conta apaga turmas, alunos, histórico, módulos e lições. Continuar?')) return;
    try {
      await auth.deleteMe(deletePassword);
      setTeacher(null);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <div className="workspace-page">
      <h2>Meu perfil</h2>
      {error && (
        <p className="app-error" role="alert">
          {error}
        </p>
      )}
      {status && <p role="status">{status}</p>}
      <form className="panel workspace-form" onSubmit={save}>
        <label className="field-label" htmlFor="profile-name">
          Nome
        </label>
        <input
          id="profile-name"
          className="text-input"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label className="field-label" htmlFor="profile-email">
          E-mail
        </label>
        <input
          id="profile-email"
          className="text-input"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="field-label" htmlFor="profile-new-password">
          Nova senha (opcional)
        </label>
        <input
          id="profile-new-password"
          className="text-input"
          type="password"
          autoComplete="new-password"
          minLength={6}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        {newPassword && (
          <>
            <label className="field-label" htmlFor="profile-current-password">
              Senha atual
            </label>
            <input
              id="profile-current-password"
              className="text-input"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </>
        )}
        <button className="btn-primary" type="submit">
          Salvar perfil
        </button>
      </form>
      <form className="panel workspace-form" onSubmit={remove}>
        <h3>Excluir conta</h3>
        <p>Remove permanentemente seus dados do servidor.</p>
        <label className="field-label" htmlFor="profile-delete-password">
          Confirme sua senha
        </label>
        <input
          id="profile-delete-password"
          className="text-input"
          type="password"
          required
          value={deletePassword}
          onChange={(e) => setDeletePassword(e.target.value)}
        />
        <button className="btn-outline" type="submit">
          Excluir minha conta
        </button>
      </form>
    </div>
  );
}
