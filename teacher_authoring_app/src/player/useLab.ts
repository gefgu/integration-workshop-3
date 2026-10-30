import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { startTone, type Tone } from '../audio/tone.ts';
import { useCapsules } from '../components/useCapsules.ts';
import { mergeTrails } from '../engine/capsules.ts';
import { diagnose } from '../engine/diagnose.ts';
import {
  capacitanceUF,
  capDischarge,
  DARK_MA,
  type Discharge,
  dischargeMa,
  dischargeTau,
  buzzerSound,
  type LabSnapshot,
} from '../engine/lab.ts';
import { branchCurrent } from '../engine/sim.ts';
import type { LessonSettings, Piece } from '../model/types.ts';

const FLICKER_MS = 130;
const FADE_TICK_MS = 50;

interface Fade {
  start: number;
  tau: number;
  startMa: number;
  discharge: Discharge;
  microFarads: number;
}

/**
 * The simulated bench behind every playable board: power switch, held buttons, the short-circuit
 * cut-out, the flicker of a poorly seated part and the capacitor's fade after power-off.
 * Everything it shows is a software model; none of it is measured on the physical bench.
 */
export function useLab(pieces: Piece[], settings?: LessonSettings) {
  const [energized, setEnergized] = useState(false);
  const [held, setHeld] = useState<Set<string>>(() => new Set());
  const [alarm, setAlarm] = useState<string | null>(null);
  const [flags, setFlags] = useState<LabSnapshot['flags']>({});
  const [flickerOn, setFlickerOn] = useState(true);
  const [fade, setFade] = useState<Fade | null>(null);
  const [now, setNow] = useState(0);
  const [fadeCount, setFadeCount] = useState(0);
  const [lastFade, setLastFade] = useState<{ seconds: number; microFarads: number } | null>(null);
  const heard = useRef<Set<'a' | 'b'>>(new Set());
  const [soundOn, setSoundOn] = useState(true);
  const tone = useRef<Tone | null>(null);

  const diag = useMemo(
    () => diagnose(pieces, held, { allowNoResistor: settings?.allowNoResistor }),
    [pieces, held, settings?.allowNoResistor]
  );
  const cap = useCapsules(pieces, held, energized);
  const raise = useCallback((patch: Partial<LabSnapshot['flags']>) => setFlags((f) => ({ ...f, ...patch })), []);

  // A direct short: the bench cuts the power at once (simulated alarm).
  useEffect(() => {
    if (energized && diag.code === 'curto') {
      setEnergized(false);
      setAlarm(
        'CURTO-CIRCUITO! O + da bateria foi ligado direto ao −, sem nada no caminho. A bancada cortou a energia sozinha para proteger você (simulação).'
      );
      raise({ shortCut: true });
    }
  }, [energized, diag.code, raise]);
  useEffect(() => {
    if (alarm && diag.code !== 'curto') setAlarm(null);
  }, [alarm, diag.code]);

  // A poorly seated part on the energized path makes the load blink.
  const looseActive = energized && diag.code === 'valido' && diag.looseIds.length > 0;
  useEffect(() => {
    if (!looseActive) {
      setFlickerOn(true);
      return undefined;
    }
    raise({ flickering: true });
    const timer = setInterval(() => setFlickerOn(Math.random() < 0.55), FLICKER_MS);
    return () => clearInterval(timer);
  }, [looseActive, raise]);

  // The capacitor keeps the LED going for a moment after power-off.
  useEffect(() => {
    if (!fade) return undefined;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (dischargeMa(fade.startMa, (t - fade.start) / 1000, fade.tau) < DARK_MA) {
        setFade(null);
        setFadeCount((n) => n + 1);
        setLastFade({ seconds: (t - fade.start) / 1000, microFarads: fade.microFarads });
        raise({ fadeDone: true });
      }
    }, FADE_TICK_MS);
    return () => clearInterval(timer);
  }, [fade, raise]);

  const litSteady = energized && (diag.code === 'valido' || !!cap.driven);
  const fading = !!fade;
  const blinkOff = looseActive && !flickerOn;
  const lit = (litSteady && !blinkOff) || fading;
  const fadeMa = fade ? dischargeMa(fade.startMa, (now - fade.start) / 1000, fade.tau) : 0;
  const ledMa = fading ? fadeMa : lit ? Math.max(diag.code === 'valido' ? diag.mA : 0, cap.drivenMa) : 0;
  const trail = fading
    ? { edgeIds: fade.discharge.edgeIds, nodes: new Set<number>() }
    : lit
      ? mergeTrails(diag.code === 'valido' ? diag.trail : null, cap.driven)
      : null;

  // The simulated buzzer sound follows the current through the buzzer branch.
  const buzzing = lit && diag.loadsLit.includes('buzzer') && soundOn;
  const buzzMa = buzzing ? Math.max(0.1, ledMa) : 0;
  useEffect(() => {
    if (!buzzing) {
      tone.current?.stop();
      tone.current = null;
      return;
    }
    const { hz, volume } = buzzerSound(buzzMa);
    if (tone.current) tone.current.set(hz, volume);
    else tone.current = startTone(hz, volume);
  }, [buzzing, buzzMa]);
  useEffect(() => () => tone.current?.stop(), []);

  const toggle = useCallback(() => {
    setFade(null);
    if (energized) {
      const farads = capacitanceUF(pieces);
      const discharge = farads > 0 && diag.code === 'valido' ? capDischarge(pieces) : null;
      if (discharge && discharge.load === 'led') {
        const startMa = branchCurrent({ ohms: discharge.ohms, load: 'led' }).mA;
        setNow(Date.now());
        setFade({ start: Date.now(), tau: dischargeTau(discharge, farads), startMa, discharge, microFarads: farads });
      }
    }
    setEnergized(!energized);
  }, [energized, pieces, diag.code]);

  const press = useCallback((id: string, down: boolean) => {
    setHeld((h) => {
      const n = new Set(h);
      if (down) n.add(id);
      else n.delete(id);
      return n;
    });
  }, []);
  const toggleHold = useCallback((id: string) => {
    setHeld((h) => {
      const n = new Set(h);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);
  const markHeard = useCallback(
    (clip: 'a' | 'b') => {
      heard.current.add(clip);
      raise({ heard: new Set(heard.current) });
    },
    [raise]
  );
  const reset = useCallback(() => {
    setEnergized(false);
    setHeld(new Set());
    setAlarm(null);
    setFade(null);
    setLastFade(null);
    heard.current = new Set();
    setFlags({});
  }, []);

  const snapshot: LabSnapshot = { pieces, held, energized, diag, flags };
  return {
    energized,
    toggle,
    held,
    press,
    toggleHold,
    diag,
    cap,
    lit,
    fading,
    blinkOff,
    ledMa,
    trail,
    alarm,
    flags,
    snapshot,
    onReseat: useCallback(() => raise({ reseated: true }), [raise]),
    markHeard,
    reset,
    soundOn,
    setSoundOn,
    fadeCount,
    lastFade,
  };
}

export type Lab = ReturnType<typeof useLab>;
