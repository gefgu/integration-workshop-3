import { useEffect, useState } from 'react';
import { useSay } from '../audio/useTutorVoice.ts';
import { playClip } from '../audio/tone.ts';
import Bubble from '../components/Bubble.tsx';
import LabBoard from '../components/LabBoard.tsx';
import { detectEvents, goalDone, labStates, matchingPreset, buzzerMa, buzzerSound } from '../engine/lab.ts';
import { formatOhms } from '../engine/sim.ts';
import type { Lesson, LabEvent, LessonStep, Piece } from '../model/types.ts';
import { useLab } from './useLab.ts';

const SLIDER_MIN = 220;
const SLIDER_MAX = 10000;
const toOhms = (x: number) => Math.round(SLIDER_MIN * (SLIDER_MAX / SLIDER_MIN) ** (x / 100));
const toSlider = (ohms: number) => Math.round((100 * Math.log(ohms / SLIDER_MIN)) / Math.log(SLIDER_MAX / SLIDER_MIN));

/**
 * A simulated lab: the student changes something on the bench and completes missions while
 * watching what happens. The missions are checked by the app, never by the camera or the validator.
 */
export default function ExperimentStep({
  lesson,
  step,
  pieces,
  setPieces,
  onDone,
  mascotKind,
}: {
  lesson: Lesson;
  step: LessonStep;
  pieces: Piece[];
  setPieces: (next: Piece[]) => void;
  onDone: () => void;
  mascotKind: string;
}) {
  const spec = step.experiment;
  const settings = lesson.settings;
  const lab = useLab(pieces, settings);
  const [events, setEvents] = useState<Set<LabEvent>>(() => new Set());
  const [presetsLit, setPresetsLit] = useState<Set<number>>(() => new Set());
  const [presetsFaded, setPresetsFaded] = useState<Set<number>>(() => new Set());
  const [playing, setPlaying] = useState<'a' | 'b' | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: lab.snapshot is rebuilt every render; these are its inputs
  useEffect(() => {
    setEvents((prev) => {
      const next = detectEvents(prev, lab.snapshot);
      return next.size === prev.size ? prev : next;
    });
  }, [pieces, lab.held, lab.energized, lab.diag, lab.flags]);


  const matched = spec?.presets ? matchingPreset(pieces, spec.presets) : -1;
  const steadyLit = lab.energized && lab.diag.code === 'valido';
  useEffect(() => {
    if (steadyLit && matched >= 0) setPresetsLit((s) => (s.has(matched) ? s : new Set(s).add(matched)));
  }, [steadyLit, matched]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: record which preset just finished fading
  useEffect(() => {
    if (lab.fadeCount > 0 && matched >= 0) setPresetsFaded((s) => (s.has(matched) ? s : new Set(s).add(matched)));
  }, [lab.fadeCount]);

  const states = labStates(lab.snapshot);
  const done = (spec?.goals ?? []).map((g) => goalDone(g, events, states, { presetsLit, presetsFaded }));
  const allDone = done.length > 0 && done.every(Boolean);
  const pot = spec?.slider ? pieces.find((p) => p.id === spec.slider.pieceId) : null;

  let tone = 'info';
  let msg = step.text || 'Faça o experimento e cumpra as missões.';
  if (lab.alarm) {
    tone = 'erro';
    msg = lab.alarm;
  } else if (allDone) {
    tone = 'ok';
    msg = 'Missões cumpridas! Você viu o efeito acontecer. Continue quando quiser.';
  }
  useSay([msg]);

  async function play(which: 'a' | 'b') {
    if (!spec?.clips) return;
    const ohms = spec.clips[which];
    const mA = buzzerMa(ohms);
    const { hz, volume } = buzzerSound(mA);
    setPlaying(which);
    lab.markHeard(which);
    await playClip(hz, volume);
    setPlaying(null);
  }

  return (
    <>
      <Bubble kind={mascotKind} tone={tone} message={msg} />
      {step.title && <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)' }}>{step.title}</h2>}
      {spec?.clips ? null : <LabBoard lab={lab} pieces={pieces} setPieces={setPieces} settings={settings} />}
      {spec?.presets && (
        <div className="panel" style={{ maxWidth: 720, width: '100%' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Troque a peça e compare</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {spec.presets.map((p, i) => (
              <button
                key={p.label}
                type="button"
                className={matched === i ? 'btn-primary' : 'btn-outline'}
                aria-pressed={matched === i}
                onClick={() => setPieces(p.pieces.map((x) => ({ ...x })))}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {spec?.slider && pot && (
        <div className="panel" style={{ maxWidth: 720, width: '100%' }}>
          <label htmlFor="pot-slider" style={{ fontWeight: 700, fontSize: 14 }}>
            {spec.slider.label}: {formatOhms(pot.value ?? 1000)}
          </label>
          <input
            id="pot-slider"
            type="range"
            min={0}
            max={100}
            value={toSlider(pot.value ?? 1000)}
            onChange={(e) =>
              setPieces(pieces.map((p) => (p.id === pot.id ? { ...p, value: toOhms(Number(e.target.value)) } : p)))
            }
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span>menos resistência</span>
            <span>mais resistência</span>
          </div>
        </div>
      )}
      {spec?.clips && (
        <div className="panel" style={{ maxWidth: 720, width: '100%' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Escute os dois clipes</h3>
          <p style={{ margin: '0 0 8px', fontSize: 13 }}>
            Os clipes são <strong>sons simulados</strong> pelo software (não são gravações da bancada). O valor do
            resistor de cada um está escondido.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            {(['a', 'b'] as const).map((w) => (
              <button key={w} type="button" className="btn-primary" disabled={!!playing} onClick={() => play(w)}>
                {playing === w ? 'Tocando…' : `▶ Clipe ${w.toUpperCase()}`}
              </button>
            ))}
          </div>
        </div>
      )}
      {spec && (
        <section className="panel" style={{ maxWidth: 720, width: '100%', textAlign: 'left' }} aria-label="Missões">
          <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Missões</h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {spec.goals.map((g, i) => (
              <li key={g.id} style={{ fontSize: 14, color: done[i] ? 'var(--color-accent-2-800)' : 'inherit' }}>
                <span aria-hidden="true">{done[i] ? '✅' : '⬜'}</span> {g.label}
                <span className="sr-only"> {done[i] ? '(feita)' : '(a fazer)'}</span>
              </li>
            ))}
          </ul>
          {allDone && (
            <button type="button" className="btn-primary" style={{ marginTop: 12 }} onClick={onDone}>
              Continuar
            </button>
          )}
        </section>
      )}
    </>
  );
}
