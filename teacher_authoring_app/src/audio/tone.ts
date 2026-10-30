/**
 * Simulated buzzer sound (WebAudio). It is a didactic model of how hard the buzzer is driven, not a
 * recording and not a measurement of the physical buzzer. Silent where WebAudio is unavailable.
 */
let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  try {
    const Ctor = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = ctx ?? new Ctor();
    void ctx.resume?.();
    return ctx;
  } catch {
    return null;
  }
}

export interface Tone {
  set: (hz: number, volume: number) => void;
  stop: () => void;
}

const MAX_GAIN = 0.12; // keep a classroom's speakers polite

/** A continuous tone until `stop()`. */
export function startTone(hz: number, volume: number): Tone {
  const c = context();
  if (!c) return { set: () => undefined, stop: () => undefined };
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'square';
  osc.frequency.value = hz;
  gain.gain.value = volume * MAX_GAIN;
  osc.connect(gain).connect(c.destination);
  osc.start();
  return {
    set: (nextHz, nextVolume) => {
      osc.frequency.setTargetAtTime(nextHz, c.currentTime, 0.02);
      gain.gain.setTargetAtTime(nextVolume * MAX_GAIN, c.currentTime, 0.02);
    },
    stop: () => {
      try {
        gain.gain.setTargetAtTime(0, c.currentTime, 0.02);
        osc.stop(c.currentTime + 0.1);
      } catch {
        /* already stopped */
      }
    },
  };
}

/** A short clip (lesson 8 challenge). Resolves when it ends. */
export function playClip(hz: number, volume: number, ms = 1400): Promise<void> {
  const tone = startTone(hz, volume);
  return new Promise((resolve) =>
    setTimeout(() => {
      tone.stop();
      resolve();
    }, ms)
  );
}
