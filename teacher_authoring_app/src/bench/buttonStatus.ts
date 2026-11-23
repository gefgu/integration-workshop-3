import { useEffect, useSyncExternalStore } from 'react';

/**
 * The bench's two push buttons (Energizar, Voltar) as the bench service reports them on ws://<service>/controls/status
 * (and GET /controls/buttons): which are down right now, and whether the Pi's GPIO is usable. The screen draws one
 * dot per button next to the camera status. A press from the ESP32's own buttons lights the dot as well.
 */
export type ButtonName = 'energizar' | 'voltar';
export type GpioState = 'off' | 'ready' | 'error';

export interface ButtonStatus {
  /** false until the service has answered: the dots then show "no signal" instead of a wrong idle. */
  connected: boolean;
  /** off = buttons not configured on the Pi · ready · error = the GPIO is not usable (the service keeps retrying). */
  gpio: GpioState;
  detail: string;
  buttons: Record<ButtonName, boolean>;
}

export const NO_BUTTON_STATUS: ButtonStatus = {
  connected: false,
  gpio: 'off',
  detail: '',
  buttons: { energizar: false, voltar: false },
};

const GPIO_STATES: GpioState[] = ['off', 'ready', 'error'];

/** Reads one message of the status socket; null for anything malformed. */
export function parseButtonStatus(raw: unknown): ButtonStatus | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const data = raw as { gpio?: unknown; detail?: unknown; buttons?: unknown };
  const down = (data.buttons ?? {}) as Record<string, unknown>;
  if (typeof data.buttons !== 'object' || data.buttons === null) return null;
  const gpio = GPIO_STATES.find((state) => state === data.gpio);
  if (!gpio) return null;
  return {
    connected: true,
    gpio,
    detail: typeof data.detail === 'string' ? data.detail : '',
    buttons: { energizar: down.energizar === true, voltar: down.voltar === true },
  };
}

export function statusSocketUrl(base: string): string {
  return `${base.replace(/^http/, 'ws')}/controls/status`;
}

export type DotKind = 'down' | 'idle' | 'unavailable' | 'nosignal';

/** How a dot looks: lit while the button is down, dim when waiting, hollow when the Pi's buttons cannot work. */
export function dotKind(status: ButtonStatus, name: ButtonName): DotKind {
  if (status.buttons[name]) return 'down'; // a press is always shown, whatever its source
  if (!status.connected) return 'nosignal';
  return status.gpio === 'error' ? 'unavailable' : 'idle';
}

export const BUTTON_LABEL: Record<ButtonName, string> = { energizar: 'Energizar', voltar: 'Voltar' };

export function dotTitle(status: ButtonStatus, name: ButtonName): string {
  const label = BUTTON_LABEL[name];
  switch (dotKind(status, name)) {
    case 'down':
      return `${label}: apertado`;
    case 'nosignal':
      return `${label}: sem sinal da bancada`;
    case 'unavailable':
      return `${label}: botões da Pi indisponíveis${status.detail ? ` (${status.detail})` : ''}`;
    default:
      return `${label}: solto`;
  }
}

// One shared state for the whole screen: the socket lives in BenchApp, the dots can be anywhere.
let current = NO_BUTTON_STATUS;
const listeners = new Set<() => void>();

export function setButtonStatus(next: ButtonStatus): void {
  current = next;
  for (const listener of listeners) listener();
}

export function useButtonStatus(): ButtonStatus {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current
  );
}

/** Keeps the status socket open (and reopens it quietly) while the screen is mounted. */
export function useButtonStatusSocket(base: string): void {
  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    const connect = () => {
      socket = new WebSocket(statusSocketUrl(base));
      socket.onmessage = (message) => {
        try {
          const status = parseButtonStatus(JSON.parse(String(message.data)));
          if (status) setButtonStatus(status);
        } catch {
          /* ignore malformed messages */
        }
      };
      socket.onclose = () => {
        setButtonStatus(NO_BUTTON_STATUS);
        if (!closed) retry = setTimeout(connect, 2000);
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      socket?.close();
    };
  }, [base]);
}
