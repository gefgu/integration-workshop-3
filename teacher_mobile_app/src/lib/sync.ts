/**
 * Offline-first sync of bench events (SFR44, SFR45, SNFR9).
 *
 * Events pulled from the bench are stored on the phone first. They leave the queue once the server
 * acks them, and the bench deletes them only after that (ACK_EVENTS), so a dropped connection at any
 * point only causes a re-upload, which the server ignores by event_id (SFR59).
 */
import type { BenchEvent, BenchPackage } from '../../../protocol/bench.ts';
import { type Api, type KeyValueStore, OfflineError } from './api.ts';
import type { BenchClient } from './benchClient.ts';

const KEY = 'tedtronics.sync';

interface QueueState {
  /** bench_id → events not yet accepted by the server */
  pending: Record<string, BenchEvent[]>;
  /** bench_id → event ids the server accepted but the bench has not deleted yet */
  confirmed: Record<string, string[]>;
  lastSync: string | null;
  lastError: string | null;
}

const empty = (): QueueState => ({ pending: {}, confirmed: {}, lastSync: null, lastError: null });

export class SyncQueue {
  state: QueueState = empty();

  constructor(private store: KeyValueStore) {}

  async load(): Promise<void> {
    const raw = await this.store.getItem(KEY);
    this.state = raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  }

  private save = () => this.store.setItem(KEY, JSON.stringify(this.state));

  get pendingCount(): number {
    return Object.values(this.state.pending).reduce((n, list) => n + list.length, 0);
  }

  async add(benchId: string, events: BenchEvent[]): Promise<void> {
    const list = this.state.pending[benchId] ?? [];
    const known = new Set([...list.map((e) => e.event_id), ...(this.state.confirmed[benchId] ?? [])]);
    this.state.pending[benchId] = [...list, ...events.filter((e) => !known.has(e.event_id))];
    await this.save();
  }

  /** Uploads every pending event; false (and the queue kept) when the server can't be reached. */
  async flush(api: Api): Promise<boolean> {
    for (const [benchId, events] of Object.entries(this.state.pending)) {
      if (!events.length) continue;
      try {
        const result = await api.sync(benchId, events);
        const done = new Set([...result.acked, ...result.rejected.map((r) => r.event_id)]);
        this.state.pending[benchId] = events.filter((e) => !done.has(e.event_id));
        this.state.confirmed[benchId] = [...(this.state.confirmed[benchId] ?? []), ...done];
        this.state.lastError = result.rejected.length
          ? `${result.rejected.length} evento(s) recusado(s): ${result.rejected[0].reason}`
          : null;
      } catch (error) {
        this.state.lastError =
          error instanceof OfflineError
            ? 'Sem internet: os dados ficam guardados no celular e serão enviados depois.'
            : (error as Error).message;
        await this.save();
        return false;
      }
    }
    this.state.lastSync = new Date().toISOString();
    await this.save();
    return true;
  }

  /** Ids the bench may now delete. */
  confirmedFor(benchId: string): string[] {
    return this.state.confirmed[benchId] ?? [];
  }

  async benchDeleted(benchId: string, ids: string[]): Promise<void> {
    const gone = new Set(ids);
    this.state.confirmed[benchId] = this.confirmedFor(benchId).filter((id) => !gone.has(id));
    await this.save();
  }
}

export interface SyncReport {
  pulled: number;
  uploaded: boolean;
  benchDeleted: number;
}

/** Full cycle with a connected bench: pull → upload → let the bench delete what the server holds. */
export async function syncBench(bench: BenchClient, queue: SyncQueue, api: Api, page = 50): Promise<SyncReport> {
  const benchId = bench.status?.bench_id ?? (await bench.refresh()).bench_id;
  let pulled = 0;
  let after = 0;
  for (;;) {
    const batch = await bench.request<'EVENTS'>({ type: 'PULL_EVENTS', max: page, after_seq: after });
    if (batch.events.length) {
      await queue.add(benchId, batch.events);
      pulled += batch.events.length;
      after = batch.events[batch.events.length - 1].seq;
    }
    if (!batch.remaining || !batch.events.length) break;
  }
  const uploaded = await queue.flush(api);
  let benchDeleted = 0;
  const ids = queue.confirmedFor(benchId);
  if (ids.length) {
    const acked = await bench.request<'ACKED'>({ type: 'ACK_EVENTS', event_ids: ids });
    benchDeleted = acked.deleted;
    await queue.benchDeleted(benchId, ids);
  }
  await bench.refresh();
  return { pulled, uploaded, benchDeleted };
}

/** Downloads the module package for a class and loads it on the bench (SFR43, SFR58). */
export async function sendModule(bench: BenchClient, api: Api, moduleId: number, classId: number): Promise<BenchPackage> {
  const pkg = await api.benchPackage(moduleId, classId);
  await bench.request<'PACKAGE_OK'>({ type: 'LOAD_PACKAGE', package: pkg });
  await bench.refresh();
  return pkg;
}
