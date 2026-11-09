/**
 * Resuming a long BLE send. The bench keeps the frames it already got for a message (FrameAssembler holds
 * partial messages by id, across connections, and the unlock lives in its store), so after a stalled write
 * the phone can reconnect and write the same frame again: nothing already sent is lost or doubled.
 */

export class WriteTimeout extends Error {
  constructor() {
    super('Operation timed out');
  }
}

export interface ResumeOptions {
  /** How long one acknowledged write may take before the link is taken as stalled. */
  writeTimeoutMs: number;
  /** Reconnections allowed per frame. */
  attempts: number;
  /** Told before each reconnection (1-based), so the screen can say "reconectando". */
  onRetry?: (attempt: number) => void;
}

/** `write(cancel)` must stop the pending write when `cancel` is called (react-native-ble-plx cancelTransaction). */
export async function writeWithResume(
  write: (onTimeout: (cancel: () => void) => void) => Promise<void>,
  reconnect: () => Promise<void>,
  { writeTimeoutMs, attempts, onRetry }: ResumeOptions
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await withTimeout(write, writeTimeoutMs);
      return;
    } catch (cause) {
      if (attempt >= attempts) throw cause;
      onRetry?.(attempt + 1);
      // A failed reconnection is not final: the next write fails fast and uses the next attempt.
      await reconnect().catch(() => undefined);
    }
  }
}

async function withTimeout(
  write: (onTimeout: (cancel: () => void) => void) => Promise<void>,
  ms: number
): Promise<void> {
  let cancel: () => void = () => undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      cancel();
      reject(new WriteTimeout());
    }, ms);
  });
  const pending = write((stop) => (cancel = stop));
  pending.catch(() => undefined); // a write cancelled after the timeout rejects late; already reported
  try {
    await Promise.race([pending, expired]);
  } finally {
    clearTimeout(timer);
  }
}
