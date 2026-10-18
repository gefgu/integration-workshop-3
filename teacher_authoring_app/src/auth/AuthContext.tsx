import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { auth, type Teacher } from '../api/auth.ts';
import { UNAUTHORIZED_EVENT } from '../api/http.ts';

interface AuthState {
  /** undefined while the saved token is being checked */
  teacher: Teacher | null | undefined;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setTeacher: (teacher: Teacher | null) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [teacher, setTeacher] = useState<Teacher | null | undefined>(() => (auth.hasToken() ? undefined : null));

  useEffect(() => {
    if (!auth.hasToken()) return;
    auth.me().then(setTeacher, () => setTeacher(null));
  }, []);

  useEffect(() => {
    const expired = () => setTeacher(null);
    globalThis.addEventListener(UNAUTHORIZED_EVENT, expired);
    return () => globalThis.removeEventListener(UNAUTHORIZED_EVENT, expired);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setTeacher(await auth.login({ email, password }));
  }, []);
  const signUp = useCallback(async (name: string, email: string, password: string) => {
    setTeacher(await auth.register({ name, email, password }));
  }, []);
  const signOut = useCallback(async () => {
    await auth.logout().catch(() => undefined);
    setTeacher(null);
  }, []);

  const value = useMemo(() => ({ teacher, signIn, signUp, signOut, setTeacher }), [teacher, signIn, signUp, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth fora de AuthProvider');
  return value;
}
