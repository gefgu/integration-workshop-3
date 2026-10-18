/** Request/response over a frame transport (BLE or the WebSocket simulator); see docs/bench-protocol.md. */
import {
  type AppMessage,
  type BenchMessage,
  type BenchStatus,
  encodeFrames,
  FrameAssembler,
  nextMsgId,
  PROTOCOL_VERSION,
} from '../../../protocol/bench.ts';

/** Moves text frames; implementations: BleTransport (react-native-ble-plx) and SimTransport (WebSocket). */
export interface BenchTransport {
  readonly label: string;
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

  async request<T extends BenchMessage['type']>(message: Outgoing): Promise<Extract<BenchMessage, { type: T }>> {
    const id = nextMsgId('q');
    const reply = new Promise<BenchMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting.delete(id);
        reject(new BenchError('A bancada não respondeu.', 'timeout'));
      }, this.timeoutMs);
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
    for (const frame of encodeFrames({ ...message, id }, nextMsgId('f'))) await this.transport.send(frame);
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
