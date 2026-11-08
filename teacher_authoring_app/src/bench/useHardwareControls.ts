import { useEffect } from 'react';

/**
 * Physical controls → key presses. The ESP32 (joystick + Energizar) talks to the bench service over the Pi's
 * serial port; the service pushes `{seq, key}` on ws://<service>/controls. Each key is replayed as the same
 * keydown the screen already handles: arrows move the focus, Enter presses the focused control, Escape is
 * Voltar and "e" is Energizar (see docs/bench-protocol.md, "Physical controls").
 */
export function pressKey(key: string, doc: Document = document): void {
  // Sent to the page, not to whatever has focus: the tag field keeps the focus for the NFC reader, and the
  // joystick must still drive the screen (pad.ts) instead of typing into it.
  const target = doc.body;
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
}

export function controlsSocketUrl(base: string): string {
  return `${base.replace(/^http/, 'ws')}/controls`;
}

export function useHardwareControls(base: string): void {
  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    const connect = () => {
      socket = new WebSocket(controlsSocketUrl(base));
      socket.onmessage = (message) => {
        try {
          const { key } = JSON.parse(String(message.data)) as { key?: string };
          if (key) pressKey(key);
        } catch {
          /* ignore malformed messages */
        }
      };
      // The service restarts or is not up yet: try again quietly.
      socket.onclose = () => {
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
