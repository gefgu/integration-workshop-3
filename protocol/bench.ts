/**
 * TedTronics teacher-app ⇄ bench protocol (see docs/bench-protocol.md).
 *
 * Shared, dependency-free TypeScript: imported by the teacher phone app, the bench UI and the tests.
 * The Python bench service (bench/service/protocol.py) mirrors the framing and message types.
 */

/** GATT service and characteristics the bench advertises. */
export const BENCH_BLE = {
  service: '7e1d0001-7ed7-4b1c-9a6e-0c1e5f7a0000',
  /** app → bench, write with response */
  rx: '7e1d0002-7ed7-4b1c-9a6e-0c1e5f7a0000',
  /** bench → app, notify */
  tx: '7e1d0003-7ed7-4b1c-9a6e-0c1e5f7a0000',
  /** Advertised local name prefix, followed by the bench id. */
  namePrefix: 'TedTronics-',
} as const;

export const PROTOCOL_VERSION = 1;
/** Payload characters per frame; fits a 185-byte ATT MTU with the header. */
export const DEFAULT_CHUNK = 150;

export interface BenchStudent {
  id: number;
  name: string;
  nickname: string;
  nfc_code: string;
}

/** What GET /bench/package/{module}?class_id= returns, carried as is to the bench. */
export interface BenchPackage {
  format: number;
  version_id: string;
  created_at: string;
  teacher: { id: number; name: string };
  module: { id: number; title: string; description: string; lesson_ids: string[] };
  class: { id: number; name: string };
  // biome-ignore lint/suspicious/noExplicitAny: lesson documents are the teacher app's Lesson (v3) + lessonVersion
  lessons: any[];
  students: BenchStudent[];
}

export type BenchEventKind = 'session' | 'step_done' | 'lesson_done' | 'quiz_answer' | 'challenge_score';

/** One stored bench event (SFR56). event_id is unique, so the server ignores re-uploads (SFR59). */
export interface BenchEvent {
  event_id: string;
  student_id: number;
  nfc_code: string;
  kind: BenchEventKind;
  seq: number;
  at: string;
  lesson_id?: string | null;
  module_id?: number | null;
  lesson_version?: string | null;
  step_idx?: number | null;
  score?: number | null;
  duration_s?: number | null;
}

export type AppMessage =
  | { type: 'HELLO'; id: string; token: string; protocol: number }
  | { type: 'STATUS'; id: string }
  | { type: 'LOAD_PACKAGE'; id: string; package: BenchPackage }
  | { type: 'PULL_EVENTS'; id: string; max: number; after_seq?: number }
  | { type: 'ACK_EVENTS'; id: string; event_ids: string[] };

export interface BenchStatus {
  bench_id: string;
  unlocked: boolean;
  teacher: { id: number; name: string } | null;
  package: { version_id: string; module_title: string; class_name: string } | null;
  pending_events: number;
}

export type BenchMessage =
  | ({ type: 'WELCOME'; re: string } & BenchStatus)
  | ({ type: 'STATUS'; re: string } & BenchStatus)
  | { type: 'PACKAGE_OK'; re: string; version_id: string }
  | { type: 'EVENTS'; re: string; events: BenchEvent[]; remaining: number }
  | { type: 'ACKED'; re: string; deleted: number; pending_events: number }
  | { type: 'ERROR'; re: string | null; code: BenchErrorCode; message: string };

export type BenchErrorCode = 'locked' | 'bad_token' | 'bad_message' | 'bad_package' | 'busy';

/**
 * A frame is `msgId|index|total|payload`, payload being a slice of the message's ASCII JSON.
 * Both sides reassemble by msgId, so frames from two messages may interleave.
 */
export function encodeFrames(message: object, msgId: string, chunk = DEFAULT_CHUNK): string[] {
  if (msgId.includes('|')) throw new Error('msgId must not contain "|"');
  const json = asciiJson(message);
  const total = Math.max(1, Math.ceil(json.length / chunk));
  return Array.from({ length: total }, (_, i) => `${msgId}|${i}|${total}|${json.slice(i * chunk, (i + 1) * chunk)}`);
}

/**
 * JSON with every non-ASCII UTF-16 unit escaped as \uXXXX, so one char is one byte: a 150-char frame
 * plus its header fits one BLE write or notification (MTU 185), and a slice never splits a surrogate pair.
 */
export function asciiJson(message: object): string {
  return JSON.stringify(message).replace(/[\u0080-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

export class FrameAssembler<T = unknown> {
  private partial = new Map<string, { total: number; parts: string[]; got: number }>();

  /** Feeds one frame; returns the decoded message once all its frames arrived. */
  push(frame: string): T | null {
    const [msgId, idx, total] = frame.split('|', 3);
    const payload = frame.slice(msgId.length + idx.length + total.length + 3);
    const i = Number(idx);
    const n = Number(total);
    if (!msgId || !Number.isInteger(i) || !Number.isInteger(n) || n < 1 || i < 0 || i >= n) {
      throw new Error(`Quadro inválido: ${frame.slice(0, 40)}`);
    }
    let entry = this.partial.get(msgId);
    if (!entry || entry.total !== n) {
      entry = { total: n, parts: new Array(n), got: 0 };
      this.partial.set(msgId, entry);
    }
    if (entry.parts[i] === undefined) entry.got += 1;
    entry.parts[i] = payload;
    if (entry.got < n) return null;
    this.partial.delete(msgId);
    return JSON.parse(entry.parts.join('')) as T;
  }

  get pending(): number {
    return this.partial.size;
  }
}

let counter = 0;
export function nextMsgId(prefix = 'm'): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`;
}
