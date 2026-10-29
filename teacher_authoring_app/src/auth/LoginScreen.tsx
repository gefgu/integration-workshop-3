import { useState } from 'react';
import { useAuth } from './AuthContext.tsx';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const signingUp = mode === 'signup';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (signingUp) await signUp(name, email, password);
      else await signIn(email, password);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-screen">
      <form className="login-card panel" onSubmit={handleSubmit}>
        <div className="login-brand">TedTronics</div>
        <h1>{signingUp ? 'Criar conta' : 'Área do professor'}</h1>
        <p>
          {signingUp
            ? 'Cadastre-se para montar módulos, turmas e acompanhar seus alunos.'
            : 'Entre para organizar módulos, turmas e alunos.'}
        </p>
        {signingUp && (
          <>
            <label className="field-label" htmlFor="login-name">
              Nome
            </label>
            <input
              id="login-name"
              className="text-input"
              autoComplete="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </>
        )}
        <label className="field-label" htmlFor="login-email">
          E-mail
        </label>
        <input
          id="login-email"
          className="text-input"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label className="field-label" htmlFor="login-password">
          Senha
        </label>
        <input
          id="login-password"
          className="text-input"
          type="password"
          autoComplete={signingUp ? 'new-password' : 'current-password'}
          minLength={signingUp ? 6 : undefined}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary login-submit" disabled={busy}>
          {busy ? 'Aguarde…' : signingUp ? 'Criar conta' : 'Entrar'}
        </button>
        <small>
          {signingUp ? 'Já tem conta? ' : 'Ainda não tem conta? '}
          <button
            type="button"
            className="pill-link-btn"
            onClick={() => {
              setMode(signingUp ? 'login' : 'signup');
              setError('');
            }}
          >
            {signingUp ? 'Entrar' : 'Criar conta'}
          </button>
        </small>
      </form>
    </main>
  );
}
