import type { BenchTransport } from './benchClient.ts';

/** Bench simulator link: the same frames as BLE, over ws://<bench>:8765/ble (bench/service). */
export class SimTransport implements BenchTransport {
  private socket: WebSocket | null = null;
  private frameListeners: ((frame: string) => void)[] = [];
  private closeListeners: (() => void)[] = [];

  constructor(readonly url: string) {}

  get label(): string {
    return `Simulador (${this.url.replace(/^wss?:\/\//, '').replace(/\/ble$/, '')})`;
  }

  static fromHost(host: string): SimTransport {
    const clean = host.trim().replace(/^(wss?|https?):\/\//, '').replace(/\/.*$/, '');
    return new SimTransport(`ws://${clean.includes(':') ? clean : `${clean}:8765`}/ble`);
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.url);
      let opened = false;
      socket.onopen = () => {
        opened = true;
        this.socket = socket;
        resolve();
      };
      socket.onerror = () => {
        if (!opened) reject(new Error('Não foi possível conectar ao simulador da bancada.'));
      };
      socket.onmessage = (event) => {
        for (const listener of this.frameListeners) listener(String(event.data));
      };
      socket.onclose = () => {
        this.socket = null;
        for (const listener of this.closeListeners) listener();
      };
    });
  }

  async send(frame: string): Promise<void> {
    if (!this.socket) throw new Error('Bancada desconectada.');
    this.socket.send(frame);
  }

  onFrame(listener: (frame: string) => void): void {
    this.frameListeners.push(listener);
  }

  onClose(listener: () => void): void {
    this.closeListeners.push(listener);
  }

  async close(): Promise<void> {
    this.socket?.close();
  }
}
