/** Request/response over a frame transport (BLE or the WebSocket simulator); see docs/bench-protocol.md. */
import {
  type AppMessage,
  type BenchMessage,
  type BenchStatus,
  DEFAULT_CHUNK,
  encodeFrames,
  FrameAssembler,
  nextMsgId,
  PROTOCOL_VERSION,
} from '../../../protocol/bench.ts';

/** Moves text frames; implementations: BleTransport (react-native-ble-plx) and SimTransport (WebSocket). */
export interface BenchTransport {
  readonly label: string;
  /** Largest frame (bytes) one write can carry, known after connect(); frames default to DEFAULT_CHUNK. */
  readonly maxFrameBytes?: number;
  /** BLE only: called before the transport reconnects to resume a stalled send (1-based attempt). */
  onRetry?: ((attempt: number) => void) | null;
  /** BLE only: drops and re-opens the link (notifications re-subscribed) without ending the session. */
  reconnect?(): Promise<void>;
  connect(): Promise<void>;
  send(frame: string): Promise<void>;
  onFrame(listener: (frame: string) => void): void;
  onClose(listener: () => void): void;
  close(): Promise<void>;
}

export class BenchError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
  }
}

/** Room for the "msgId|index|total|" header in front of each chunk (msg ids are ~13 chars). */
export const FRAME_HEADER_ROOM = 32;
const MIN_CHUNK = 40;

/** The phone's BLE stack reports write failures in English ("Operation timed out"); say what it means. */
function sendFailure(cause: unknown): string {
  const text = cause instanceof Error ? cause.message : String(cause);
  if (/timed out|timeout/i.test(text)) {
    return 'A bancada parou de confirmar o envio pelo Bluetooth (tempo esgotado). Chegue o celular mais perto, reconecte e tente de novo.';
  }
  if (/disconnect/i.test(text)) return 'Conexão com a bancada perdida durante o envio.';
  return `Falha ao enviar para a bancada: ${text}`;
}

type Distribute<T> = T extends unknown ? Omit<T, 'id'> : never;
type Outgoing = Distribute<AppMessage>;

export class BenchClient {
  private assembler = new FrameAssembler<BenchMessage>();
  private waiting = new Map<string, { resolve: (m: BenchMessage) => void; reject: (e: Error) => void }>();
  status: BenchStatus | null = null;

  constructor(
    readonly transport: BenchTransport,
    private timeoutMs = 10_000
  ) {
    transport.onFrame((frame) => {
      const message = this.assembler.push(frame);
      if (!message) return;
      const re = message.re;
      const pending = re ? this.waiting.get(re) : undefined;
      if (!re || !pending) return;
      this.waiting.delete(re);
      pending.resolve(message);
    });
    transport.onClose(() => {
      for (const pending of this.waiting.values()) pending.reject(new BenchError('Conexão com a bancada perdida.', 'closed'));
      this.waiting.clear();
    });
  }

  /**
   * Payload characters per frame. Never above DEFAULT_CHUNK: frames larger than the link really carries become
   * long (prepared) writes, which bless on the Pi splits into garbage, so the bench silently never completes the
   * message. A smaller negotiated MTU shrinks frames further.
   */
  frameChunk(): number {
    const max = this.transport.maxFrameBytes;
    if (!max) return DEFAULT_CHUNK;
    const chunk = Math.min(DEFAULT_CHUNK, max - FRAME_HEADER_ROOM);
    if (chunk < MIN_CHUNK) throw new BenchError('O Bluetooth deste celular combinou pacotes pequenos demais. Reconecte a bancada.', 'mtu');
    return chunk;
  }

  /** `onFrame(sent, total)` is called after each frame is written, so a long send can show its progress. */
  async request<T extends BenchMessage['type']>(
    message: Outgoing,
    onFrame?: (sent: number, total: number) => void
  ): Promise<Extract<BenchMessage, { type: T }>> {
    const id = nextMsgId('q');
    let timer: ReturnType<typeof setTimeout> | undefined;
    let fail: (e: Error) => void = () => undefined;
    const reply = new Promise<BenchMessage>((resolve, reject) => {
      fail = reject;
      this.waiting.set(id, {
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
    });
    reply.catch(() => undefined); // a rejection while frames are still going out is read by the await below
    let chunk: number;
    try {
      chunk = this.frameChunk();
    } catch (cause) {
      this.waiting.delete(id);
      throw cause;
    }
    try {
      // A module is hundreds of frames over BLE: the reply deadline starts once the last one is written.
      const frames = encodeFrames({ ...message, id }, nextMsgId('f'), chunk);
      for (const [i, frame] of frames.entries()) {
        await this.transport.send(frame);
        onFrame?.(i + 1, frames.length);
      }
    } catch (cause) {
      this.waiting.delete(id);
      throw new BenchError(sendFailure(cause), 'send');
    }
    timer = setTimeout(() => {
      this.waiting.delete(id);
      fail(new BenchError('A bancada não respondeu.', 'timeout'));
    }, this.timeoutMs);
    const answer = await reply;
    if (answer.type === 'ERROR') throw new BenchError(answer.message, answer.code);
    return answer as Extract<BenchMessage, { type: T }>;
  }

  /** Unlocks the bench for this session with the server-signed token (SFR43, SFR57). */
  async hello(token: string): Promise<BenchStatus> {
    const welcome = await this.request<'WELCOME'>({ type: 'HELLO', token, protocol: PROTOCOL_VERSION });
    this.status = welcome;
    return welcome;
  }

  async refresh(): Promise<BenchStatus> {
    this.status = await this.request<'STATUS'>({ type: 'STATUS' });
    return this.status;
  }
}
