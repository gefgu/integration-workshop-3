import { api, tokenStore } from './http.ts';

export interface Teacher {
  id: number;
  name: string;
  email: string;
}

interface Session {
  token: string;
  teacher: Teacher;
}

async function start(path: string, body: unknown): Promise<Teacher> {
  const session = await api<Session>(path, 'POST', body);
  tokenStore.set(session.token);
  return session.teacher;
}

export const auth = {
  register: (body: { name: string; email: string; password: string }) => start('/auth/register', body),
  login: (body: { email: string; password: string }) => start('/auth/login', body),
  async logout() {
    try {
      await api<void>('/auth/logout', 'POST');
    } finally {
      tokenStore.clear();
    }
  },
  me: () => api<Teacher>('/auth/me'),
  updateMe: (body: { name: string; email: string; current_password?: string; new_password?: string }) =>
    api<Teacher>('/auth/me', 'PUT', body),
  async deleteMe(password: string) {
    await api<void>('/auth/me', 'DELETE', { password });
    tokenStore.clear();
  },
  hasToken: () => Boolean(tokenStore.get()),
};
