/** fetch wrapper for the teacher API: bearer token, pt-BR errors, and a sign-out signal on 401. */

const TOKEN_KEY = 'tedtronics-token';
export const UNAUTHORIZED_EVENT = 'tedtronics:unauthorized';

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export const tokenStore = {
  get: (): string | null => storage()?.getItem(TOKEN_KEY) ?? null,
  set: (token: string) => storage()?.setItem(TOKEN_KEY, token),
  clear: () => storage()?.removeItem(TOKEN_KEY),
};

export function authHeaders(): Record<string, string> {
  const token = tokenStore.get();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** FastAPI sends `detail` as a string (our errors) or as a list (request validation). */
export function errorMessage(status: number, detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length) {
    return detail
      .map((item) => String(item?.msg ?? '').replace(/^Value error, /, ''))
      .filter(Boolean)
      .join(' ');
  }
  if (status === 401) return 'Faça login para continuar.';
  if (status >= 500) return 'Servidor indisponível. Confira a API e o banco de dados.';
  return 'Não foi possível concluir a operação.';
}

export async function api<T>(path: string, method = 'GET', body?: unknown, fetchImpl: Fetch = fetch): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(`/api${path}`, {
      method,
      headers: {
        ...authHeaders(),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Confira se a API está ativa.');
  }
  if (response.ok) return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
  let detail: unknown;
  try {
    detail = (await response.json()).detail;
  } catch {
    // The proxy may return HTML while the API is offline.
  }
  if (response.status === 401 && !path.startsWith('/auth/login')) {
    tokenStore.clear();
    globalThis.dispatchEvent?.(new Event(UNAUTHORIZED_EVENT));
  }
  throw new Error(errorMessage(response.status, detail));
}

export async function apiBlob(path: string): Promise<Blob> {
  const response = await fetch(`/api${path}`, { headers: authHeaders() }).catch(() => null);
  if (!response?.ok) throw new Error('Não foi possível baixar o arquivo.');
  return response.blob();
}
