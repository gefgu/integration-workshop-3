/**
 * The tutor's voice: MP3s synthesized by the backend (Piper, pt_BR-cadu-medium) when a lesson is saved.
 * Phrases are looked up by their final text — the lesson's manifest first, then the shared system pack.
 */
import type { AudioManifest } from '../model/types.ts';

/** Lookup key. Mirrors `normalize` in graph_validator/src/graph_validator/tts/synth.py. */
export const normalize = (text: string): string => text.split(/\s+/).filter(Boolean).join(' ');

export const audioUrl = (file: string) => `/api/tts/audio/${file}`;

export function audioFileFor(text: string, manifests: (AudioManifest | null | undefined)[]): string | null {
  const key = normalize(text || '');
  if (!key) return null;
  for (const m of manifests) {
    const file = m?.phrases?.[key];
    if (file) return file;
  }
  return null;
}

/** The parts of HTMLAudioElement the voice uses (a fake in tests). */
export interface AudioSink {
  src: string;
  onended: ((ev: Event) => void) | null;
  play: () => Promise<void>;
  pause: () => void;
}

/**
 * Plays phrases one after the other. Calls made in the same tick (e.g. the effects of one render)
 * are merged by `order`, then replace whatever was still playing — the newest bubble always wins.
 */
export class TutorVoice {
  muted = false;
  manifests: (AudioManifest | null | undefined)[] = [];
  private queue: string[] = [];
  private batch: { order: number; lines: string[] }[] = [];
  private sink: AudioSink | null = null;

  constructor(private makeSink: () => AudioSink | null = () => (typeof Audio === 'undefined' ? null : new Audio())) {}

  say(lines: (string | null | undefined)[], order = 0): void {
    this.batch.push({ order, lines: lines.filter(Boolean) as string[] });
    if (this.batch.length === 1) queueMicrotask(() => this.flush());
  }

  stop(): void {
    this.queue = [];
    if (this.sink) {
      this.sink.onended = null;
      this.sink.pause();
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.stop();
  }

  private flush(): void {
    const lines = this.batch.sort((x, y) => x.order - y.order).flatMap((b) => b.lines);
    this.batch = [];
    if (!lines.length) return;
    this.stop();
    if (this.muted) return;
    this.queue = lines.map((line) => audioFileFor(line, this.manifests)).filter(Boolean) as string[];
    this.playNext();
  }

  private playNext(): void {
    const file = this.queue.shift();
    if (!file) return;
    this.sink ??= this.makeSink();
    if (!this.sink) return;
    this.sink.onended = () => this.playNext();
    this.sink.src = audioUrl(file);
    this.sink.play().catch(() => this.playNext()); // autoplay blocked or file gone: skip it
  }
}

let systemPack: Promise<AudioManifest | null> | null = null;

/** Shared phrases (default feedback, praise…). Fetched once; null while the backend has no pack. */
export function loadSystemPack(fetchImpl: typeof fetch = fetch): Promise<AudioManifest | null> {
  systemPack ??= fetchImpl('/api/tts/system')
    .then((r) => (r.ok ? r.json() : null))
    .then((m) => (m?.status === 'ok' ? m : null))
    .catch(() => null)
    .then((m) => {
      if (!m) systemPack = null; // try again next time the player opens
      return m;
    });
  return systemPack;
}
